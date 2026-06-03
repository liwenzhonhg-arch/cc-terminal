import { useCallback, useEffect, useState } from "react";
import { useAgentStore } from "@/store/agents";
import { useSettingsStore } from "@/store/settings";
import { COMMANDS, type CommandContext, executeOrForward } from "@/lib/commands";
import { useT } from "@/i18n";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  MessageSquare,
  Plus,
  Sun,
  Moon,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const threads = useAgentStore((s) => s.threads);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const openThreadTab = useAgentStore((s) => s.openThreadTab);
  const addThread = useAgentStore((s) => s.addThread);
  const projects = useAgentStore((s) => s.projects);
  const activeProjectId = useAgentStore((s) => s.activeProjectId);
  const appendMessage = useAgentStore((s) => s.appendMessage);
  const activatePanel = useAgentStore((s) => s.activatePanel);
  const clearThread = useAgentStore((s) => s.clearThread);

  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  const threadList = Object.values(threads);
  const otherThreads = threadList.filter((th) => th.id !== activeThreadId);

  const runCommand = useCallback(async (name: string) => {
    setOpen(false);
    const ctx: CommandContext = {
      threadId: activeThreadId,
      agentId: activeThreadId ? threads[activeThreadId]?.agentId ?? null : null,
      mode: "thread",
      appendMessage: (msg) => {
        if (!activeThreadId) return;
        appendMessage(activeThreadId, {
          id: crypto.randomUUID(),
          role: msg.role,
          content: msg.content,
          timestamp: Date.now(),
        });
      },
      activatePanel,
      clearThread,
    };
    const result = await executeOrForward(`/${name}`, ctx);
    if (result.handled && result.feedbackMessage) {
      ctx.appendMessage({ role: "command", content: result.feedbackMessage });
    }
  }, [activeThreadId, threads, appendMessage, activatePanel, clearThread]);

  const localCommands = COMMANDS.filter((c) => c.category === "local");
  const forwardCommands = COMMANDS.filter((c) => c.category === "forward");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("cmdPalette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("cmdPalette.noResults")}</CommandEmpty>

        {otherThreads.length > 0 && (
          <CommandGroup heading={t("cmdPalette.threads")}>
            {otherThreads.slice(0, 8).map((th) => (
              <CommandItem
                key={th.id}
                onSelect={() => { openThreadTab(th.id); setOpen(false); }}
              >
                <MessageSquare className="h-3.5 w-3.5 text-faint" />
                <span className="truncate">{th.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading={t("cmdPalette.actions")}>
          <CommandItem onSelect={() => {
            const project = activeProjectId
              ? projects[activeProjectId]
              : Object.values(projects)[0];
            if (project) addThread(project.id, project.rootPath);
            setOpen(false);
          }}>
            <Plus className="h-3.5 w-3.5 text-faint" />
            <span>{t("cmdPalette.newThread")}</span>
            <CommandShortcut>Ctrl+N</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => { toggleTheme(); setOpen(false); }}>
            {theme === "dark"
              ? <Sun className="h-3.5 w-3.5 text-faint" />
              : <Moon className="h-3.5 w-3.5 text-faint" />
            }
            <span>{t("cmdPalette.toggleTheme")}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("cmdPalette.commands")}>
          {localCommands.map((cmd) => (
            <CommandItem key={cmd.name} onSelect={() => runCommand(cmd.name)}>
              <span className="text-amber/70 w-4 text-center shrink-0 select-none text-2xs">
                {cmd.icon}
              </span>
              <span>/{cmd.name}</span>
              <span className="text-2xs text-faint truncate">{t(cmd.descKey)}</span>
            </CommandItem>
          ))}
          {forwardCommands.map((cmd) => (
            <CommandItem key={cmd.name} onSelect={() => runCommand(cmd.name)}>
              <span className="text-amber/70 w-4 text-center shrink-0 select-none text-2xs">
                {cmd.icon}
              </span>
              <span>/{cmd.name}</span>
              <span className="text-2xs text-faint truncate">{t(cmd.descKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
