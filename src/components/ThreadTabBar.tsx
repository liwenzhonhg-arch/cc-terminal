import { useAgentStore, type ThreadStatus } from "@/store/agents";
import { useT } from "@/i18n";

const STATUS_DOT: Record<ThreadStatus, { color: string; symbol: string }> = {
  idle: { color: "text-muted", symbol: "○" },
  thinking: { color: "text-amber", symbol: "●" },
  tool_use: { color: "text-amber", symbol: "●" },
  awaiting_input: { color: "text-vermilion", symbol: "◐" },
  done: { color: "text-moss", symbol: "✓" },
  error: { color: "text-vermilion", symbol: "✕" },
  crashed: { color: "text-vermilion", symbol: "✕" },
};

export function ThreadTabBar() {
  const t = useT();
  const openTabs = useAgentStore((s) => s.openThreadTabs);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const threads = useAgentStore((s) => s.threads);
  const projects = useAgentStore((s) => s.projects);
  const openThreadTab = useAgentStore((s) => s.openThreadTab);
  const closeThreadTab = useAgentStore((s) => s.closeThreadTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border/50 shrink-0 bg-surface overflow-x-auto">
      {openTabs.map((threadId) => {
        const thread = threads[threadId];
        if (!thread) return null;
        const project = projects[thread.projectId];
        const isActive = threadId === activeThreadId;
        const dot = STATUS_DOT[thread.status];

        return (
          <button
            key={threadId}
            onClick={() => openThreadTab(threadId)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeThreadTab(threadId);
              }
            }}
            className={`group flex items-center gap-1.5 px-3 py-1.5 font-mono text-2xs transition-colors border-b-2 -mb-px whitespace-nowrap ${
              isActive
                ? "border-amber text-ink bg-surface-chat"
                : "border-transparent text-muted hover:text-ink hover:bg-border/20"
            }`}
          >
            <span className={`${dot.color} shrink-0 select-none`}>{dot.symbol}</span>
            <span className="truncate max-w-[140px]">
              {thread.title ?? t("sidebar.newChatDefault")}
            </span>
            {project && (
              <span className="text-faint shrink-0">{project.name}</span>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeThreadTab(threadId);
              }}
              className="ml-0.5 text-faint opacity-0 group-hover:opacity-100 hover:text-vermilion transition-all shrink-0 cursor-pointer select-none"
              title={t("threadTab.closeTab")}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
