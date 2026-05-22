import { useState, useRef, useCallback, useEffect } from "react";
import type { TeamAgent } from "@/store/team";
import { useTeamStore } from "@/store/team";
import { useAgentStore } from "@/store/agents";
import { useSlashCommands } from "@/lib/useSlashCommands";
import { executeOrForward, type CommandContext } from "@/lib/commands";
import { SlashCommandPopup } from "@/components/SlashCommandPopup";

type TeamComposerProps = {
  isWorking: boolean;
  agents: TeamAgent[];
  onSend: (content: string, targetAgent: string | null) => void;
  onCommandFeedback?: (message: string) => void;
};

function parseMention(text: string, agents: TeamAgent[]): string | null {
  const match = text.match(/^@(\S+)\s/);
  if (!match) return null;
  const name = match[1];
  return agents.find((a) => a.name === name) ? name : null;
}

export function TeamComposer({ isWorking, agents, onSend, onCommandFeedback }: TeamComposerProps) {
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  const activatePanel = useAgentStore((s) => s.activatePanel);
  const clearMessages = useTeamStore((s) => s.clearMessages);

  const slash = useSlashCommands();

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;

    if (content.startsWith("/")) {
      const ctx: CommandContext = {
        threadId: null,
        agentId: null,
        mode: "team",
        appendMessage: (msg) => {
          onCommandFeedback?.(msg.content);
        },
        activatePanel,
        clearThread: () => {
          clearMessages();
        },
      };

      const result = await executeOrForward(content, ctx);
      if (result.handled) {
        if (result.feedbackMessage) {
          onCommandFeedback?.(result.feedbackMessage);
        }
        setInput("");
        setShowMentions(false);
        return;
      }
    }

    const target = parseMention(content, agents);
    setInput("");
    setShowMentions(false);
    onSend(content, target);
  }, [input, agents, onSend, onCommandFeedback, activatePanel, clearMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slash.handleKeyDown(e)) {
      e.preventDefault();
      if (e.key === "Enter" || e.key === "Tab") {
        if (slash.filteredCommands.length > 0) {
          const cmd = slash.filteredCommands[slash.selectedIndex];
          const newInput = slash.selectCommand(cmd);
          setInput(newInput);
          textareaRef.current?.focus();
        }
      }
      return;
    }
    if (showMentions) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && filteredAgents.length > 0)) {
        e.preventDefault();
        insertMention(filteredAgents[0].name);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";

    slash.updateFromInput(val);

    if (!val.startsWith("/")) {
      const cursorPos = el.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);
      if (atMatch) {
        setShowMentions(true);
        setMentionFilter(atMatch[1].toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx === -1) return;
    const newInput = input.slice(0, atIdx) + `@${name} ` + input.slice(cursorPos);
    setInput(newInput);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (!showMentions) return;
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMentions]);

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      <div className="max-w-[72ch] mx-auto px-4 sm:px-6 py-4">
        <div className="relative">
          <span className="absolute left-3 top-3 font-mono text-xs text-muted select-none pointer-events-none">
            {isWorking ? "···" : ">"}
          </span>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isWorking
                ? "Agents are working..."
                : "@agent message, /command, or just type to talk to TL"
            }
            rows={1}
            disabled={isWorking}
            className="w-full bg-surface-raised/80 border border-border rounded-sm pl-8 pr-20 py-2.5 font-sans text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink/20 disabled:opacity-50 resize-none min-h-[40px] max-h-[160px] transition-colors"
          />

          {slash.showPopup && (
            <SlashCommandPopup
              commands={slash.filteredCommands}
              selectedIndex={slash.selectedIndex}
              onSelect={(cmd) => {
                const newInput = slash.selectCommand(cmd);
                setInput(newInput);
                textareaRef.current?.focus();
              }}
              onClose={slash.closePopup}
            />
          )}

          {!slash.showPopup && showMentions && filteredAgents.length > 0 && (
            <div
              ref={mentionRef}
              className="absolute left-8 bottom-full mb-1 w-56 border border-border rounded-sm bg-surface max-h-[200px] overflow-y-auto z-50"
            >
              {filteredAgents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() => insertMention(agent.name)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-border/40 transition-colors"
                >
                  <span
                    className={`text-2xs ${
                      agent.role === "lead" ? "text-amber" : "text-moss"
                    }`}
                  >
                    {agent.role === "lead" ? "●" : "○"}
                  </span>
                  <span className="font-mono text-xs text-ink">
                    @{agent.name}
                  </span>
                  <span className="font-mono text-2xs text-faint truncate flex-1">
                    {agent.description.slice(0, 30)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            {isWorking ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-2xs text-amber">
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-amber animate-pulse" />
                Working
              </span>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-2.5 py-1 font-mono text-2xs text-muted border border-transparent rounded hover:text-ink hover:border-border disabled:opacity-0 disabled:pointer-events-none transition-all"
              >
                Enter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
