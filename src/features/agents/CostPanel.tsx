import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "@/store/agents";
import { useT, t } from "@/i18n";
import { formatTokenCount, formatDuration } from "@/lib/fmt";

type DailyUsage = {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
};

type UsageSummary = {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCostUsd: number;
  window5hCostUsd: number;
  window5hInput: number;
  window5hOutput: number;
  window5hCacheRead: number;
  window5hCacheWrite: number;
  weekCostUsd: number;
  weekInput: number;
  weekOutput: number;
  weekCacheRead: number;
  weekCacheWrite: number;
  weekSonnetCostUsd: number;
  weekSonnetInput: number;
  weekSonnetOutput: number;
  weekSonnetCacheRead: number;
  weekSonnetCacheWrite: number;
  daily: DailyUsage[];
};

function getTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

function getSessionResetLabel(): string {
  const reset = new Date(Date.now() + 5 * 3600_000);
  const time = reset.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return t("cost.resetsAt", { time, tz: getTz() });
}

function getWeeklyResetLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const reset = new Date(now.getTime() + daysUntilSunday * 86400_000);
  reset.setHours(23, 0, 0, 0);
  const date = `${reset.toLocaleString("en", { month: "short" })} ${reset.getDate()}, ${reset.getHours()}${reset.getMinutes() > 0 ? ":" + String(reset.getMinutes()).padStart(2, "0") : ""}${reset.getHours() >= 12 ? "pm" : "am"}`;
  return t("cost.resetsAtDate", { date, tz: getTz() });
}

export function CostPanelContent() {
  const tc = useT();
  const threads = useAgentStore((s) => s.threads);

  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    invoke<UsageSummary>("get_usage_stats", { days: 30 })
      .then(setSummary)
      .catch((err) => console.error("Failed to load usage:", err))
      .finally(() => setLoading(false));
  }, []);

  const threadList = Object.values(threads);
  const sessionUsage = threadList.reduce(
    (acc, th) => ({
      input: acc.input + th.usage.input,
      output: acc.output + th.usage.output,
      cacheRead: acc.cacheRead + th.usage.cacheRead,
      cacheWrite: acc.cacheWrite + th.usage.cacheWrite,
      costUsd: acc.costUsd + th.usage.costUsd,
      durationApiMs: acc.durationApiMs + th.usage.durationApiMs,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, durationApiMs: 0 }
  );

  const earliestCreated = threadList.length > 0
    ? Math.min(...threadList.map((t) => t.createdAt))
    : Date.now();
  const wallDurationMs = Date.now() - earliestCreated;

  return (
    <div className="flex flex-col h-full overflow-y-auto font-mono text-xs">
      {/* Session summary */}
      <div className="px-4 pt-4 pb-3 border-b border-border/50">
        <div className="text-sm font-semibold text-ink mb-3">
          {tc("cost.session")}
        </div>
        <div className="space-y-1">
          <SummaryRow label={tc("cost.totalCostLabel")} value={`$${sessionUsage.costUsd.toFixed(4)}`} highlight={sessionUsage.costUsd > 1} />
          <SummaryRow label={tc("cost.durationApi")} value={formatDuration(sessionUsage.durationApiMs)} />
          <SummaryRow label={tc("cost.durationWall")} value={formatDuration(wallDurationMs)} />
          <SummaryRow
            label="Usage"
            value={tc("cost.usageLine", {
              input: formatTokenCount(sessionUsage.input),
              output: formatTokenCount(sessionUsage.output),
              cacheRead: formatTokenCount(sessionUsage.cacheRead),
              cacheWrite: formatTokenCount(sessionUsage.cacheWrite),
            })}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 py-6 text-2xs text-faint animate-pulse">
          {tc("cost.loading")}
        </div>
      )}

      {/* Current session (5h window) */}
      {summary && !loading && (
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <UsageProgressBar
            label={tc("cost.currentSession")}
            input={summary.window5hInput}
            output={summary.window5hOutput}
            cacheRead={summary.window5hCacheRead}
            cacheWrite={summary.window5hCacheWrite}
            costUsd={summary.window5hCostUsd}
            resetLabel={getSessionResetLabel()}
          />
        </div>
      )}

      {/* Current week (all models) */}
      {summary && !loading && (
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <UsageProgressBar
            label={tc("cost.currentWeek")}
            input={summary.weekInput}
            output={summary.weekOutput}
            cacheRead={summary.weekCacheRead}
            cacheWrite={summary.weekCacheWrite}
            costUsd={summary.weekCostUsd}
            resetLabel={getWeeklyResetLabel()}
          />
        </div>
      )}

      {/* Current week (Sonnet only) */}
      {summary && !loading && (
        <div className="px-4 pt-4 pb-3">
          <UsageProgressBar
            label={tc("cost.currentWeekSonnet")}
            input={summary.weekSonnetInput}
            output={summary.weekSonnetOutput}
            cacheRead={summary.weekSonnetCacheRead}
            cacheWrite={summary.weekSonnetCacheWrite}
            costUsd={summary.weekSonnetCostUsd}
          />
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-2xs">
      <span className="text-muted whitespace-nowrap">{label}:</span>
      <span className={`cc-num ${highlight ? "text-vermilion" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function UsageProgressBar({
  label,
  input,
  output,
  cacheRead,
  cacheWrite,
  costUsd,
  resetLabel,
}: {
  label: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  resetLabel?: string;
}) {
  const total = input + output + cacheRead + cacheWrite;
  const barMax = 10_000_000;
  const fillPct = Math.min((total / barMax) * 100, 100);
  const isHigh = fillPct > 70;

  return (
    <div>
      <div className="text-xs font-semibold text-ink mb-2">{label}</div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1 h-3 bg-border/40 rounded-sm overflow-hidden">
          {total > 0 && (
            <div
              className={`h-full rounded-sm transition-all ${isHigh ? "bg-vermilion" : "bg-amber"}`}
              style={{ width: `${Math.max(fillPct, 1)}%` }}
            />
          )}
        </div>
        <span className="text-2xs text-muted cc-num whitespace-nowrap">
          {formatTokenCount(total)} tokens
        </span>
      </div>

      {/* Cost + Reset label */}
      <div className="flex items-center justify-between mt-0.5">
        {costUsd > 0 ? (
          <span className={`text-2xs cc-num ${costUsd > 5 ? "text-vermilion" : "text-muted"}`}>
            ${costUsd.toFixed(2)}
          </span>
        ) : <span />}
        {resetLabel && (
          <span className="text-2xs text-faint">{resetLabel}</span>
        )}
      </div>
    </div>
  );
}
