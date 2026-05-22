import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// === Types (mirrors Rust structs) ===

export type SkillEntry = {
  name: string;
  namespace: string | null;
  description: string | null;
  path: string;
  content_preview: string;
};

export type McpServerEntry = {
  name: string;
  command: string | null;
  args: string[];
  env: Record<string, string> | null;
  transport: string;
  url: string | null;
  source: string;
};

export type PluginEntry = {
  name: string;
  version: string | null;
  description: string | null;
  author: string | null;
  license: string | null;
  homepage: string | null;
  install_path: string;
  installed_at: string | null;
};

export type HookEntry = {
  event: string;
  matcher: string | null;
  hook_type: string;
  command: string | null;
  prompt: string | null;
  url: string | null;
  tool: string | null;
  condition: string | null;
  timeout: number | null;
  source: string;
};

export type SkillFilter = "all" | "installed";

export type SkillGroupConfig = {
  groupNames: Record<string, string>;
  skillGroups: Record<string, string>;
};

const SKILL_GROUPS_KEY = "cc-skill-groups";

function isSkillGroupConfig(v: unknown): v is SkillGroupConfig {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.groupNames === "object" && obj.groupNames !== null &&
    typeof obj.skillGroups === "object" && obj.skillGroups !== null
  );
}

function loadGroupConfig(): SkillGroupConfig {
  try {
    const raw = localStorage.getItem(SKILL_GROUPS_KEY);
    if (!raw) return { groupNames: {}, skillGroups: {} };
    const parsed: unknown = JSON.parse(raw);
    if (isSkillGroupConfig(parsed)) return parsed;
    console.warn("Invalid skill group config in localStorage, resetting");
  } catch (e) {
    console.warn("Failed to load skill group config:", e);
  }
  return { groupNames: {}, skillGroups: {} };
}

function saveGroupConfig(config: SkillGroupConfig) {
  localStorage.setItem(SKILL_GROUPS_KEY, JSON.stringify(config));
}

// === Store ===

type ConsoleState = {
  skills: SkillEntry[];
  skillsLoading: boolean;
  selectedSkill: string | null;
  skillFilter: SkillFilter;
  skillSearch: string;

  mcpServers: McpServerEntry[];
  mcpLoading: boolean;
  selectedMcp: string | null;

  plugins: PluginEntry[];
  pluginsLoading: boolean;
  selectedPlugin: string | null;

  hooks: HookEntry[];
  hooksLoading: boolean;
  selectedHookIndex: number | null;

  skillGroupConfig: SkillGroupConfig;

  loadSkills: () => Promise<void>;
  loadMcpServers: (cwd?: string) => Promise<void>;
  loadPlugins: () => Promise<void>;
  loadHooks: (cwd?: string) => Promise<void>;
  setSkillFilter: (filter: SkillFilter) => void;
  setSkillSearch: (query: string) => void;
  selectSkill: (name: string | null) => void;
  selectMcp: (name: string | null) => void;
  selectPlugin: (name: string | null) => void;
  selectHook: (index: number | null) => void;
  setGroupDisplayName: (groupKey: string, displayName: string) => void;
  setSkillGroup: (skillName: string, groupKey: string) => void;
  resetSkillGroupConfig: () => void;
};

export const useConsoleStore = create<ConsoleState>((set) => ({
  skills: [],
  skillsLoading: false,
  selectedSkill: null,
  skillFilter: "all",
  skillSearch: "",

  mcpServers: [],
  mcpLoading: false,
  selectedMcp: null,

  plugins: [],
  pluginsLoading: false,
  selectedPlugin: null,

  hooks: [],
  hooksLoading: false,
  selectedHookIndex: null,

  skillGroupConfig: loadGroupConfig(),

  loadSkills: async () => {
    set({ skillsLoading: true });
    try {
      const skills = await invoke<SkillEntry[]>("list_skills");
      set({ skills, skillsLoading: false });
    } catch {
      set({ skillsLoading: false });
    }
  },

  loadMcpServers: async (cwd) => {
    set({ mcpLoading: true });
    try {
      const mcpServers = await invoke<McpServerEntry[]>("list_mcp_servers", { cwd: cwd ?? null });
      set({ mcpServers, mcpLoading: false });
    } catch {
      set({ mcpLoading: false });
    }
  },

  loadPlugins: async () => {
    set({ pluginsLoading: true });
    try {
      const plugins = await invoke<PluginEntry[]>("list_plugins");
      set({ plugins, pluginsLoading: false });
    } catch {
      set({ pluginsLoading: false });
    }
  },

  loadHooks: async (cwd) => {
    set({ hooksLoading: true });
    try {
      const hooks = await invoke<HookEntry[]>("list_hooks", { cwd: cwd ?? null });
      set({ hooks, hooksLoading: false });
    } catch (err) {
      console.error("Failed to load hooks:", err);
      set({ hooksLoading: false });
    }
  },

  setSkillFilter: (filter) => set({ skillFilter: filter }),
  setSkillSearch: (query) => set({ skillSearch: query }),
  selectSkill: (name) => set({ selectedSkill: name }),
  selectMcp: (name) => set({ selectedMcp: name }),
  selectPlugin: (name) => set({ selectedPlugin: name }),
  selectHook: (index) => set({ selectedHookIndex: index }),

  setGroupDisplayName: (groupKey, displayName) => set((state) => {
    const config = {
      ...state.skillGroupConfig,
      groupNames: { ...state.skillGroupConfig.groupNames, [groupKey]: displayName },
    };
    saveGroupConfig(config);
    return { skillGroupConfig: config };
  }),

  setSkillGroup: (skillName, groupKey) => set((state) => {
    const config = {
      ...state.skillGroupConfig,
      skillGroups: { ...state.skillGroupConfig.skillGroups, [skillName]: groupKey },
    };
    saveGroupConfig(config);
    return { skillGroupConfig: config };
  }),

  resetSkillGroupConfig: () => set(() => {
    const config: SkillGroupConfig = { groupNames: {}, skillGroups: {} };
    saveGroupConfig(config);
    return { skillGroupConfig: config };
  }),
}));
