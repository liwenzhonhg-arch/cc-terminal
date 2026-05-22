import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { TeamMessage } from "@/store/team";
import { markdownComponents } from "@/features/agents/markdownComponents";

const ROLE_STYLE: Record<string, { dot: string; color: string }> = {
  lead: { dot: "●", color: "text-amber" },
  member: { dot: "○", color: "text-moss" },
};

function AgentBadge({ name, role }: { name: string; role: string }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.member;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-2xs">
      <span className={style.color}>{style.dot}</span>
      <span className="text-ink font-semibold">{name}</span>
      {role === "lead" && (
        <span className="text-faint uppercase tracking-operator">TL</span>
      )}
    </span>
  );
}

function TeamMessageBlock({ message }: { message: TeamMessage }) {
  const isUser = message.messageType === "user";
  const isSystem = message.messageType === "system";
  const isToolUse = message.messageType === "tool_use";
  const isToolResult = message.messageType === "tool_result";

  if (isUser) {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-mono text-2xs text-faint">{">"}</span>
          <span className="font-mono text-2xs text-muted">You</span>
        </div>
        <div className="pl-4 font-sans text-sm text-ink whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="mb-3 px-3 py-1.5 font-mono text-2xs text-muted border-l border-muted/20">
        {message.agentName && (
          <span className="text-faint mr-1">[{message.agentName}]</span>
        )}
        {message.content}
      </div>
    );
  }

  if (isToolUse) {
    return (
      <div className="mb-2 pl-4">
        {message.agentName && message.agentRole && (
          <div className="mb-0.5">
            <AgentBadge name={message.agentName} role={message.agentRole} />
          </div>
        )}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-border/40 rounded-sm font-mono text-2xs text-muted">
          <span className="text-amber/50 select-none">⚙</span>
          {message.content}
        </div>
      </div>
    );
  }

  if (isToolResult) {
    return (
      <div className="mb-3 pl-4">
        <details className="group">
          <summary className="cursor-pointer font-mono text-2xs text-faint hover:text-muted transition-colors">
            Tool result
            <span className="ml-1 text-faint group-open:hidden">▸</span>
            <span className="ml-1 text-faint hidden group-open:inline">▾</span>
          </summary>
          <pre className="mt-1 px-2 py-1.5 bg-border/10 rounded-sm font-mono text-2xs text-muted whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {message.content.slice(0, 2000)}
          </pre>
        </details>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="mb-5 pl-3 border-l border-border">
      {message.agentName && message.agentRole && (
        <div className="mb-1.5">
          <AgentBadge name={message.agentName} role={message.agentRole} />
        </div>
      )}
      <div className="prose-cc font-sans text-sm text-ink leading-[1.7]">
        <ReactMarkdown components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function GroupChatView({ messages }: { messages: TeamMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = () => setShowScrollBtn(!isNearBottom());
  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
        <span className="font-mono text-2xs text-border/60 tracking-widest uppercase">
          Team Chat
        </span>
        <p className="font-serif text-base text-muted">
          Send a message to start collaborating
        </p>
        <span className="inline-block w-[2px] h-4 bg-muted/30 animate-[blink_1.06s_steps(2)_infinite]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto relative" ref={scrollRef} onScroll={handleScroll}>
      <div className="max-w-[72ch] mx-auto pt-6 pb-6 px-4 sm:px-6">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className="animate-[fadeIn_180ms_ease-out]"
            style={{
              animationFillMode: "backwards",
              animationDelay: `${Math.min(i * 20, 200)}ms`,
            }}
          >
            <TeamMessageBlock message={msg} />
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute right-6 bottom-4 w-7 h-7 flex items-center justify-center rounded-sm border border-border bg-surface text-muted hover:text-ink hover:border-ink/20 transition-colors font-mono text-xs"
        >
          ↓
        </button>
      )}
    </div>
  );
}
