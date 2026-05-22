import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StatusBar } from "./StatusBar";
import { ResizeDivider } from "./ResizeDivider";
import { RightPanelContainer } from "./RightPanelContainer";
import { ProjectList } from "@/features/agents/ProjectList";
import { ThreadView } from "@/features/agents/ThreadView";
import { TeamChatContent } from "@/features/team/TeamChatContent";
import { TeamSidebar } from "@/features/team/TeamSidebar";
import { useAgentStore } from "@/store/agents";

export function AppShell() {
  const activeThread = useAgentStore((s) =>
    s.activeThreadId ? s.threads[s.activeThreadId] : null
  );
  const activeTeamId = useAgentStore((s) => s.activeTeamId);
  const projects = useAgentStore((s) => s.projects);
  const addProject = useAgentStore((s) => s.addProject);
  const addThread = useAgentStore((s) => s.addThread);

  const loadSessionHistory = useAgentStore((s) => s.loadSessionHistory);
  const leftPanelWidth = useAgentStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useAgentStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useAgentStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useAgentStore((s) => s.setRightPanelWidth);
  const rightPanelTabs = useAgentStore((s) => s.rightPanelTabs);

  useEffect(() => {
    if (Object.keys(projects).length > 0) {
      loadSessionHistory();
      return;
    }
    invoke<string>("get_default_cwd").then((cwd) => {
      const projectId = addProject(cwd, "Home");
      addThread(projectId, cwd);
      loadSessionHistory();
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "n") {
        e.preventDefault();
        const state = useAgentStore.getState();
        const project = state.activeProjectId
          ? state.projects[state.activeProjectId]
          : Object.values(state.projects)[0];
        if (project) addThread(project.id, project.rootPath);
      }

      if (ctrl && e.key === "w") {
        e.preventDefault();
        const state = useAgentStore.getState();
        if (state.activeThreadId) {
          state.closeThreadTab(state.activeThreadId);
        }
      }

      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const state = useAgentStore.getState();
        const tabs = state.openThreadTabs;
        if (tabs.length < 2 || !state.activeThreadId) return;
        const idx = tabs.indexOf(state.activeThreadId);
        if (idx === -1) return;
        const next = e.key === "ArrowDown"
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length];
        state.openThreadTab(next);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addThread]);

  return (
    <div className="cc-grain relative h-full w-full bg-surface text-ink overflow-hidden flex flex-col">
      <StatusBar
        tokens={activeTeamId ? { input: null, output: null, cache: null } : {
          input: activeThread?.usage.input ?? null,
          output: activeThread?.usage.output ?? null,
          cache: (activeThread?.usage.cacheRead ?? 0) + (activeThread?.usage.cacheWrite ?? 0) || null,
        }}
      />

      <div className="flex flex-1 min-h-0">
        <ProjectList width={leftPanelWidth} />
        <ResizeDivider onResize={(d) => setLeftPanelWidth(leftPanelWidth + d)} />
        {activeTeamId ? (
          <>
            <TeamChatContent teamId={activeTeamId} />
            <ResizeDivider onResize={(d) => setRightPanelWidth(rightPanelWidth - d)} />
            <TeamSidebar teamId={activeTeamId} width={rightPanelWidth} />
          </>
        ) : (
          <>
            <ThreadView />
            {rightPanelTabs.length > 0 && (
              <ResizeDivider onResize={(d) => setRightPanelWidth(rightPanelWidth - d)} />
            )}
            <RightPanelContainer width={rightPanelWidth} />
          </>
        )}
      </div>
    </div>
  );
}
