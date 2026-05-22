import { TokenGauge } from "./TokenGauge";
import { ThemeToggle } from "./ThemeToggle";

type StatusBarProps = {
  tokens?: { input: number | null; output: number | null; cache: number | null };
};

export function StatusBar({
  tokens = { input: null, output: null, cache: null },
}: StatusBarProps) {
  return (
    <header className="flex items-center justify-between px-5 h-10 border-b-2 border-border bg-surface">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-serif text-base text-ink shrink-0">
          cc-terminal
        </span>
        <span className="font-mono text-2xs uppercase tracking-operator text-muted cc-num shrink-0">
          v0.0.1
        </span>
      </div>

      <div className="flex items-center gap-4">
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
