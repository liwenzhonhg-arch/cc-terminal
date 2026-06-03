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
          : "▸";

  return (
    <div className="mb-3 group">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 py-2 px-3 rounded-sm border cursor-pointer transition-all duration-150 text-left ${
          open
            ? "bg-surface-raised border-border-strong"
            : "bg-surface-raised/60 border-border hover:border-amber/40"
        }`}
      >
        <span className="font-mono text-2xs text-amber w-3 text-center shrink-0 select-none">
          {icon}
        </span>
        <span className="font-mono text-[11px] text-ink font-medium">
          {toolName}
        </span>
        {detail && (
          <span className="font-mono text-[10px] text-faint truncate flex-1 ml-1">
            {detail}
          </span>
        )}
        <span className="font-mono text-[10px] text-faint opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">
          {open ? t("tool.fold") : t("tool.peek")}
        </span>
      </button>

      {open && body && (
        <div className="mt-0 border-x border-b border-border-strong rounded-b-sm overflow-hidden">
          <pre className="py-2.5 px-3 text-[11px] font-mono text-muted bg-surface-raised overflow-x-auto max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
            {body.split("\n").map((line, i) => {
              let cls = "";
              if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-moss";
              else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-vermilion";
              else if (line.startsWith("@@")) cls = "text-cyan/70";
              return <div key={i} className={cls}>{line}</div>;
            })}
          </pre>
        </div>
      )}
    </div>
  );
}
