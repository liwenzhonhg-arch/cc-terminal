import { useState, useRef, useCallback } from "react";
import { useAgentStore } from "@/store/agents";
import { useConsoleStore } from "@/store/console";
import { useT } from "@/i18n";
import { useSlashCommands } from "@/lib/useSlashCommands";
import { executeOrForward, type CommandContext } from "@/lib/commands";
import { SlashCommandPopup } from "@/components/SlashCommandPopup";

type ComposerProps = {
  isWorking: boolean;
  cwd: string;
  model: string;
  threadId: string | null;
  agentId: string | null;
  onSend: (content: string) => void;
  onInterrupt: () => void;
};

export function Composer({ isWorking, cwd, model, threadId, agentId, onSend, onInterrupt }: ComposerProps) {
  const t = useT();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const appendMessage = useAgentStore((s) => s.appendMessage);
  const activatePanel = useAgentStore((s) => s.activatePanel);
  const clearThread = useAgentStore((s) => s.clearThread);

  const pendingSkills = useConsoleStore((s) => s.pendingSkills);
  const removePendingSkill = useConsoleStore((s) => s.removePendingSkill);

  const slash = useSlashCommands();

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;

    if (content.startsWith("/")) {
      const ctx: CommandContext = {
        threadId,
        agentId,
        mode: "thread",
        appendMessage: (msg) => {
          if (!threadId) return;
          appendMessage(threadId, {
            id: crypto.randomUUID(),
            role: msg.role,
            content: msg.content,
            timestamp: Date.now(),
          });
        },
        activatePanel,
        clearThread,
      };

      const result = await executeOrForward(content, ctx);

      if (result.handled) {
        if (result.feedbackMessage) {
          ctx.appendMessage({ role: "command", content: result.feedbackMessage });
        }
        setInput("");
        return;
      }
    }

    setInput("");
    onSend(content);
  }, [input, threadId, agentId, onSend, appendMessage, activatePanel, clearThread]);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    slash.updateFromInput(val);

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface-chat">
      <div className="max-w-[72ch] mx-auto px-4 sm:px-6 py-4">
        <div className="relative">
          {pendingSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-1.5 px-1">
              <span className="font-mono text-2xs text-faint select-none mr-0.5">
                {t("composer.skills")}:
              </span>
              {pendingSkills.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs text-amber border border-amber/30 bg-amber/5"
                >
                  /{name}
                  <button
                    onClick={() => removePendingSkill(name)}
                    className="text-faint hover:text-ink transition-colors leading-none"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <span className="absolute left-3 top-3 font-mono text-xs text-muted select-none pointer-events-none">
            {isWorking ? "···" : ">"}
          </span>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isWorking ? t("composer.working") : t("composer.placeholder")}
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

          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            {isWorking ? (
              <button
                onClick={onInterrupt}
                className="group flex items-center gap-1.5 px-2.5 py-1 font-mono text-2xs text-vermilion border border-vermilion/20 rounded hover:bg-vermilion/8 transition-colors"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-vermilion group-hover:animate-pulse" />
                Esc
              </button>
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

        <div className="flex items-center justify-between mt-2 px-1 font-mono text-2xs text-muted cc-num">
          <span className="truncate max-w-[50%]">{cwd}</span>
          <span>{model}</span>
        </div>
      </div>
    </div>
  );
}
