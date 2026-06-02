import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "./agents";

// ─── Types (mirror Rust structs) ────────────────────────────────────────────

export type GitFileStatus = {
  path: string;
  status: string;
  staged: boolean;
};

export type GitStatusResult = {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  isClean: boolean;
  hasStaged: boolean;
};

export type GitCommitResult = {
  hash: string;
  message: string;
};

export type GhPrResult = {
  url: string;
  number: number;
};

// ─── Store ──────────────────────────────────────────────────────────────────

type GitStore = {
  status: GitStatusResult | null;
  statusLoading: boolean;
  statusError: string | null;
  selectedFile: string | null;
  diffContent: string | null;
  diffLoading: boolean;
  commitMessage: string;
  ghAuthenticated: boolean | null;

  prFormOpen: boolean;
  prTitle: string;
  prBody: string;
  prBase: string;

  lastCommit: GitCommitResult | null;
  lastPr: GhPrResult | null;
  lastError: string | null;

  loadStatus: (cwd: string) => Promise<void>;
  loadDiff: (cwd: string, staged: boolean, paths: string[]) => Promise<void>;
  stageFiles: (cwd: string, paths: string[], unstage: boolean) => Promise<void>;
  commit: (cwd: string, message: string) => Promise<GitCommitResult>;
  push: (cwd: string, setUpstream?: string) => Promise<string>;
  createPr: (cwd: string, title: string, body: string, base?: string) => Promise<GhPrResult>;
  checkGhAuth: () => Promise<void>;
  generateCommitMessage: (messages: Message[], files: GitFileStatus[]) => void;
  setSelectedFile: (path: string | null) => void;
  setCommitMessage: (msg: string) => void;
  setPrField: (field: "title" | "body" | "base", value: string) => void;
  setPrFormOpen: (open: boolean) => void;
  clearLastResults: () => void;
  reset: () => void;
};

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  statusLoading: false,
  statusError: null,
  selectedFile: null,
  diffContent: null,
  diffLoading: false,
  commitMessage: "",
  ghAuthenticated: null,

  prFormOpen: false,
  prTitle: "",
  prBody: "",
  prBase: "main",

  lastCommit: null,
  lastPr: null,
  lastError: null,

  loadStatus: async (cwd) => {
    set({ statusLoading: true, statusError: null });
    try {
      const status = await invoke<GitStatusResult>("git_status", { cwd });
      set({ status, statusLoading: false });
    } catch (err) {
      set({ statusLoading: false, statusError: String(err) });
    }
  },

  loadDiff: async (cwd, staged, paths) => {
    set({ diffLoading: true });
    try {
      const diffContent = await invoke<string>("git_diff", { cwd, staged, paths });
      set({ diffContent, diffLoading: false });
    } catch {
      set({ diffContent: null, diffLoading: false });
    }
  },

  stageFiles: async (cwd, paths, unstage) => {
    await invoke("git_stage", { cwd, paths, unstage });
    await get().loadStatus(cwd);
  },

  commit: async (cwd, message) => {
    const result = await invoke<GitCommitResult>("git_commit", { cwd, message });
    set({ lastCommit: result, commitMessage: "" });
    await get().loadStatus(cwd);
    return result;
  },

  push: async (cwd, setUpstream) => {
    const result = await invoke<string>("git_push", { cwd, setUpstream: setUpstream ?? null });
    await get().loadStatus(cwd);
    return result;
  },

  createPr: async (cwd, title, body, base) => {
    const result = await invoke<GhPrResult>("gh_pr_create", {
      cwd,
      title,
      body,
      base: base ?? null,
    });
    set({ lastPr: result, prFormOpen: false, prTitle: "", prBody: "", prBase: "main" });
    return result;
  },

  checkGhAuth: async () => {
    try {
      const ok = await invoke<boolean>("gh_auth_status");
      set({ ghAuthenticated: ok });
    } catch {
      set({ ghAuthenticated: false });
    }
  },

  generateCommitMessage: (messages, files) => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const subject = (lastUser?.content ?? "Update files").split("\n")[0].slice(0, 72);
    const fileList = files.map((f) => `- ${f.status} ${f.path}`).join("\n");
    const msg = `${subject}\n\n${fileList}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
    set({ commitMessage: msg });
  },

  setSelectedFile: (path) => set({ selectedFile: path }),
  setCommitMessage: (msg) => set({ commitMessage: msg }),
  setPrField: (field, value) => {
    if (field === "title") set({ prTitle: value });
    else if (field === "body") set({ prBody: value });
    else if (field === "base") set({ prBase: value });
  },
  setPrFormOpen: (open) => set({ prFormOpen: open }),
  clearLastResults: () => set({ lastCommit: null, lastPr: null, lastError: null }),
  reset: () =>
    set({
      status: null,
      statusLoading: false,
      statusError: null,
      selectedFile: null,
      diffContent: null,
      diffLoading: false,
      commitMessage: "",
      prFormOpen: false,
      prTitle: "",
      prBody: "",
      prBase: "main",
      lastCommit: null,
      lastPr: null,
      lastError: null,
    }),
}));
