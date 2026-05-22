import { useEffect, useState } from "react";
import { useConsoleStore } from "@/store/console";
import { useAgentStore } from "@/store/agents";
import { ResizeDivider } from "@/components/ResizeDivider";
import { useT } from "@/i18n";

const SOURCE_CLASS: Record<string, string> = {
  global: "text-faint",
  project: "text-amber/70",
  "project-local": "text-moss/70",
};

export function McpPanelContent() {
  const t = useT();
  const servers = useConsoleStore((s) => s.mcpServers);
  const loading = useConsoleStore((s) => s.mcpLoading);
  const selectedMcp = useConsoleStore((s) => s.selectedMcp);
  const loadMcpServers = useConsoleStore((s) => s.loadMcpServers);
  const selectMcp = useConsoleStore((s) => s.selectMcp);

  const threads = useAgentStore((s) => s.threads);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const cwd = activeThreadId ? threads[activeThreadId]?.cwd : undefined;

  useEffect(() => {
    loadMcpServers(cwd);
  }, [loadMcpServers, cwd]);

  const [detailHeight, setDetailHeight] = useState(200);
  const selected = selectedMcp ? servers.find((s) => s.name === selectedMcp) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber/70 font-mono text-xs select-none">{"⊞"}</span>
          <span className="font-serif text-sm text-ink">{t("mcp.title")}</span>
          <span className="font-mono text-2xs text-faint">{servers.length}</span>
        </div>
        <button
          onClick={() => loadMcpServers(cwd)}
          className="font-mono text-2xs text-muted hover:text-ink transition-colors px-1.5 py-0.5"
          title={t("mcp.refresh")}
        >
          {"↻"}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 font-mono text-2xs text-faint animate-pulse">
            {t("mcp.reading")}
          </div>
        )}

        {!loading && servers.length === 0 && (
          <div className="px-3 py-6 font-mono text-2xs text-faint text-center">
            {t("mcp.noServers")}
          </div>
        )}

        {servers.map((server, idx) => (
          <button
            key={`${server.name}-${server.source}-${idx}`}
            onClick={() => selectMcp(selectedMcp === server.name ? null : server.name)}
            className={`w-full text-left px-3 py-2.5 border-b border-border/20 transition-colors ${
              selectedMcp === server.name
                ? "bg-border/60 text-ink"
                : "text-muted hover:text-ink hover:bg-border/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-amber/50 text-2xs select-none">{"⊞"}</span>
                <span className="font-mono text-xs truncate">{server.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className={`font-mono text-2xs ${SOURCE_CLASS[server.source] ?? "text-faint"}`}>
                  {server.source === "global" ? t("mcp.global")
                    : server.source === "project" ? t("mcp.project")
                    : t("mcp.projectLocal")}
                </span>
                <span className="font-mono text-2xs text-moss/70 border border-moss/30 px-1 rounded-sm">
                  {t("mcp.on")}
                </span>
              </div>
            </div>
            <div className="font-mono text-2xs text-faint mt-0.5 truncate pl-4">
              {server.command
                ? `${server.command} ${server.args.join(" ")}`
                : server.url ?? "—"}
            </div>
            <div className="flex items-center gap-2 mt-0.5 pl-4">
              <span className="font-mono text-2xs text-faint">{server.transport}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail */}
      {selected && (
        <>
        <ResizeDivider direction="horizontal" onResize={(d) => setDetailHeight((h) => Math.max(100, h - d))} />
        <div className="shrink-0 overflow-y-auto" style={{ height: detailHeight }}>
          <div className="px-3 py-2">
            <div className="font-mono text-xs text-ink font-semibold">{selected.name}</div>
            <div className="mt-2 space-y-1.5">
              <DetailRow label={t("mcp.transport")} value={selected.transport} />
              {selected.command && (
                <DetailRow label={t("mcp.command")} value={selected.command} />
              )}
              {selected.args.length > 0 && (
                <DetailRow label={t("mcp.args")} value={selected.args.join(" ")} />
              )}
              {selected.url && <DetailRow label={t("mcp.url")} value={selected.url} />}
              {selected.env && (
                <div>
                  <span className="font-mono text-2xs text-faint">{t("mcp.env")}: </span>
                  <pre className="font-mono text-2xs text-muted mt-0.5 whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.env, null, 2)}
                  </pre>
                </div>
              )}
              <DetailRow
                label={t("mcp.source")}
                value={
                  selected.source === "global" ? t("mcp.global")
                    : selected.source === "project" ? t("mcp.project")
                    : t("mcp.projectLocal")
                }
              />
            </div>
          </div>
        </div>
        </>
      )}

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-2 shrink-0">
        <div className="font-mono text-2xs text-faint">
          ~/.claude/settings.json
        </div>
        <div className="font-mono text-2xs text-vermilion/60 mt-0.5">
          {"⚠"} {t("mcp.writesRequireConfirm")}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-2xs text-faint">{label}: </span>
      <span className="font-mono text-2xs text-muted break-all">{value}</span>
    </div>
  );
}
