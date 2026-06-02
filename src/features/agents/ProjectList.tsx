import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgentStore, type ThreadStatus } from "@/store/agents";
import { useT } from "@/i18n";
import { abbreviatePath, formatRelativeTime } from "@/lib/fmt";
import { useSettingsStore } from "@/store/settings";
import { CreateTeamDialog } from "@/features/team/CreateTeamDialog";

const STATUS_DOT: Record<ThreadStatus, { color: string; symbol: string }> = {
  idle: { color: "text-muted", symbol: "○" },
  thinking: { color: "text-amber", symbol: "●" },
  tool_use: { color: "text-amber", symbol: "●" },
  awaiting_input: { color: "text-vermilion", symbol: "◐" },
  done: { color: "text-moss", symbol: "✓" },
  error: { color: "text-vermilion", symbol: "✕" },
  crashed: { color: "text-vermilion", symbol: "✕" },
};

function folderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "Project";
}

export function ProjectList({ width }: { width: number }) {
  const t = useT();
  const projects = useAgentStore((s) => s.projects);
  const threads = useAgentStore((s) => s.threads);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const activeProjectId = useAgentStore((s) => s.activeProjectId);
  const activeTeamId = useAgentStore((s) => s.activeTeamId);
  const teamEntries = useAgentStore((s) => s.teamEntries);
  const sessionsLoading = useAgentStore((s) => s.sessionsLoading);
  const setActiveThread = useAgentStore((s) => s.setActiveThread);
  const setActiveProject = useAgentStore((s) => s.setActiveProject);
  const setActiveTeamId = useAgentStore((s) => s.setActiveTeamId);
  const addProject = useAgentStore((s) => s.addProject);
  const addThread = useAgentStore((s) => s.addThread);
  const removeThread = useAgentStore((s) => s.removeThread);
  const removeProject = useAgentStore((s) => s.removeProject);
  const setProjectPath = useAgentStore((s) => s.setProjectPath);
  const rightPanelTabs = useAgentStore((s) => s.rightPanelTabs);
  const togglePanel = useAgentStore((s) => s.togglePanel);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const projectList = Object.values(projects);
  const currentProject = activeProjectId ? projects[activeProjectId] : projectList[0] ?? null;

  // Ensure activeProjectId is set if it's null but projects exist
  useEffect(() => {
    if (!activeProjectId && projectList.length > 0) {
      const fallback = activeThreadId
        ? threads[activeThreadId]?.projectId
        : undefined;
      setActiveProject(fallback ?? projectList[0].id);
    }
  }, [activeProjectId, projectList.length, activeThreadId, threads, setActiveProject]);

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const handleRemoveProject = async (projectId: string) => {
    const project = projects[projectId];
    if (!project) return;
    for (const tid of project.threadIds) {
      const thread = threads[tid];
      if (thread?.agentId) {
        try {
          await invoke("kill_agent", { agentId: thread.agentId });
        } catch { /* agent may already be dead */ }
      }
    }
    removeProject(projectId);
    setSwitcherOpen(false);
  };

  const handleRemoveThread = async (threadId: string) => {
    const thread = threads[threadId];
    if (thread?.agentId) {
      try {
        await invoke("kill_agent", { agentId: thread.agentId });
      } catch { /* agent may already be dead */ }
    }
    removeThread(threadId);
  };

  const handleChangeFolder = async () => {
    if (!currentProject) return;
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    if (!path) return;
    setProjectPath(currentProject.id, path, folderName(path));
  };

  const handleAddProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    if (!path) return;
    const projectId = addProject(path, folderName(path));
    addThread(projectId, path);
    setSwitcherOpen(false);
  };

  const getThreadsByProject = () => {
    if (!currentProject) return { active: [], history: [] };

    const projectThreads = currentProject.threadIds
      .map((tid) => threads[tid])
      .filter(Boolean);

    const active = projectThreads.filter(
      (t) => t.agentId || t.status === "thinking" || t.status === "tool_use"
    );
    const history = projectThreads
      .filter((t) => !active.includes(t))
      .sort((a, b) => b.lastModified - a.lastModified);

    return { active, history };
  };

  const { active, history } = getThreadsByProject();

  return (
    <aside className="shrink-0 border-r border-border/30 bg-surface flex flex-col" style={{ width }}>
      {/* Header — fixed */}
      <div className="px-4 py-3 border-b-2 border-border flex items-center justify-between shrink-0">
        <h2 className="font-serif text-sm text-ink">{t("sidebar.chats")}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddProject}
            className="font-mono text-2xs text-muted border border-transparent hover:text-ink hover:border-border px-1.5 py-0.5 rounded-sm transition-colors"
            title={t("sidebar.addFolderTooltip")}
          >
            {t("sidebar.addFolder")}
          </button>
        </div>
      </div>

      {/* Project selector — fixed */}
      <div className="relative shrink-0 border-b-2 border-border" ref={switcherRef}>
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={handleChangeFolder}
            className="group flex-1 min-w-0 flex items-center gap-1.5 text-left"
            title={currentProject ? t("sidebar.workingFolder", { path: currentProject.rootPath }) : ""}
          >
            <span className="font-sans text-sm font-semibold text-ink truncate">
              {currentProject?.name ?? t("sidebar.noProject")}
            </span>
            {currentProject && (
              <span className="font-mono text-2xs text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0 select-none">
                ↗
              </span>
            )}
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            {currentProject && (
              <button
                onClick={() => addThread(currentProject.id, currentProject.rootPath)}
                className="font-mono text-sm font-bold text-muted border border-transparent hover:text-ink hover:border-border px-2 py-0.5 rounded-sm transition-colors"
                title={t("sidebar.newChat")}
              >
                +
              </button>
            )}
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className={`font-mono text-2xs border px-1.5 py-0.5 rounded-sm transition-colors ${
                switcherOpen
                  ? "text-ink border-border bg-border/30"
                  : "text-muted border-transparent hover:text-ink hover:border-border"
              }`}
              title={t("sidebar.switchProject")}
            >
              ⇅
            </button>
          </div>
        </div>

        {currentProject && (
          <div className="px-3 pb-1.5">
            <span className="font-mono text-2xs text-faint truncate block">
              {abbreviatePath(currentProject.rootPath)}
            </span>
          </div>
        )}

        {/* Project switcher popover */}
        {switcherOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 z-50 border-2 border-border rounded-sm bg-surface shadow-lg max-h-[300px] overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/50">
              <span className="font-mono text-2xs text-muted uppercase tracking-operator">{t("sidebar.projects")}</span>
            </div>
            {projectList.map((project) => {
              const isCurrent = project.id === currentProject?.id;
              const threadCount = project.threadIds.length;
              return (
                <div
                  key={project.id}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                    isCurrent
                      ? "bg-border/60 text-ink"
                      : "text-muted hover:text-ink hover:bg-border/40 cursor-pointer"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveProject(project.id);
                      setSwitcherOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left flex flex-col"
                  >
                    <span className="font-sans text-xs font-medium truncate flex items-center gap-1.5">
                      {isCurrent && <span className="text-amber text-2xs">●</span>}
                      {project.name}
                    </span>
                    <span className="font-mono text-2xs text-faint truncate">
                      {abbreviatePath(project.rootPath)}
                      {threadCount > 0 && t("sidebar.chatsCount", { count: threadCount })}
                    </span>
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProject(project.id);
                      }}
                      className="font-mono text-2xs text-faint hover:text-vermilion transition-colors shrink-0 select-none"
                      title={t("sidebar.removeProject")}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleAddProject}
              className="w-full px-3 py-2 text-left font-mono text-2xs text-muted hover:text-ink hover:bg-border/40 transition-colors border-t border-border/50"
            >
              {t("sidebar.openFolder")}
            </button>
          </div>
        )}
      </div>

      {/* Thread list (scrollable) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {sessionsLoading && (
          <div className="px-4 py-2 font-mono text-2xs text-faint animate-pulse">
            {t("sidebar.loadingSessions")}
          </div>
        )}

        {!currentProject && !sessionsLoading && (
          <div className="px-4 py-6 text-2xs text-muted font-mono">
            {t("sidebar.noProjectsYet")}
          </div>
        )}

        {currentProject && active.length === 0 && history.length === 0 && !sessionsLoading && (
          <div className="px-4 py-6 text-2xs text-muted font-mono">
            {t("sidebar.noChatsYet")}
          </div>
        )}

        {active.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={thread.id === activeThreadId}
            onSelect={() => setActiveThread(thread.id)}
            onRemove={() => handleRemoveThread(thread.id)}
          />
        ))}

        {active.length > 0 && history.length > 0 && (
          <div className="mx-3 my-1 border-t border-border/30" />
        )}

        {history.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={thread.id === activeThreadId}
            onSelect={() => setActiveThread(thread.id)}
            onRemove={() => handleRemoveThread(thread.id)}
          />
        ))}

        {/* Teams */}
        {teamEntries.length > 0 && (
          <>
            <div className="mx-3 mt-2 mb-1 border-t border-border/30" />
            <div className="px-3 py-1">
              <span className="font-mono text-2xs text-faint uppercase tracking-operator">
                {t("sidebar.teams")}
              </span>
            </div>
            {teamEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActiveTeamId(entry.id)}
                className={`group w-full text-left px-3 py-1.5 flex items-center gap-2 font-mono text-xs transition-colors ${
                  activeTeamId === entry.id
                    ? "bg-border/50 text-ink border-l-2 border-l-amber"
                    : "text-muted hover:text-ink hover:bg-border/40"
                }`}
              >
                <span className="text-amber/70 shrink-0 text-2xs select-none">◈</span>
                <span className="truncate">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="border-t-2 border-border" />

      {/* Lower section */}
      <div className="flex-1 min-h-0 flex flex-col px-3 py-3 gap-1">
        <SidebarButton
          icon="$"
          label={t("sidebar.cost")}
          active={rightPanelTabs.includes("cost")}
          onClick={() => togglePanel("cost")}
        />
        <div className="border-t border-border/30 my-1" />
        <SidebarButton
          icon="◇"
          label={t("panel.skills")}
          active={rightPanelTabs.includes("skills")}
          onClick={() => togglePanel("skills")}
        />
        <SidebarButton
          icon="⊞"
          label={t("panel.mcp")}
          active={rightPanelTabs.includes("mcp")}
          onClick={() => togglePanel("mcp")}
        />
        <SidebarButton
          icon="▣"
          label={t("panel.plugins")}
          active={rightPanelTabs.includes("plugins")}
          onClick={() => togglePanel("plugins")}
        />
        <SidebarButton
          icon="↪"
          label={t("sidebar.hooks")}
          active={rightPanelTabs.includes("hooks")}
          onClick={() => togglePanel("hooks")}
        />
        <SidebarButton
          icon="⊕"
          label={t("panel.git")}
          active={rightPanelTabs.includes("git")}
          onClick={() => togglePanel("git")}
        />
        <SidebarButton
          icon="⚙"
          label={t("sidebar.settings")}
          active={rightPanelTabs.includes("settings")}
          onClick={() => togglePanel("settings")}
        />
        <div className="border-t border-border/30 my-1" />
        <SidebarButton
          icon="◈"
          label={t("sidebar.newTeam")}
          active={false}
          onClick={() => setShowCreateTeam(true)}
        />
      </div>

      {showCreateTeam && currentProject && (
        <CreateTeamDialog
          defaultCwd={currentProject.rootPath}
          onClose={() => setShowCreateTeam(false)}
        />
      )}
    </aside>
  );
}

