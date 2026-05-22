import { create } from "zustand";

export type TeamAgentStatus =
  | "idle"
  | "thinking"
  | "tool_use"
  | "done"
  | "error"
  | "spawning";

export type TeamAgent = {
  name: string;
  role: "lead" | "member";
  description: string;
  agentId: string | null;
  status: TeamAgentStatus;
};

export type TeamMessage = {
  id: string;
  agentName: string | null;
  agentRole: string | null;
  content: string;
  timestamp: number;
  raw?: unknown;
  messageType:
    | "user"
    | "assistant"
    | "tool_use"
    | "tool_result"
    | "system"
    | "status";
};

export type TeamConfig = {
  id: string;
  name: string;
  cwd: string;
  lead: TeamAgent | null;
  members: TeamAgent[];
  messages: TeamMessage[];
  totalCost: number;
};

type TeamStore = {
  team: TeamConfig | null;

  setTeam: (config: TeamConfig) => void;
  addAgent: (agent: TeamAgent) => void;
  removeAgent: (agentName: string) => void;
  setAgentStatus: (agentName: string, status: TeamAgentStatus) => void;
  setAgentId: (agentName: string, agentId: string) => void;
  appendMessage: (msg: TeamMessage) => void;
  updateCost: (delta: number) => void;
  clearMessages: () => void;
  clearTeam: () => void;
};

export const useTeamStore = create<TeamStore>((set) => ({
  team: null,

  setTeam: (config) => set({ team: config }),

  addAgent: (agent) =>
    set((s) => {
      if (!s.team) return s;
      if (agent.role === "lead") {
        return { team: { ...s.team, lead: agent } };
      }
      return {
        team: { ...s.team, members: [...s.team.members, agent] },
      };
    }),

  removeAgent: (agentName) =>
    set((s) => {
      if (!s.team) return s;
      if (s.team.lead?.name === agentName) {
        return { team: { ...s.team, lead: null } };
      }
      return {
        team: {
          ...s.team,
          members: s.team.members.filter((m) => m.name !== agentName),
        },
      };
    }),

  setAgentStatus: (agentName, status) =>
    set((s) => {
      if (!s.team) return s;
      const team = { ...s.team };
      if (team.lead?.name === agentName) {
        team.lead = { ...team.lead, status };
      } else {
        team.members = team.members.map((m) =>
          m.name === agentName ? { ...m, status } : m
        );
      }
      return { team };
    }),

  setAgentId: (agentName, agentId) =>
    set((s) => {
      if (!s.team) return s;
      const team = { ...s.team };
      if (team.lead?.name === agentName) {
        team.lead = { ...team.lead, agentId };
      } else {
        team.members = team.members.map((m) =>
          m.name === agentName ? { ...m, agentId } : m
        );
      }
      return { team };
    }),

  appendMessage: (msg) =>
    set((s) => {
      if (!s.team) return s;
      return {
        team: { ...s.team, messages: [...s.team.messages, msg] },
      };
    }),

  updateCost: (delta) =>
    set((s) => {
      if (!s.team) return s;
      return {
        team: { ...s.team, totalCost: s.team.totalCost + delta },
      };
    }),

  clearMessages: () =>
    set((s) => {
      if (!s.team) return s;
      return { team: { ...s.team, messages: [], totalCost: 0 } };
    }),

  clearTeam: () => set({ team: null }),
}));
