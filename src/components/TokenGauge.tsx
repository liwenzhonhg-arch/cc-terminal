import { formatTokenCount as fmt } from "@/lib/fmt";
import { useT } from "@/i18n";

type GaugeProps = {
  input?: number | null;
  output?: number | null;
  cache?: number | null;
  threshold?: number;
  variant?: "mini" | "full";
};

export function TokenGauge({
  input = null,
  output = null,
  cache = null,
  threshold = 200_000,
  variant = "full",
}: GaugeProps) {
  const t = useT();
  const total = (input ?? 0) + (output ?? 0) + (cache ?? 0);
  const over = total > threshold;
  const have = input !== null || output !== null || cache !== null;
  const sum = total || 1;

  const bar = (
    <div
      className="flex h-1 overflow-hidden border border-border"
      style={{ width: variant === "mini" ? 56 : 100, minWidth: 56 }}
    >
      {have ? (
        <>
          <div
            className={over ? "bg-vermilion" : "bg-ink"}
            style={{ width: `${((input ?? 0) / sum) * 100}%` }}
            aria-label="input"
          />
          <div
            className={over ? "bg-vermilion/70" : "bg-ink/60"}
            style={{ width: `${((output ?? 0) / sum) * 100}%` }}
            aria-label="output"
          />
          <div
            className={over ? "bg-vermilion/40" : "bg-amber/70"}
            style={{ width: `${((cache ?? 0) / sum) * 100}%` }}
            aria-label="cache"
          />
        </>
      ) : (
        <div className="w-full bg-border/60" aria-label="empty" />
      )}
    </div>
  );

  if (variant === "mini") {
    return (
      <div className="flex items-center gap-3 font-mono text-2xs cc-num text-muted">
        <span>
          {t("token.input")} <span className="text-ink">{fmt(input)}</span>
        </span>
        <span>
          · {t("token.output")} <span className="text-ink">{fmt(output)}</span>
        </span>
        <span>
          · {t("token.cache")} <span className="text-ink">{fmt(cache)}</span>
        </span>
        {bar}
        <span className={over ? "text-vermilion" : "text-ink"}>
          Σ {fmt(total || null)}
        </span>
      </div>
    );
  }

  return (
    <div className="font-mono text-2xs cc-num">
      <div className="flex items-baseline justify-between mb-1.5 text-muted">
        <span>{t("token.usage")}</span>
        <span className={over ? "text-vermilion" : ""}>
          {fmt(total || null)}
        </span>
      </div>
      {bar}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted">{t("token.input")}</div>
          <div className="text-ink">{fmt(input)}</div>
        </div>
        <div>
          <div className="text-muted">{t("token.output")}</div>
          <div className="text-ink">{fmt(output)}</div>
        </div>
        <div>
          <div className="text-muted">{t("token.cache")}</div>
          <div className="text-ink">{fmt(cache)}</div>
        </div>
      </div>
    </div>
  );
}
