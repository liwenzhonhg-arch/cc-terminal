import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, type ThreadStatus } from "@/store/agents";
import { MessageBlock, StatusIndicator } from "./messages";
import { Composer } from "./Composer";
import { ThreadTabBar } from "@/components/ThreadTabBar";

const VALID_STATUSES: Set<string> = new Set<ThreadStatus>([
  "idle", "thinking", "tool_use", "awaiting_input", "done", "error", "crashed",
]);

type AgentLinePayload = {
  agentId: string;
  line: string;
};

type AgentExitPayload = {
  agentId: string;
  code: number | null;
};

export function ThreadView() {
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const thread = useAgentStore((s) =>
    s.activeThreadId ? s.threads[s.activeThreadId] : null
  );
  const appendMessage = useAgentStore((s) => s.appendMessage);
  const setThreadStatus = useAgentStore((s) => s.setThreadStatus);
  const setAgentId = useAgentStore((s) => s.setAgentId);
  const updateUsage = useAgentStore((s) => s.updateUsage);
  const setSessionId = useAgentStore((s) => s.setSessionId);
  const loadSessionMessages = useAgentStore((s) => s.loadSessionMessages);

  useEffect(() => {
    if (activeThreadId && thread?.sessionId && thread.messages.length === 0 && !thread.agentId) {
      loadSessionMessages(activeThreadId);
    }
  }, [activeThreadId, thread?.sessionId, thread?.messages.length, thread?.agentId, loadSessionMessages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const justSwitchedRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  useEffect(() => {
    justSwitchedRef.current = true;
  }, [activeThreadId]);

  useEffect(() => {
    if (!thread?.messages.length) return;

    if (justSwitchedRef.current) {
      justSwitchedRef.current = false;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
    } else if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.messages.length]);

  const handleScroll = () => {
    setShowScrollBtn(!isNearBottom());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSidecarMessage = useCallback(
    (threadId: string, msg: Record<string, unknown>) => {
      switch (msg.type) {
        case "status": {
          const state = msg.state as string;
          if (VALID_STATUSES.has(state)) {
            setThreadStatus(threadId, state as ThreadStatus);
          }
          break;
        }

        case "event": {
          const data = msg.data as Record<string, unknown> | undefined;
          if (data?.type === "assistant") {
            const content = (data.message as Record<string, unknown>)?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if ("text" in block && block.text) {
                  appendMessage(threadId, {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: block.text as string,
                    timestamp: Date.now(),
                    raw: block,
                  });
                } else if ("name" in block) {
                  appendMessage(threadId, {
                    id: crypto.randomUUID(),
                    role: "tool_use",
                    content: `Tool: ${block.name}`,
                    timestamp: Date.now(),
                    raw: block,
                  });
                }
              }
            }
          } else if (data?.type === "tool_result") {
            const content = (data as Record<string, unknown>).content;
            const toolUseId = (data as Record<string, unknown>).tool_use_id as string | undefined;
            let text = "";
            if (typeof content === "string") {
              text = content;
            } else if (Array.isArray(content)) {
              text = content
                .filter((b: Record<string, unknown>) => b.type === "text")
                .map((b: Record<string, unknown>) => b.text)
                .join("\n");
            }
            if (text) {
              appendMessage(threadId, {
                id: crypto.randomUUID(),
                role: "tool_result",
                content: text,
                timestamp: Date.now(),
                raw: { toolUseId, isError: (data as Record<string, unknown>).is_error },
              });
            }
          } else if (data?.type === "result") {
            if (data.session_id) {
              setSessionId(threadId, data.session_id as string);
            }
          }
          break;
        }

        case "usage":
          updateUsage(threadId, {
            input: msg.input as number,
            output: msg.output as number,
            cacheRead: msg.cacheRead as number,
            cacheWrite: msg.cacheWrite as number,
            costUsd: msg.costUsd as number,
          });
          if (msg.sessionId) {
            setSessionId(threadId, msg.sessionId as string);
          }
          break;

        case "error":
          appendMessage(threadId, {
            id: crypto.randomUUID(),
            role: "system",
            content: msg.message as string,
            timestamp: Date.now(),
          });
          break;
      }
    },
    [appendMessage, setThreadStatus, updateUsage, setSessionId]
  );

  useEffect(() => {
    // Listeners use getState() to find threads by agentId (unique per sidecar),
    // so background threads' events are processed even when not the active tab.
    const unlistenLine = listen<AgentLinePayload>("agent:line", (event) => {
      const { agentId, line } = event.payload;
      if (!agentId) return;
      const allThreads = useAgentStore.getState().threads;
      const entry = Object.entries(allThreads).find(([, t]) => t.agentId === agentId);
      if (!entry) return;
      const [threadId] = entry;

      try {
        const parsed = JSON.parse(line);
        handleSidecarMessage(threadId, parsed);
      } catch (err) {
        console.warn("[agent:line] failed to parse:", line.slice(0, 120), err);
      }
    });

    const unlistenExit = listen<AgentExitPayload>("agent:exit", (event) => {
      const allThreads = useAgentStore.getState().threads;
      const entry = Object.entries(allThreads).find(([, t]) => t.agentId === event.payload.agentId);
      if (!entry) return;
      const [threadId] = entry;

      const code = event.payload.code;
      if (code !== 0) {
        appendMessage(threadId, {
          id: crypto.randomUUID(),
          role: "system",
          content: `Agent exited with code ${code ?? "unknown"}`,
          timestamp: Date.now(),
        });
        setThreadStatus(threadId, "crashed");
      } else {
        setThreadStatus(threadId, "done");
      }
    });

    return () => {
      unlistenLine.then((fn) => fn());
      unlistenExit.then((fn) => fn());
    };
  }, [handleSidecarMessage, appendMessage, setThreadStatus]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeThreadId || !thread) return;

      appendMessage(activeThreadId, {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      });

      const userLine = JSON.stringify({ type: "user", content });

      if (!thread.agentId) {
        try {
          const helloMsg = JSON.stringify({
            type: "hello",
            cwd: thread.cwd,
            model: thread.model,
            permissionMode: "acceptEdits",
            ...(thread.sessionId ? { sessionId: thread.sessionId } : {}),
          });

          const agentId = await invoke<string>("spawn_agent", {
            helloJson: helloMsg,
          });

          setAgentId(activeThreadId, agentId);
          await invoke("send_to_agent", { agentId, line: userLine });
        } catch (err) {
          appendMessage(activeThreadId, {
            id: crypto.randomUUID(),
            role: "system",
            content: `Spawn failed: ${err}`,
            timestamp: Date.now(),
          });
          setThreadStatus(activeThreadId, "error");
        }
      } else {
        try {
          await invoke("send_to_agent", {
            agentId: thread.agentId,
            line: userLine,
          });
        } catch (err) {
          appendMessage(activeThreadId, {
            id: crypto.randomUUID(),
            role: "system",
            content: `Send failed: ${err}`,
            timestamp: Date.now(),
          });
        }
      }
    },
    [activeThreadId, thread, appendMessage, setAgentId, setThreadStatus]
  );

  const handleInterrupt = useCallback(async () => {
    if (!thread?.agentId) return;
    try {
      const interruptMsg = JSON.stringify({ type: "interrupt" });
      await invoke("send_to_agent", {
        agentId: thread.agentId,
        line: interruptMsg,
      });
    } catch {
      // ignore
    }
  }, [thread?.agentId]);

  if (!thread) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-surface-chat">
        <ThreadTabBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none">
        <div className="font-mono text-2xs text-border/80 leading-relaxed whitespace-pre text-center">{`┌──────────────────────────────┐
│                              │
│   ◆  cc-terminal  v0.0.1    │
│                              │
│   agent orchestration        │
│   desktop client             │
│                              │
└──────────────────────────────┘`}</div>
        <div className="flex flex-col items-center gap-2">
          <p className="font-serif text-base text-muted">
            Select a thread to begin
          </p>
          <div className="flex items-center gap-4 font-mono text-2xs text-faint">
            <span>Ctrl+N · new thread</span>
            <span>Alt+↑↓ · switch</span>
          </div>
        </div>
        <span className="inline-block w-[2px] h-4 bg-muted/30 animate-[blink_1.06s_steps(2)_infinite]" />
        </div>
      </div>
    );
  }

  const isWorking =
    thread.status === "thinking" || thread.status === "tool_use";
  const isEmpty = thread.messages.length === 0 && !thread.agentId && !thread.sessionId;

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col min-w-0 relative bg-surface-chat">
        <ThreadTabBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
          <span className="font-mono text-2xs text-border/60 tracking-widest uppercase">
            cc-terminal
          </span>
          <p className="font-serif text-lg text-ink/80">
            Hello! Start a new conversation
          </p>
          <p className="font-mono text-2xs text-faint">
            Type a message below to begin
          </p>
          <span className="inline-block w-[2px] h-4 bg-muted/30 animate-[blink_1.06s_steps(2)_infinite]" />
        </div>
        <Composer
          isWorking={false}
          cwd={thread.cwd}
          model={thread.model}
          threadId={activeThreadId}
          agentId={thread.agentId}
          onSend={sendMessage}
          onInterrupt={handleInterrupt}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 relative bg-surface-chat">
      <ThreadTabBar />
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="max-w-[72ch] mx-auto pt-6 pb-6 px-4 sm:px-6">
          {thread.messages.map((msg, i) => (
            <div
              key={msg.id}
              className="animate-[fadeIn_180ms_ease-out]"
              style={{
                animationFillMode: "backwards",
                animationDelay: `${Math.min(i * 20, 200)}ms`,
              }}
            >
              <MessageBlock message={msg} />
            </div>
          ))}

          {isWorking && <StatusIndicator status={thread.status} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute right-6 bottom-28 w-7 h-7 flex items-center justify-center rounded-sm border border-border bg-surface text-muted hover:text-ink hover:border-ink/20 transition-colors font-mono text-xs"
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}

      <Composer
        isWorking={isWorking}
        cwd={thread.cwd}
        model={thread.model}
        threadId={activeThreadId}
        agentId={thread.agentId}
        onSend={sendMessage}
        onInterrupt={handleInterrupt}
      />
    </div>
  );
}
