import { useState } from "react";
import type { Message } from "@/store/agents";

export function ToolResult({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const raw = message.raw as Record<string, unknown> | undefined;
  const isError = raw?.isError === true;
  const preview = message.content.slice(0, 120);
  const hasMore = message.content.length > 120;

  return (
    <div className="mb-3 ml-[18px]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 py-0.5 text-left"
      >
        <span className={`font-mono text-2xs shrink-0 select-none ${isError ? "text-vermilion" : "text-moss"}`}>
          {isError ? "✕" : "✓"}
        </span>
        <span className="font-mono text-2xs text-muted truncate">
          {open ? "result" : preview}{hasMore && !open ? "…" : ""}
        </span>
        {hasMore && (
          <span className="ml-auto font-mono text-2xs text-faint select-none">
            {open ? "fold" : "peek"}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1 border-l border-border/60 pl-3">
          <pre className="py-2.5 px-3 text-xs font-mono text-ink/85 bg-surface-raised rounded overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </pre>
        </div>
      )}
    </div>
  );
}
