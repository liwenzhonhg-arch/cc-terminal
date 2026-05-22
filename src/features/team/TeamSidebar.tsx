import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTeamStore, type TeamAgent, type TeamAgentStatus } from "@/store/team";
import { useAgentStore } from "@/store/agents";
import { AddMemberDialog } from "./AddMemberDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { abbreviatePath } from "@/lib/fmt";

const STATUS_DOT: Record<TeamAgentStatus, { color: string; symbol: string; label: string }> = {
  idle: { color: "text-muted", symbol: "○", label: "idle" },
  thinking: { color: "text-amber", symbol: "●", label: "thinking..." },
  tool_use: { color: "text-amber", symbol: "●", label: "tool use" },
  done: { color: "text-moss", symbol: "✓", label: "done" },
  error: { color: "text-vermilion", symbol: "✕", label: "error" },
  spawning: { color: "text-muted", symbol: "◐", label: "spawning..." },
};

function AgentItem({
  agent,
  teamId,
}: {
  agent: TeamAgent;
  teamId: string;
}) {
  const removeAgent = useTeamStore((s) => s.removeAgent);
  const dot = STATUS_DOT[agent.status];

  const handleRemove = async () => {
    try {
      await invoke("remove_team_agent", {
        teamId,
        agentName: agent.name,
      });
      removeAgent(agent.name);
    } catch (err) {
      console.error("Remove agent failed:", err);
    }
  };

  return (
    <div className="group flex items-start gap-2 px-3 py-2 hover:bg-border/10 transition-colors">
      <span className={`${dot.color} text-xs mt-0.5 shrink-0 select-none`}>
        {dot.symbol}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-ink font-semibold truncate">
            {agent.name}
          </span>
          {agent.role === "lead" && (
            <span className="font-mono text-2xs text-amber/70 uppercase tracking-operator shrink-0">
              TL
            </span>
          )}
        </div>
        <div className="font-mono text-2xs text-faint truncate">
          {dot.label}
        </div>
        <div className="font-sans text-2xs text-faint truncate mt-0.5">
          {agent.description.slice(0, 50)}
        </div>
      </div>
      {agent.role !== "lead" && (
        <button
          onClick={handleRemove}
          className="font-mono text-2xs text-faint opacity-0 group-hover:opacity-100 hover:text-vermilion transition-all shrink-0 select-none mt-0.5"
          title="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function TeamSidebar({ teamId, width }: { teamId: string; width: number }) {
  const team = useTeamStore((s) => s.team);
  const clearTeam = useTeamStore((s) => s.clearTeam);
  const setActiveTeamId = useAgentStore((s) => s.setActiveTeamId);
  const removeTeamEntry = useAgentStore((s) => s.removeTeamEntry);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);

  if (!team) return null;

  const allAgents: TeamAgent[] = [
    ...(team.lead ? [team.lead] : []),
    ...team.members,
  ];

  const handleDisband = async () => {
    try {
      await invoke("disband_team", { teamId });
      clearTeam();
      removeTeamEntry(teamId);
      setActiveTeamId(null);
      setShowDisbandConfirm(false);
    } catch (err) {
      console.error("Disband failed:", err);
    }
  };

  return (
    <>
      <aside className="shrink-0 border-l border-border/30 bg-surface flex flex-col" style={{ width }}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-amber select-none text-xs">◈</span>
            <span className="font-sans text-sm font-semibold text-ink truncate">
              {team.name}
            </span>
          </div>
          <span className="font-mono text-2xs text-faint truncate block">
            {abbreviatePath(team.cwd)}
          </span>
        </div>

        {/* Agent list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {allAgents.map((agent) => (
            <AgentItem key={agent.name} agent={agent} teamId={teamId} />
          ))}

          {allAgents.length === 0 && (
            <div className="px-3 py-4 font-mono text-2xs text-faint">
              No agents yet
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-border/50 px-3 py-2 space-y-1">
          <button
            onClick={() => setShowAddDialog(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-xs text-muted hover:text-ink hover:bg-border/40 transition-colors"
          >
            <span className="text-moss/70 w-4 text-center shrink-0 select-none">
              +
            </span>
            <span>Add Member</span>
          </button>
          <button
            onClick={() => setShowDisbandConfirm(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-xs text-muted hover:text-vermilion hover:bg-vermilion/5 transition-colors"
          >
            <span className="text-vermilion/50 w-4 text-center shrink-0 select-none">
              ×
            </span>
            <span>Disband</span>
          </button>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/30 px-3 py-1.5 flex items-center justify-between">
          <span className="font-mono text-2xs text-faint cc-num">
            {allAgents.length} agents
          </span>
          <span className="font-mono text-2xs text-amber/60 cc-num">
            ${team.totalCost.toFixed(4)}
          </span>
        </div>
      </aside>

      {showAddDialog && (
        <AddMemberDialog
          teamId={teamId}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      <ConfirmDialog
        open={showDisbandConfirm}
        title="Disband Team"
        description={`Kill all ${allAgents.length} agents and close this team?`}
        confirmLabel="Disband"
        onConfirm={handleDisband}
        onCancel={() => setShowDisbandConfirm(false)}
      />
    </>
  );
}
