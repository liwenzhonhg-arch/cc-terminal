import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "@/store/agents";

type CreateTeamDialogProps = {
  defaultCwd: string;
  onClose: () => void;
};

export function CreateTeamDialog({ defaultCwd, onClose }: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [tlDescription, setTlDescription] = useState(
    "Coordinate tasks and delegate to team members"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addTeamEntry = useAgentStore((s) => s.addTeamEntry);
  const setActiveTeamId = useAgentStore((s) => s.setActiveTeamId);

  const handleCreate = async () => {
    if (!name.trim() || !tlDescription.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const teamId = await invoke<string>("create_team", {
        name: name.trim(),
        cwd: defaultCwd,
      });

      await invoke<string>("add_team_agent", {
        teamId,
        agentName: "lead",
        role: "lead",
        description: tlDescription.trim(),
      });

      addTeamEntry({ id: teamId, name: name.trim(), cwd: defaultCwd });
      setActiveTeamId(teamId);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-surface border-2 border-border rounded-sm w-[400px] max-w-[90vw] shadow-lg">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="font-serif text-sm text-ink">Create Team</h3>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Refactoring Squad"
              className="w-full bg-surface-raised/80 border border-border rounded-sm px-3 py-2 font-sans text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Team Lead Description
            </label>
            <textarea
              value={tlDescription}
              onChange={(e) => setTlDescription(e.target.value)}
              rows={3}
              className="w-full bg-surface-raised/80 border border-border rounded-sm px-3 py-2 font-sans text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink/20 resize-none"
            />
            <span className="font-mono text-2xs text-faint mt-0.5 block">
              Injected as TL system prompt. Members can be added after creation.
            </span>
          </div>

          <div className="px-2 py-1.5 bg-border/40 rounded-sm">
            <span className="font-mono text-2xs text-muted">
              Working directory: {defaultCwd}
            </span>
          </div>

          {error && (
            <div className="px-2 py-1.5 bg-vermilion/10 border border-vermilion/20 rounded-sm">
              <span className="font-mono text-2xs text-vermilion">{error}</span>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted hover:text-ink px-3 py-1.5 border border-border/50 rounded-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !tlDescription.trim() || loading}
            className="font-mono text-xs text-white bg-amber hover:bg-amber/80 disabled:opacity-50 px-3 py-1.5 rounded-sm transition-colors"
          >
            {loading ? "Creating..." : "Create & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
