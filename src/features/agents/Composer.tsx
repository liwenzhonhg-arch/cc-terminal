import { useState, useRef, useCallback } from "react";
import { useAgentStore } from "@/store/agents";
import { useConsoleStore } from "@/store/console";
import { useT } from "@/i18n";
import { useSlashCommands } from "@/lib/useSlashCommands";
import { executeOrForward, type CommandContext } from "@/lib/commands";
import { SlashCommandPopup } from "@/components/SlashCommandPopup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <div className="max-w-[680px] mx-auto px-6 py-4">
        <div className="relative">
          {pendingSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
              <span className="font-mono text-[10px] text-faint select-none uppercase tracking-operator">
                {t("composer.skills")}
              </span>
              {pendingSkills.map((name) => (
                <Badge key={name} variant="default" className="gap-1">
                  /{name}
                  <button
                    onClick={() => removePendingSkill(name)}
                    className="text-amber/60 hover:text-ink transition-colors leading-none"
                    type="button"
                  >
                    x
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <span className="absolute left-3.5 top-3 font-mono text-[13px] text-faint select-none pointer-events-none">
            {isWorking ? "..." : ">"}
          </span>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isWorking ? t("composer.working") : t("composer.placeholder")}
            rows={1}
            disabled={isWorking}
            className="w-full bg-surface-raised border border-border rounded-sm pl-9 pr-24 py-3 font-sans text-[14px] text-ink placeholder:text-faint focus:outline-none focus:border-amber/50 focus:shadow-[0_0_0_1px_rgb(var(--cc-amber)/0.2)] disabled:opacity-40 resize-none min-h-[44px] max-h-[160px] transition-all duration-200"
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

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {isWorking ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onInterrupt}
                className="text-vermilion border-vermilion/30 hover:bg-vermilion/10 gap-1.5"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-vermilion animate-pulse" />
                Esc
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-faint hover:text-muted text-[10px]">
                  Ctrl+K
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="disabled:opacity-0"
                >
                  Enter
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1 font-mono text-[10px] text-faint cc-num">
          <span className="truncate max-w-[55%]">{cwd}</span>
          <span>{model}</span>
        </div>
      </div>
    </div>
  );
}
