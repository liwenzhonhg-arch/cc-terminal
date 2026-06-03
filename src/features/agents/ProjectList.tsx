import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgentStore, type ThreadStatus } from "@/store/agents";
import { useT } from "@/i18n";
import { abbreviatePath, formatRelativeTime } from "@/lib/fmt";
import { useSettingsStore } from "@/store/settings";
import { CreateTeamDialog } from "@/features/team/CreateTeamDialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const projectList = Object.values(projects);
  const currentProject = activeProjectId ? projects[activeProjectId] : projectList[0] ?? null;

  useEffect(() => {
    if (!activeProjectId && projectList.length > 0) {
      const fallback = activeThreadId
        ? threads[activeThreadId]?.projectId
        : undefined;
      setActiveProject(fallback ?? projectList[0].id);
    }
  }, [activeProjectId, projectList.length, activeThreadId, threads, setActiveProject]);

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
  };

  const getThreadsByProject = () => {
    if (!currentProject) return { active: [], history: [] };

    const projectThreads = currentProject.threadIds
      .map((tid) => threads[tid])
      .filter(Boolean);

    const active = projectThreads.filter(
      (th) => th.agentId || th.status === "thinking" || th.status === "tool_use"
    );
    const history = projectThreads
      .filter((th) => !active.includes(th))
      .sort((a, b) => b.lastModified - a.lastModified);

    return { active, history };
  };

  const { active, history } = getThreadsByProject();

  return (
    <aside className="shrink-0 border-r border-border bg-surface flex flex-col" style={{ width }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-operator text-faint">{t("sidebar.chats")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={handleAddProject}>
              {t("sidebar.addFolder")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("sidebar.addFolderTooltip")}</TooltipContent>
        </Tooltip>
      </div>

      {/* Project selector */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={handleChangeFolder}
            className="group flex-1 min-w-0 flex items-center gap-2 text-left"
          >
            <span className="w-[6px] h-[6px] rounded-full bg-amber shrink-0" />
            <span className="font-sans text-[13px] font-semibold text-ink truncate">
              {currentProject?.name ?? t("sidebar.noProject")}
            </span>
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            {currentProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-bold text-sm px-2"
                    onClick={() => addThread(currentProject.id, currentProject.rootPath)}
                  >
                    +
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("sidebar.newChat")}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="px-1.5">
                  ⇅
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                <DropdownMenuLabel>{t("sidebar.projects")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projectList.map((project) => {
                  const isCurrent = project.id === currentProject?.id;
                  const threadCount = project.threadIds.length;
                  return (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={() => setActiveProject(project.id)}
                      className="flex-col items-start gap-0"
                    >
                      <span className="flex items-center gap-1.5 w-full">
                        {isCurrent && <span className="text-amber text-2xs">●</span>}
                        <span className="truncate font-medium">{project.name}</span>
                        {!isCurrent && (
                          <span
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveProject(project.id); }}
                            className="ml-auto text-faint hover:text-vermilion cursor-pointer select-none"
                          >
                            ×
                          </span>
                        )}
                      </span>
                      <span className="text-2xs text-faint truncate w-full">
                        {abbreviatePath(project.rootPath)}
                        {threadCount > 0 && t("sidebar.chatsCount", { count: threadCount })}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleAddProject}>
                  {t("sidebar.openFolder")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {currentProject && (
          <div className="px-3 pb-1.5">
            <span className="font-mono text-2xs text-faint truncate block">
              {abbreviatePath(currentProject.rootPath)}
            </span>
          </div>
        )}
      </div>

      {/* Thread list */}
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
          <Separator className="mx-3 my-1 w-auto" />
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
            <Separator className="mx-3 mt-2 mb-1 w-auto" />
            <div className="px-3 py-1">
              <span className="font-mono text-2xs text-faint uppercase tracking-operator">
                {t("sidebar.teams")}
              </span>
            </div>
            {teamEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActiveTeamId(entry.id)}
                data-active={activeTeamId === entry.id}
                className={`cc-list-item cc-press group w-full text-left pl-4 pr-3 py-2 flex items-center gap-2.5 font-mono text-xs ${
                  activeTeamId === entry.id
                    ? "bg-border/40 text-ink"
                    : "text-muted hover:text-ink hover:bg-border/20"
                }`}
              >
                <span className="text-amber/70 shrink-0 text-2xs select-none">◈</span>
                <span className="truncate font-medium">{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Lower section */}
      <div className="flex-1 min-h-0 flex flex-col px-3 py-3 gap-1">
        <SidebarButton
          icon="$"
          label={t("sidebar.cost")}
          active={rightPanelTabs.includes("cost")}
          onClick={() => togglePanel("cost")}
        />
        <Separator className="my-1" />
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
        <Separator className="my-1" />
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
  const isRunning = thread.status === "thinking" || thread.status === "tool_use";

  return (
    <button
      onClick={onSelect}
      data-active={isActive}
      className={`cc-list-item cc-press group w-full text-left pl-4 pr-3 py-2 flex items-center gap-2.5 font-mono text-xs ${
        isActive
          ? "bg-border/40 text-ink"
          : "text-muted hover:text-ink hover:bg-border/20"
      }`}
    >
      <span className={`${dot.color} shrink-0 text-2xs ${isRunning ? "cc-dot-pulse" : ""}`}>
        {dot.symbol}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="truncate font-medium">
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
        className="font-mono text-2xs text-faint opacity-0 group-hover:opacity-100 hover:text-vermilion transition-all duration-150 shrink-0 cursor-pointer select-none"
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
    <Button
      variant="ghost"
      size="sm"
      data-active={active}
      onClick={onClick}
      className={`cc-list-item w-full justify-start gap-2 pl-4 ${active ? "bg-border/40 text-ink" : ""}`}
    >
      <span className="text-amber/70 w-4 text-center shrink-0 select-none">{icon}</span>
      <span>{label}</span>
    </Button>
  );
}
