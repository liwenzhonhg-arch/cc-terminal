import { useEffect, useMemo, useState } from "react";
import { useConsoleStore } from "@/store/console";
import { useAgentStore } from "@/store/agents";
import { ResizeDivider } from "@/components/ResizeDivider";
import { useT } from "@/i18n";

const HOOK_TYPE_ICON: Record<string, string> = {
  command: "$",
  prompt: ">",
  verify: "✓",
  http: "~",
  tool: "⊞",
};

const SOURCE_CLASS: Record<string, string> = {
  global: "text-faint",
  project: "text-amber/70",
  "project-local": "text-moss/70",
};

export function HooksPanelContent() {
  const t = useT();
  const hooks = useConsoleStore((s) => s.hooks);
  const loading = useConsoleStore((s) => s.hooksLoading);
  const selectedIndex = useConsoleStore((s) => s.selectedHookIndex);
  const loadHooks = useConsoleStore((s) => s.loadHooks);
  const selectHook = useConsoleStore((s) => s.selectHook);

  const threads = useAgentStore((s) => s.threads);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const cwd = activeThreadId ? threads[activeThreadId]?.cwd : undefined;

  useEffect(() => {
    loadHooks(cwd);
  }, [loadHooks, cwd]);

  const grouped = useMemo(() => {
    const map = new Map<string, { event: string; items: { hook: typeof hooks[number]; index: number }[] }>();
    hooks.forEach((hook, idx) => {
      let group = map.get(hook.event);
      if (!group) {
        group = { event: hook.event, items: [] };
        map.set(hook.event, group);
      }
      group.items.push({ hook, index: idx });
    });
    return Array.from(map.values());
  }, [hooks]);

  const [detailHeight, setDetailHeight] = useState(200);
  const selected = selectedIndex !== null ? hooks[selectedIndex] ?? null : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber/70 font-mono text-xs select-none">{"↪"}</span>
          <span className="font-serif text-sm text-ink">{t("hooks.title")}</span>
          <span className="font-mono text-2xs text-faint">{hooks.length}</span>
        </div>
        <button
          onClick={() => loadHooks(cwd)}
          className="font-mono text-2xs text-muted hover:text-ink transition-colors px-1.5 py-0.5"
          title={t("hooks.refresh")}
        >
          {"↻"}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 font-mono text-2xs text-faint animate-pulse">
            {t("hooks.loading")}
          </div>
        )}

        {!loading && hooks.length === 0 && (
          <div className="px-3 py-6 font-mono text-2xs text-faint text-center">
            {t("hooks.noHooks")}
          </div>
        )}

        {!loading && grouped.map((group) => (
          <div key={group.event}>
            <div className="px-3 py-1.5 bg-border/20 border-b border-border/20">
              <span className="font-mono text-2xs text-muted uppercase tracking-operator">
                {group.event}
              </span>
              <span className="font-mono text-2xs text-faint ml-1.5">({group.items.length})</span>
            </div>
            {group.items.map(({ hook, index }) => (
              <button
                key={index}
                onClick={() => selectHook(selectedIndex === index ? null : index)}
                className={`w-full text-left px-3 py-2 border-b border-border/20 transition-colors ${
                  selectedIndex === index
                    ? "bg-border/60 text-ink"
                    : "text-muted hover:text-ink hover:bg-border/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-amber/50 text-2xs select-none font-mono w-3 text-center shrink-0">
                      {HOOK_TYPE_ICON[hook.hook_type] ?? ">"}
                    </span>
                    <span className="font-mono text-xs truncate">{hook.hook_type}</span>
                    {hook.matcher && (
                      <span className="font-mono text-2xs text-faint truncate ml-1">
                        [{hook.matcher}]
                      </span>
                    )}
                  </div>
                  <span className={`font-mono text-2xs shrink-0 ml-2 ${SOURCE_CLASS[hook.source] ?? "text-faint"}`}>
                    {hook.source === "global" ? t("hooks.global")
                      : hook.source === "project" ? t("hooks.project")
                      : t("hooks.projectLocal")}
                  </span>
                </div>
                <div className="font-mono text-2xs text-faint mt-0.5 truncate pl-[18px]">
                  {hook.command ?? hook.prompt ?? hook.url ?? hook.tool ?? "—"}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Detail */}
      {selected && (
        <>
        <ResizeDivider direction="horizontal" onResize={(d) => setDetailHeight((h) => Math.max(100, h - d))} />
        <div className="shrink-0 overflow-y-auto" style={{ height: detailHeight }}>
          <div className="px-3 py-2 space-y-1.5">
            <DetailRow label={t("hooks.type")} value={selected.hook_type} />
            {selected.command && <DetailRow label={t("hooks.command")} value={selected.command} mono />}
            {selected.prompt && <DetailRow label={t("hooks.prompt")} value={selected.prompt} />}
            {selected.url && <DetailRow label={t("hooks.url")} value={selected.url} />}
            {selected.tool && <DetailRow label={t("hooks.tool")} value={selected.tool} />}
            {selected.matcher && <DetailRow label={t("hooks.matcher")} value={selected.matcher} />}
            {selected.condition && <DetailRow label={t("hooks.condition")} value={selected.condition} />}
            {selected.timeout !== null && <DetailRow label={t("hooks.timeout")} value={`${selected.timeout}s`} />}
            <DetailRow
              label={t("hooks.source")}
              value={
                selected.source === "global" ? t("hooks.global")
                  : selected.source === "project" ? t("hooks.project")
                  : t("hooks.projectLocal")
              }
            />
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
          {"⚠"} {t("hooks.readOnly")}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="font-mono text-2xs text-faint">{label}: </span>
      <span className={`font-mono text-2xs text-muted break-all ${mono ? "bg-border/40 px-1 py-0.5 rounded-sm" : ""}`}>
        {value}
      </span>
    </div>
  );
}
