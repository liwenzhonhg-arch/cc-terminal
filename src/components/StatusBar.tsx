import { TokenGauge } from "./TokenGauge";
import { ThemeToggle } from "./ThemeToggle";
import { useAgentStore } from "@/store/agents";

type StatusBarProps = {
  tokens?: { input: number | null; output: number | null; cache: number | null };
};

export function StatusBar({
  tokens = { input: null, output: null, cache: null },
}: StatusBarProps) {
  const thread = useAgentStore((s) =>
    s.activeThreadId ? s.threads[s.activeThreadId] : null
  );
  const status = thread?.status ?? "idle";
  const statusColor =
    status === "thinking" || status === "tool_use"
      ? "text-amber cc-dot-pulse"
      : status === "done"
        ? "text-moss"
        : status === "error" || status === "crashed"
          ? "text-vermilion"
          : "text-faint";

  return (
    <header className="flex items-center h-9 px-4 bg-cc-bg border-b border-border shrink-0 select-none gap-3">
      <span className="font-serif text-[13px] text-ink tracking-wide">
        cc-terminal
      </span>
      <span className="w-px h-3.5 bg-border" />
      <span className="font-mono text-2xs text-faint cc-num">
        {thread?.model ?? "claude-opus-4-6"}
      </span>
      <span className="w-px h-3.5 bg-border" />
      <span className={`font-mono text-2xs ${statusColor}`}>
        ● {status}
      </span>

      <div className="ml-auto flex items-center gap-4">
        <TokenGauge
          variant="mini"
          input={tokens.input}
          output={tokens.output}
          cache={tokens.cache}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
