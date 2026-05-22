import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// === Types ===

export type ThreadStatus =
  | "idle"
  | "thinking"
  | "tool_use"
  | "awaiting_input"
  | "done"
  | "error"
  | "crashed";

export type PanelId = "cost" | "skills" | "mcp" | "plugins" | "hooks" | "settings";

export type MessageRole = "user" | "assistant" | "system" | "tool_use" | "tool_result" | "result" | "command";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  raw?: unknown;
};

export type ThreadUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
};

export type Thread = {
  id: string;
  projectId: string;
  agentId: string | null;
  cwd: string;
  status: ThreadStatus;
  messages: Message[];
  usage: ThreadUsage;
  model: string;
  sessionId: string | null;
  title: string | null;
  lastModified: number;
};

export type Project = {
  id: string;
  rootPath: string;
  name: string;
  threadIds: string[];
};

type SessionEntry = {
  sessionId: string;
  cwd: string;
  lastModified: number;
  fileSize: number;
  title: string | null;
};

export type TeamEntry = {
  id: string;
  name: string;
  cwd: string;
};

type AgentStore = {
  projects: Record<string, Project>;
  threads: Record<string, Thread>;
  activeThreadId: string | null;
  activeProjectId: string | null;
  activeTeamId: string | null;
  teamEntries: TeamEntry[];
  rightPanelTabs: PanelId[];
  rightPanelActiveTab: PanelId | null;
  openThreadTabs: string[];
  sessionsLoading: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;

  // Actions
  addProject: (rootPath: string, name: string) => string;
  addThread: (projectId: string, cwd: string, model?: string) => string;
  setActiveThread: (threadId: string) => void;
  setActiveProject: (projectId: string) => void;
  setActiveTeamId: (teamId: string | null) => void;
  addTeamEntry: (entry: TeamEntry) => void;
  removeTeamEntry: (teamId: string) => void;
  setAgentId: (threadId: string, agentId: string) => void;
  setThreadStatus: (threadId: string, status: ThreadStatus) => void;
  appendMessage: (threadId: string, msg: Message) => void;
  updateUsage: (threadId: string, usage: Partial<ThreadUsage>) => void;
  setSessionId: (threadId: string, sessionId: string) => void;
  clearThread: (threadId: string) => void;
  removeThread: (threadId: string) => void;
  removeProject: (projectId: string) => void;
  setProjectPath: (projectId: string, rootPath: string, name: string) => void;
  openThreadTab: (threadId: string) => void;
  closeThreadTab: (threadId: string) => void;
  togglePanel: (panelId: PanelId) => void;
  closePanel: (panelId: PanelId) => void;
  activatePanel: (panelId: PanelId) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  loadSessionHistory: () => Promise<void>;
  loadSessionMessages: (threadId: string) => Promise<void>;
};

// === Persistence ===

const STORAGE_KEY = "cc-terminal:store:v1";
const MAX_SESSIONS_PER_PROJECT = 30;

type PersistedThread = {
  id: string;
  projectId: string;
  cwd: string;
  model: string;
  sessionId: string | null;
  title: string | null;
  lastModified: number;
};

type PersistedState = {
  version: 1;
  projects: Record<string, Project>;
  threads: Record<string, PersistedThread>;
  activeThreadId: string | null;
  activeProjectId?: string | null;
  openThreadTabs?: string[];
};

function saveToStorage(state: Pick<AgentStore, "projects" | "threads" | "activeThreadId" | "activeProjectId" | "openThreadTabs">) {
  const threads: Record<string, PersistedThread> = {};
  for (const [id, t] of Object.entries(state.threads)) {
    threads[id] = {
      id: t.id,
      projectId: t.projectId,
      cwd: t.cwd,
      model: t.model,
      sessionId: t.sessionId,
      title: t.title,
      lastModified: t.lastModified,
    };
  }
  const persisted: PersistedState = {
    version: 1,
    projects: state.projects,
    threads,
    activeThreadId: state.activeThreadId,
    activeProjectId: state.activeProjectId,
    openThreadTabs: state.openThreadTabs,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // quota exceeded — ignore
  }
}

function loadFromStorage(): { projects: Record<string, Project>; threads: Record<string, Thread>; activeThreadId: string | null; activeProjectId: string | null; openThreadTabs: string[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (data.version !== 1) return null;

    const threads: Record<string, Thread> = {};
    for (const [id, pt] of Object.entries(data.threads)) {
      threads[id] = {
        ...pt,
        agentId: null,
        status: "idle",
        messages: [],
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 },
      };
    }
    const openThreadTabs = (data.openThreadTabs ?? []).filter((id) => id in threads);
    if (openThreadTabs.length === 0 && data.activeThreadId && data.activeThreadId in threads) {
      openThreadTabs.push(data.activeThreadId);
    }
    return { projects: data.projects, threads, activeThreadId: data.activeThreadId, activeProjectId: data.activeProjectId ?? null, openThreadTabs };
  } catch {
    return null;
  }
}