type ThreadItemProps = {
  thread: { id: string; status: ThreadStatus; title: string | null; lastModified: number; sessionId: string | null };
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

function ThreadItem({ thread, isActive, onSelect, onRemove }: ThreadItemProps) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const dot = STATUS_DOT[thread.status];

  return (
    <button
      onClick={onSelect}
      className={`group w-full text-left px-3 py-1.5 flex items-center gap-2 font-mono text-xs transition-colors ${
        isActive
          ? "bg-border/50 text-ink border-l-2 border-l-amber"
          : "text-muted hover:text-ink hover:bg-border/40"
      }`}
    >
      <span className={`${dot.color} shrink-0 text-2xs`}>{dot.symbol}</span>
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="truncate">
          {thread.title ?? t("sidebar.newChatDefault")}
        </span>
        <span className="text-2xs text-faint truncate">
          {formatRelativeTime(thread.lastModified, locale)}
        </span>
      </div>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="font-mono text-2xs text-faint opacity-0 group-hover:opacity-100 hover:text-vermilion transition-all shrink-0 cursor-pointer select-none"
        title={t("sidebar.close")}
      >
        ×
      </span>
    </button>
  );
}

function SidebarButton({ icon, label, active, onClick }: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-xs transition-colors ${
        active
          ? "bg-border/50 text-ink"
          : "text-muted hover:text-ink hover:bg-border/40"
      }`}
    >
      <span className="text-amber/70 w-4 text-center shrink-0 select-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
