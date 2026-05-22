import { useEffect, useState } from "react";
import { useConsoleStore } from "@/store/console";
import { ResizeDivider } from "@/components/ResizeDivider";
import { openUrl } from "@tauri-apps/plugin-opener";

export function PluginsPanelContent() {
  const plugins = useConsoleStore((s) => s.plugins);
  const loading = useConsoleStore((s) => s.pluginsLoading);
  const selectedPlugin = useConsoleStore((s) => s.selectedPlugin);
  const loadPlugins = useConsoleStore((s) => s.loadPlugins);
  const selectPlugin = useConsoleStore((s) => s.selectPlugin);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const [detailHeight, setDetailHeight] = useState(200);
  const selected = selectedPlugin ? plugins.find((p) => p.name === selectedPlugin) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber/70 font-mono text-xs select-none">▣</span>
          <span className="font-serif text-sm text-ink">Plugins</span>
          <span className="font-mono text-2xs text-faint">{plugins.length}</span>
        </div>
        <button
          onClick={() => loadPlugins()}
          className="font-mono text-2xs text-muted hover:text-ink transition-colors px-1.5 py-0.5"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 font-mono text-2xs text-faint animate-pulse">
            Reading installed plugins...
          </div>
        )}

        {!loading && plugins.length === 0 && (
          <div className="px-3 py-6 font-mono text-2xs text-faint text-center">
            No plugins installed
          </div>
        )}

        {plugins.map((plugin) => (
          <button
            key={plugin.name}
            onClick={() =>
              selectPlugin(selectedPlugin === plugin.name ? null : plugin.name)
            }
            className={`w-full text-left px-3 py-2.5 border-b border-border/20 transition-colors ${
              selectedPlugin === plugin.name
                ? "bg-border/60 text-ink"
                : "text-muted hover:text-ink hover:bg-border/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-amber/50 text-2xs select-none">▣</span>
                <span className="font-mono text-xs truncate">{plugin.name}</span>
              </div>
              {plugin.version && (
                <span className="font-mono text-2xs text-faint shrink-0 ml-2">
                  v{plugin.version}
                </span>
              )}
            </div>
            {plugin.description && (
              <div className="font-sans text-2xs text-muted mt-0.5 line-clamp-2 pl-4">
                {plugin.description}
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5 pl-4">
              {plugin.license && (
                <span className="font-mono text-2xs text-faint">{plugin.license}</span>
              )}
              {plugin.homepage && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    openUrl(plugin.homepage!);
                  }}
                  className="font-mono text-2xs text-amber/60 hover:text-amber cursor-pointer transition-colors"
                >
                  GitHub →
                </span>
              )}
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
            {selected.version && (
              <div className="font-mono text-2xs text-faint mt-0.5">
                version: {selected.version}
              </div>
            )}
            {selected.description && (
              <div className="font-sans text-2xs text-muted mt-1.5">{selected.description}</div>
            )}
            <div className="mt-2 space-y-1">
              {selected.author && (
                <div className="font-mono text-2xs text-faint">
                  Author: <span className="text-muted">{selected.author}</span>
                </div>
              )}
              {selected.license && (
                <div className="font-mono text-2xs text-faint">
                  License: <span className="text-muted">{selected.license}</span>
                </div>
              )}
              {selected.installed_at && (
                <div className="font-mono text-2xs text-faint">
                  Installed: <span className="text-muted">{selected.installed_at}</span>
                </div>
              )}
              <div className="font-mono text-2xs text-faint break-all mt-1">
                {selected.install_path}
              </div>
            </div>
            {selected.homepage && (
              <button
                onClick={() => openUrl(selected.homepage!)}
                className="mt-2 font-mono text-2xs text-amber/70 hover:text-amber transition-colors"
              >
                View on GitHub →
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-2 shrink-0">
        <span className="font-mono text-2xs text-faint">
          ~/.claude/plugins/
        </span>
      </div>
    </div>
  );
}