// === Panel widths persistence ===

const PANEL_WIDTHS_KEY = "cc-panel-widths";
const DEFAULT_LEFT = 240;
const DEFAULT_RIGHT = 400;

function loadPanelWidths(): { left: number; right: number } {
  try {
    const raw = localStorage.getItem(PANEL_WIDTHS_KEY);
    if (!raw) return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const left = typeof obj.left === "number" ? obj.left : DEFAULT_LEFT;
      const right = typeof obj.right === "number" ? obj.right : DEFAULT_RIGHT;
      return { left, right };
    }
  } catch { /* ignore */ }
  return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
}

function savePanelWidths(left: number, right: number) {
  localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ left, right }));
}

const hydratedWidths = loadPanelWidths();

// === Helpers ===

let counter = 0;
function uid(): string {
  return `${Date.now()}-${++counter}`;
}

function folderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "Project";
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(state: Pick<AgentStore, "projects" | "threads" | "activeThreadId" | "activeProjectId" | "openThreadTabs">) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToStorage(state), 500);
}

// === Hydrate ===

const hydrated = loadFromStorage();

// === Store ===

export const useAgentStore = create<AgentStore>((set) => ({
  projects: hydrated?.projects ?? {},
  threads: hydrated?.threads ?? {},
  activeThreadId: hydrated?.activeThreadId ?? null,
  activeProjectId: hydrated?.activeProjectId ?? null,
  openThreadTabs: hydrated?.openThreadTabs ?? [],
  activeTeamId: null,
  teamEntries: [],
  rightPanelTabs: [],
  rightPanelActiveTab: null,
  sessionsLoading: false,
  leftPanelWidth: hydratedWidths.left,
  rightPanelWidth: hydratedWidths.right,

  addProject: (rootPath, name) => {
    const id = uid();
    set((s) => ({
      projects: {
        ...s.projects,
        [id]: { id, rootPath, name, threadIds: [] },
      },
    }));
    return id;
  },

  addThread: (projectId, cwd, model = "claude-opus-4-6") => {
    const id = uid();
    set((s) => {
      const project = s.projects[projectId];
      if (!project) return s;
      return {
        threads: {
          ...s.threads,
          [id]: {
            id,
            projectId,
            agentId: null,
            cwd,
            status: "idle" as ThreadStatus,
            messages: [],
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 },
            model,
            sessionId: null,
            title: null,
            lastModified: Date.now(),
          },
        },
        projects: {
          ...s.projects,
          [projectId]: {
            ...project,
            threadIds: [...project.threadIds, id],
          },
        },
        openThreadTabs: [...s.openThreadTabs, id],
        activeThreadId: id,
        activeProjectId: projectId,
      };
    });
    return id;
  },

  setActiveThread: (threadId) =>
    set((s) => {
      const thread = s.threads[threadId];
      const tabs = s.openThreadTabs.includes(threadId)
        ? s.openThreadTabs
        : [...s.openThreadTabs, threadId];
      return {
        openThreadTabs: tabs,
        activeThreadId: threadId,
        activeProjectId: thread?.projectId ?? s.activeProjectId,
        activeTeamId: null,
      };
    }),

  setActiveProject: (projectId) => set({ activeProjectId: projectId }),

  setActiveTeamId: (teamId) =>
    set((s) => ({
      activeTeamId: teamId,
      activeThreadId: teamId ? null : s.activeThreadId,
    })),

  addTeamEntry: (entry) =>
    set((s) => ({
      teamEntries: [...s.teamEntries, entry],
    })),

  removeTeamEntry: (teamId) =>
    set((s) => ({
      teamEntries: s.teamEntries.filter((t) => t.id !== teamId),
      activeTeamId: s.activeTeamId === teamId ? null : s.activeTeamId,
    })),

  setAgentId: (threadId, agentId) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      return {
        threads: { ...s.threads, [threadId]: { ...thread, agentId } },
      };
    }),

  setThreadStatus: (threadId, status) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread || thread.status === status) return s;
      return {
        threads: { ...s.threads, [threadId]: { ...thread, status } },
      };
    }),

  appendMessage: (threadId, msg) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      const updated = { ...thread, messages: [...thread.messages, msg], lastModified: Date.now() };
      if (!thread.title && msg.role === "user" && msg.content) {
        updated.title = msg.content.slice(0, 40) + (msg.content.length > 40 ? "…" : "");
      }
      return {
        threads: { ...s.threads, [threadId]: updated },
      };
    }),

  updateUsage: (threadId, usage) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      const prev = thread.usage;
      const next = { ...prev, ...usage };
      if (
        prev.input === next.input &&
        prev.output === next.output &&
        prev.cacheRead === next.cacheRead &&
        prev.cacheWrite === next.cacheWrite &&
        prev.costUsd === next.costUsd
      )
        return s;
      return {
        threads: {
          ...s.threads,
          [threadId]: { ...thread, usage: next },
        },
      };
    }),

  clearThread: (threadId) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      return {
        threads: {
          ...s.threads,
          [threadId]: {
            ...thread,
            messages: [],
            agentId: null,
            status: "idle",
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 },
          },
        },
      };
    }),

  removeThread: (threadId) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      const { [threadId]: _, ...restThreads } = s.threads;
      const project = s.projects[thread.projectId];
      const updatedProjects = project
        ? {
            ...s.projects,
            [thread.projectId]: {
              ...project,
              threadIds: project.threadIds.filter((id) => id !== threadId),
            },
          }
        : s.projects;
      const newTabs = s.openThreadTabs.filter((id) => id !== threadId);
      let newActive = s.activeThreadId;
      if (s.activeThreadId === threadId) {
        if (newTabs.length === 0) {
          newActive = null;
        } else {
          const idx = s.openThreadTabs.indexOf(threadId);
          newActive = idx < newTabs.length ? newTabs[idx] : newTabs[newTabs.length - 1];
        }
      }
      return {
        threads: restThreads,
        projects: updatedProjects,
        openThreadTabs: newTabs,
        activeThreadId: newActive,
      };
    }),

  removeProject: (projectId) =>
    set((s) => {
      const project = s.projects[projectId];
      if (!project) return s;
      const { [projectId]: _, ...restProjects } = s.projects;
      const restThreads = { ...s.threads };
      const removedIds = new Set(project.threadIds);
      for (const tid of removedIds) {
        delete restThreads[tid];
      }
      const newTabs = s.openThreadTabs.filter((id) => !removedIds.has(id));
      const newActive = removedIds.has(s.activeThreadId ?? "")
        ? (newTabs[newTabs.length - 1] ?? null)
        : s.activeThreadId;
      const newActiveProject = s.activeProjectId === projectId
        ? (Object.keys(restProjects)[0] ?? null)
        : s.activeProjectId;
      return {
        projects: restProjects,
        threads: restThreads,
        openThreadTabs: newTabs,
        activeThreadId: newActive,
        activeProjectId: newActiveProject,
      };
    }),

  setSessionId: (threadId, sessionId) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      return {
        threads: { ...s.threads, [threadId]: { ...thread, sessionId } },
      };
    }),

  setProjectPath: (projectId, rootPath, name) =>
    set((s) => {
      const project = s.projects[projectId];
      if (!project) return s;
      return {
        projects: {
          ...s.projects,
          [projectId]: { ...project, rootPath, name },
        },
      };
    }),

  openThreadTab: (threadId) =>
    set((s) => {
      const thread = s.threads[threadId];
      if (!thread) return s;
      const tabs = s.openThreadTabs.includes(threadId)
        ? s.openThreadTabs
        : [...s.openThreadTabs, threadId];
      return {
        openThreadTabs: tabs,
        activeThreadId: threadId,
        activeProjectId: thread.projectId,
        activeTeamId: null,
      };
    }),

  closeThreadTab: (threadId) =>
    set((s) => {
      const oldIdx = s.openThreadTabs.indexOf(threadId);
      if (oldIdx === -1) return s;
      const newTabs = s.openThreadTabs.filter((id) => id !== threadId);
      let newActive = s.activeThreadId;
      if (s.activeThreadId === threadId) {
        // Pick right neighbor; if none, pick left neighbor; if empty, null
        const clampedIdx = Math.min(oldIdx, newTabs.length - 1);
        newActive = clampedIdx >= 0 ? newTabs[clampedIdx] : null;
      }
      return {
        openThreadTabs: newTabs,
        activeThreadId: newActive,
      };
    }),

  togglePanel: (panelId) =>
    set((s) => {
      const isOpen = s.rightPanelTabs.includes(panelId);
      const isActive = s.rightPanelActiveTab === panelId;
      if (isOpen && isActive) {
        const newTabs = s.rightPanelTabs.filter((id) => id !== panelId);
        return {
          rightPanelTabs: newTabs,
          rightPanelActiveTab: newTabs.length > 0 ? newTabs[newTabs.length - 1] : null,
        };
      }
      if (isOpen) {
        return { rightPanelActiveTab: panelId };
      }
      return {
        rightPanelTabs: [...s.rightPanelTabs, panelId],
        rightPanelActiveTab: panelId,
      };
    }),

  closePanel: (panelId) =>
    set((s) => {
      const newTabs = s.rightPanelTabs.filter((id) => id !== panelId);
      const newActive =
        s.rightPanelActiveTab === panelId
          ? (newTabs.length > 0 ? newTabs[newTabs.length - 1] : null)
          : s.rightPanelActiveTab;
      return { rightPanelTabs: newTabs, rightPanelActiveTab: newActive };
    }),

  activatePanel: (panelId) =>
    set((s) => {
      if (!s.rightPanelTabs.includes(panelId)) {
        return {
          rightPanelTabs: [...s.rightPanelTabs, panelId],
          rightPanelActiveTab: panelId,
        };
      }
      return { rightPanelActiveTab: panelId };
    }),

  setLeftPanelWidth: (w) =>
    set((s) => {
      const clamped = Math.max(160, Math.min(400, w));
      savePanelWidths(clamped, s.rightPanelWidth);
      return { leftPanelWidth: clamped };
    }),

  setRightPanelWidth: (w) =>
    set((s) => {
      const clamped = Math.max(280, Math.min(600, w));
      savePanelWidths(s.leftPanelWidth, clamped);
      return { rightPanelWidth: clamped };
    }),

  loadSessionHistory: async () => {
    set({ sessionsLoading: true });
    try {
      const sessions: SessionEntry[] = await invoke("list_sessions");
      set((s) => {
        const newProjects = { ...s.projects };
        const newThreads = { ...s.threads };

        const existingSessionIds = new Set(
          Object.values(s.threads)
            .map((t) => t.sessionId)
            .filter(Boolean)
        );

        const cwdSessionCount: Record<string, number> = {};
        for (const t of Object.values(s.threads)) {
          cwdSessionCount[t.cwd] = (cwdSessionCount[t.cwd] ?? 0) + 1;
        }

        for (const session of sessions) {
          if (existingSessionIds.has(session.sessionId)) continue;
          if ((cwdSessionCount[session.cwd] ?? 0) >= MAX_SESSIONS_PER_PROJECT) continue;

          let projectId = Object.values(newProjects).find(
            (p) => p.rootPath === session.cwd
          )?.id;

          if (!projectId) {
            projectId = uid();
            newProjects[projectId] = {
              id: projectId,
              rootPath: session.cwd,
              name: folderName(session.cwd),
              threadIds: [],
            };
          }

          const threadId = uid();
          newThreads[threadId] = {
            id: threadId,
            projectId,
            agentId: null,
            cwd: session.cwd,
            status: "idle",
            messages: [],
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 },
            model: "claude-opus-4-6",
            sessionId: session.sessionId,
            title: session.title ?? null,
            lastModified: session.lastModified,
          };

          newProjects[projectId].threadIds.push(threadId);
          cwdSessionCount[session.cwd] = (cwdSessionCount[session.cwd] ?? 0) + 1;
        }

        return { projects: newProjects, threads: newThreads, sessionsLoading: false };
      });
    } catch (err) {
      console.error("Failed to load session history:", err);
      set({ sessionsLoading: false });
    }
  },

  loadSessionMessages: async (threadId: string) => {
    const thread = useAgentStore.getState().threads[threadId];
    if (!thread?.sessionId || thread.messages.length > 0) return;

    try {
      const rawMessages: { role: string; content: string; timestamp: number | null }[] =
        await invoke("load_session_messages", { sessionId: thread.sessionId });

      const messages: Message[] = rawMessages.map((m) => {
        const ts = m.timestamp ?? Date.now();

        if (m.role === "tool_use") {
          try {
            const block = JSON.parse(m.content);
            return {
              id: crypto.randomUUID(),
              role: "tool_use" as MessageRole,
              content: `Tool: ${block.name ?? "unknown"}`,
              timestamp: ts,
              raw: block,
            };
          } catch {
            return { id: crypto.randomUUID(), role: "tool_use" as MessageRole, content: m.content, timestamp: ts };
          }
        }

        if (m.role === "tool_result") {
          try {
            const meta = JSON.parse(m.content);
            return {
              id: crypto.randomUUID(),
              role: "tool_result" as MessageRole,
              content: meta.text ?? "",
              timestamp: ts,
              raw: { toolUseId: meta.toolUseId, isError: meta.isError },
            };
          } catch {
            return { id: crypto.randomUUID(), role: "tool_result" as MessageRole, content: m.content, timestamp: ts };
          }
        }

        return {
          id: crypto.randomUUID(),
          role: (m.role === "user" ? "user" : "assistant") as MessageRole,
          content: m.content,
          timestamp: ts,
        };
      });

      set((s) => {
        const t = s.threads[threadId];
        if (!t || t.messages.length > 0) return s;
        return {
          threads: {
            ...s.threads,
            [threadId]: { ...t, messages },
          },
        };
      });
    } catch (err) {
      console.error("Failed to load session messages:", err);
    }
  },
}));

// Auto-persist on state changes
useAgentStore.subscribe((state) => {
  debouncedSave(state);
});
