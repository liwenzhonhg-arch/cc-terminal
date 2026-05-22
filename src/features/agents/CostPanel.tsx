import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAgentStore } from "@/store/agents";
import { useT, t } from "@/i18n";
import { formatTokenCount } from "@/lib/fmt";

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
  daily: DailyUsage[];
};

function getSessionResetLabel(): string {
  const reset = new Date(Date.now() + 5 * 3600_000);
  const time = `${reset.getHours()}:${String(reset.getMinutes()).padStart(2, "0")}`;
  return t("cost.resetsAt", { time });
}

function getWeeklyResetLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const reset = new Date(now.getTime() + daysUntilSunday * 86400_000);
  reset.setHours(23, 0, 0, 0);
  const date = `${reset.getMonth() + 1}/${reset.getDate()}`;
  const time = `${reset.getHours()}`;
  return t("cost.resetsAtDate", { date, time });
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

  const sessionUsage = Object.values(threads).reduce(
    (acc, th) => ({
      input: acc.input + th.usage.input,
      output: acc.output + th.usage.output,
      cacheRead: acc.cacheRead + th.usage.cacheRead,
      cacheWrite: acc.cacheWrite + th.usage.cacheWrite,
      costUsd: acc.costUsd + th.usage.costUsd,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 }
  );

  const chartData = (summary?.daily ?? []).map((d) => ({
    date: d.date.slice(5),
    tokens: d.input + d.output,
    cost: d.costUsd,
  }));

  return (
    <>
      {/* Quota */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <div className="font-mono text-2xs text-muted uppercase tracking-operator mb-3">
          {tc("cost.quota")}
        </div>

        <WindowBar
          label={tc("cost.currentSession")}
          input={summary?.window5hInput ?? 0}
          output={summary?.window5hOutput ?? 0}
          cacheRead={summary?.window5hCacheRead ?? 0}
          cacheWrite={summary?.window5hCacheWrite ?? 0}
          costUsd={summary?.window5hCostUsd ?? 0}
          resetLabel={getSessionResetLabel()}
        />

        <WindowBar
          label={tc("cost.currentWeek")}
          input={summary?.weekInput ?? 0}
          output={summary?.weekOutput ?? 0}
          cacheRead={summary?.weekCacheRead ?? 0}
          cacheWrite={summary?.weekCacheWrite ?? 0}
          costUsd={summary?.weekCostUsd ?? 0}
          resetLabel={getWeeklyResetLabel()}
        />
      </div>

      {/* Current app session */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <div className="font-mono text-2xs text-muted uppercase tracking-operator mb-2">
          {tc("cost.thisSession")}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <StatRow label={tc("cost.input")} value={formatTokenCount(sessionUsage.input)} />
          <StatRow label={tc("cost.output")} value={formatTokenCount(sessionUsage.output)} />
          <StatRow label={tc("cost.cacheRead")} value={formatTokenCount(sessionUsage.cacheRead)} />
          <StatRow label={tc("cost.cacheWrite")} value={formatTokenCount(sessionUsage.cacheWrite)} />
        </div>
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
          <span className="font-mono text-2xs text-muted">{tc("cost.cost")}</span>
          <span className={`font-mono text-sm font-medium cc-num ${sessionUsage.costUsd > 1 ? "text-vermilion" : "text-ink"}`}>
            ${sessionUsage.costUsd.toFixed(4)}
          </span>
        </div>
      </div>

      {/* 30-day historical */}
      <div className="px-4 py-3 shrink-0">
        <div className="font-mono text-2xs text-muted uppercase tracking-operator mb-2">
          {tc("cost.last30Days")}
        </div>

        {loading && (
          <div className="font-mono text-2xs text-faint animate-pulse py-4">
            {tc("cost.loading")}
          </div>
        )}

        {summary && !loading && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
              <StatRow label={tc("cost.input")} value={formatTokenCount(summary.totalInput)} />
              <StatRow label={tc("cost.output")} value={formatTokenCount(summary.totalOutput)} />
              <StatRow label={tc("cost.cacheRead")} value={formatTokenCount(summary.totalCacheRead)} />
              <StatRow label={tc("cost.cacheWrite")} value={formatTokenCount(summary.totalCacheWrite)} />
            </div>
            <div className="mb-4 pt-2 border-t border-border/30 flex items-center justify-between">
              <span className="font-mono text-2xs text-muted">{tc("cost.totalCost")}</span>
              <span className={`font-mono text-sm font-medium cc-num ${summary.totalCostUsd > 10 ? "text-vermilion" : "text-ink"}`}>
                ${summary.totalCostUsd.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && !loading && (
        <div className="px-4 pb-4 shrink-0">
          <div className="font-mono text-2xs text-muted uppercase tracking-operator mb-2">
            {tc("cost.dailyTokens")}
          </div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--cc-amber))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgb(var(--cc-amber))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "rgb(var(--cc-muted))" }}
                  axisLine={{ stroke: "rgb(var(--cc-border))" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgb(var(--cc-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--cc-surface))",
                    border: "1px solid rgb(var(--cc-border))",
                    borderRadius: 2,
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                  labelStyle={{ color: "rgb(var(--cc-ink))" }}
                  formatter={(value) => [formatTokenCount(value as number), tc("cost.tokens")]}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="rgb(var(--cc-amber))"
                  strokeWidth={1.5}
                  fill="url(#tokenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="font-mono text-2xs text-muted uppercase tracking-operator mt-4 mb-2">
            {tc("cost.dailyCost")}
          </div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--cc-vermilion))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgb(var(--cc-vermilion))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "rgb(var(--cc-muted))" }}
                  axisLine={{ stroke: "rgb(var(--cc-border))" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgb(var(--cc-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(1)}`}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--cc-surface))",
                    border: "1px solid rgb(var(--cc-border))",
                    borderRadius: 2,
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                  labelStyle={{ color: "rgb(var(--cc-ink))" }}
                  formatter={(value) => [`$${(value as number).toFixed(4)}`, tc("cost.cost")]}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="rgb(var(--cc-vermilion))"
                  strokeWidth={1.5}
                  fill="url(#costGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}

function WindowBar({
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
  resetLabel: string;
}) {
  const total = input + output + cacheRead + cacheWrite;
  const inputPct = total > 0 ? (input / total) * 100 : 0;
  const outputPct = total > 0 ? (output / total) * 100 : 0;
  const cacheReadPct = total > 0 ? (cacheRead / total) * 100 : 0;
  const cacheWritePct = total > 0 ? (cacheWrite / total) * 100 : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-ink">{label}</span>
        <span className="font-mono text-xs text-ink cc-num">{formatTokenCount(total)}</span>
      </div>

      {/* Stacked token bar */}
      <div className="relative h-4 w-full bg-border/60 rounded-sm overflow-hidden flex">
        {inputPct > 0 && (
          <div
            className="h-full bg-amber"
            style={{ width: `${inputPct}%` }}
            title={`Input: ${formatTokenCount(input)}`}
          />
        )}
        {outputPct > 0 && (
          <div
            className="h-full bg-vermilion/70"
            style={{ width: `${outputPct}%` }}
            title={`Output: ${formatTokenCount(output)}`}
          />
        )}
        {cacheReadPct > 0 && (
          <div
            className="h-full bg-moss/60"
            style={{ width: `${cacheReadPct}%` }}
            title={`Cache Read: ${formatTokenCount(cacheRead)}`}
          />
        )}
        {cacheWritePct > 0 && (
          <div
            className="h-full bg-[rgb(var(--cc-muted))]/40"
            style={{ width: `${cacheWritePct}%` }}
            title={`Cache Write: ${formatTokenCount(cacheWrite)}`}
          />
        )}
      </div>

      {/* Legend + cost + reset */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 font-mono text-2xs text-muted">
            <span className="inline-block w-1.5 h-1.5 bg-amber rounded-px" />{t("cost.in")}
          </span>
          <span className="flex items-center gap-0.5 font-mono text-2xs text-muted">
            <span className="inline-block w-1.5 h-1.5 bg-vermilion/70 rounded-px" />{t("cost.out")}
          </span>
          <span className="flex items-center gap-0.5 font-mono text-2xs text-muted">
            <span className="inline-block w-1.5 h-1.5 bg-moss/60 rounded-px" />{t("token.cache")}
          </span>
        </div>
        <span className="font-mono text-2xs text-faint cc-num">${costUsd.toFixed(2)}</span>
      </div>
      <div className="font-mono text-2xs text-faint mt-0.5">{resetLabel}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-2xs text-muted">{label}</span>
      <span className="font-mono text-xs text-ink cc-num">{value}</span>
    </div>
  );
}
