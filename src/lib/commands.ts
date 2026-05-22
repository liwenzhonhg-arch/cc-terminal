import { invoke } from "@tauri-apps/api/core";
import type { PanelId } from "@/store/agents";
import { t } from "@/i18n";
import type { TranslationKey } from "@/i18n";

export type CommandCategory = "local" | "forward" | "deferred";

export type SlashCommand = {
  name: string;
  descKey: TranslationKey;
  category: CommandCategory;
  icon: string;
};

export type CommandContext = {
  threadId: string | null;
  agentId: string | null;
  mode: "thread" | "team";
  appendMessage: (msg: { role: "command"; content: string }) => void;
  activatePanel: (panelId: PanelId) => void;
  clearThread: (threadId: string) => void;
};

export type CommandResult = {
  handled: boolean;
  feedbackMessage?: string;
};

export const COMMANDS: SlashCommand[] = [
  { name: "clear",       descKey: "cmd.clear.desc",       category: "local",    icon: "×" },
  { name: "cost",        descKey: "cmd.cost.desc",        category: "local",    icon: "$" },
  { name: "help",        descKey: "cmd.help.desc",        category: "local",    icon: "?" },
  { name: "skills",      descKey: "cmd.skills.desc",      category: "local",    icon: "◇" },
  { name: "mcp",         descKey: "cmd.mcp.desc",         category: "local",    icon: "⊞" },
  { name: "plugins",     descKey: "cmd.plugins.desc",     category: "local",    icon: "▣" },
  { name: "hooks",       descKey: "cmd.hooks.desc",       category: "local",    icon: "↪" },
  { name: "config",      descKey: "cmd.config.desc",      category: "local",    icon: "⚙" },
  { name: "compact",     descKey: "cmd.compact.desc",     category: "forward",  icon: "⊟" },
  { name: "review",      descKey: "cmd.review.desc",      category: "forward",  icon: "◆" },
  { name: "init",        descKey: "cmd.init.desc",        category: "forward",  icon: "▸" },
  { name: "model",       descKey: "cmd.model.desc",       category: "deferred", icon: "◎" },
  { name: "permissions", descKey: "cmd.permissions.desc", category: "deferred", icon: "⊘" },
  { name: "memory",      descKey: "cmd.memory.desc",      category: "deferred", icon: "▤" },
  { name: "login",       descKey: "cmd.login.desc",       category: "deferred", icon: "→" },
  { name: "doctor",      descKey: "cmd.doctor.desc",      category: "deferred", icon: "+" },
];

export function findCommand(input: string): SlashCommand | null {
  const match = input.match(/^\/(\S+)/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  return COMMANDS.find((c) => c.name === name) ?? null;
}

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return COMMANDS.filter((c) => c.name.startsWith(q));
}

async function executeCommand(
  command: SlashCommand,
  _fullInput: string,
  ctx: CommandContext,
): Promise<CommandResult> {
  if (command.category === "deferred") {
    return {
      handled: true,
      feedbackMessage: t("cmd.notAvailable", { name: command.name }),
    };
  }

  if (command.category === "forward") {
    if (ctx.mode === "team") {
      return {
        handled: true,
        feedbackMessage: t("cmd.notInTeam", { name: command.name }),
      };
    }
    if (!ctx.agentId) {
      return {
        handled: true,
        feedbackMessage: t("cmd.needsAgent", { name: command.name }),
      };
    }
    return { handled: false };
  }

  switch (command.name) {
    case "clear": {
      if (ctx.agentId) {
        try {
          await invoke("kill_agent", { agentId: ctx.agentId });
        } catch { /* agent may already be dead */ }
      }
      if (ctx.threadId) {
        ctx.clearThread(ctx.threadId);
      } else {
        ctx.clearThread("");
      }
      return { handled: true, feedbackMessage: t("cmd.cleared") };
    }

    case "cost":
      ctx.activatePanel("cost");
      return { handled: true, feedbackMessage: t("cmd.costOpened") };

    case "config":
      ctx.activatePanel("settings");
      return { handled: true, feedbackMessage: t("cmd.configOpened") };

    case "help": {
      const lines = COMMANDS
        .filter((c) => c.category !== "deferred")
        .map((c) => `  /${c.name.padEnd(12)} ${t(c.descKey)}`)
        .join("\n");
      const deferred = COMMANDS
        .filter((c) => c.category === "deferred")
        .map((c) => `  /${c.name.padEnd(12)} ${t(c.descKey)}`)
        .join("\n");
      return {
        handled: true,
        feedbackMessage: `${t("cmd.available")}:\n${lines}\n\n${t("cmd.comingSoon")}:\n${deferred}`,
      };
    }

    case "skills":
      ctx.activatePanel("skills");
      return { handled: true, feedbackMessage: t("cmd.skillsOpened") };

    case "mcp":
      ctx.activatePanel("mcp");
      return { handled: true, feedbackMessage: t("cmd.mcpOpened") };

    case "plugins":
      ctx.activatePanel("plugins");
      return { handled: true, feedbackMessage: t("cmd.pluginsOpened") };

    case "hooks":
      ctx.activatePanel("hooks");
      return { handled: true, feedbackMessage: t("cmd.hooksOpened") };

    default:
      return { handled: false };
  }
}

export async function executeOrForward(
  input: string,
  ctx: CommandContext,
): Promise<CommandResult> {
  const command = findCommand(input);

  if (command) {
    return executeCommand(command, input, ctx);
  }

  if (input.startsWith("/")) {
    if (ctx.mode === "team" || !ctx.agentId) {
      return {
        handled: true,
        feedbackMessage: t("cmd.unknown"),
      };
    }
    return { handled: false };
  }

  return { handled: false };
}
