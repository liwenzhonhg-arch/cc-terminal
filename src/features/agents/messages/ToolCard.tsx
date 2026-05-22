import { useState } from "react";
import type { Message } from "@/store/agents";
import { useT } from "@/i18n";

export function ToolCard({ message }: { message: Message }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const raw = message.raw as Record<string, unknown> | undefined;
  const toolName = (raw?.name as string) ?? "Tool";
  const toolInput = (raw?.input as Record<string, unknown>) ?? {};

  let detail = "";
  let body = "";

  switch (toolName) {
    case "Write":
    case "Read":
      detail = (toolInput.file_path as string) ?? "";
      body = (toolInput.content as string) ?? "";
      break;
    case "Edit":
      detail = (toolInput.file_path as string) ?? "";
      body = toolInput.new_string
        ? `- ${(toolInput.old_string as string) ?? ""}\n+ ${toolInput.new_string as string}`
        : JSON.stringify(toolInput, null, 2);
      break;
    case "Bash":
    case "PowerShell":
      detail = ((toolInput.command as string) ?? "").split("\n")[0].slice(0, 60);
      body = (toolInput.command as string) ?? "";
      break;
    case "Glob":
    case "Grep":
      detail = (toolInput.pattern as string) ?? "";
      body = JSON.stringify(toolInput, null, 2);
      break;
    default:
      body = JSON.stringify(toolInput, null, 2);
  }

  const icon =
    toolName === "Bash" || toolName === "PowerShell"
      ? "$"
      : toolName === "Read" || toolName === "Glob" || toolName === "Grep"
        ? "?"
        : toolName === "Edit" || toolName === "Write"
          ? "~"
          : ">";

  return (
    <div className="mb-3 group">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 py-1 text-left hover:bg-surface-raised/40 -mx-1 px-1 rounded transition-colors"
      >
        <span className="font-mono text-2xs text-amber/70 w-3 text-center shrink-0 select-none">
          {icon}
        </span>
        <span className="font-mono text-xs text-ink/80 font-medium">
          {toolName}
        </span>
        {detail && (
          <span className="font-mono text-2xs text-muted truncate ml-1">
            {detail}
          </span>
        )}
        <span className="ml-auto font-mono text-2xs text-faint opacity-0 group-hover:opacity-100 transition-opacity select-none">
          {open ? t("tool.fold") : t("tool.peek")}
        </span>
      </button>

      {open && body && (
        <div className="mt-1 ml-[18px] border-l border-border/60 pl-3">
          <pre className="py-2.5 px-3 text-xs font-mono text-ink/85 bg-surface-raised rounded overflow-x-auto max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
            {body}
          </pre>
        </div>
      )}
    </div>
  );
}
