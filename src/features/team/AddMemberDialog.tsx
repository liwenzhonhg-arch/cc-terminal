import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTeamStore } from "@/store/team";

type AddMemberDialogProps = {
  teamId: string;
  onClose: () => void;
};

export function AddMemberDialog({ teamId, onClose }: AddMemberDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addAgent = useTeamStore((s) => s.addAgent);

  const isValidName = /^[a-z0-9-]+$/.test(name) && name.length > 0;

  const handleSubmit = async () => {
    if (!isValidName || !description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const agentId = await invoke<string>("add_team_agent", {
        teamId,
        agentName: name,
        role: "member",
        description: description.trim(),
      });
      addAgent({
        name,
        role: "member",
        description: description.trim(),
        agentId,
        status: "idle",
      });
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

      <div className="relative bg-surface border-2 border-border rounded-sm w-[380px] max-w-[90vw] shadow-lg">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="font-serif text-sm text-ink">Add Team Member</h3>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Name (@mention identifier)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="frontend"
              className="w-full bg-surface-raised/80 border border-border rounded-sm px-3 py-2 font-mono text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink/20"
              autoFocus
            />
            {name && !isValidName && (
              <span className="font-mono text-2xs text-vermilion mt-0.5 block">
                Only lowercase letters, numbers, hyphens
              </span>
            )}
          </div>

          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Description (injected as system prompt)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Frontend specialist. Handles React components, CSS, and UI implementation."
              rows={3}
              className="w-full bg-surface-raised/80 border border-border rounded-sm px-3 py-2 font-sans text-sm text-ink placeholder:text-faint focus:outline-none focus:border-ink/20 resize-none"
            />
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
            onClick={handleSubmit}
            disabled={!isValidName || !description.trim() || loading}
            className="font-mono text-xs text-white bg-moss hover:bg-moss/80 disabled:opacity-50 px-3 py-1.5 rounded-sm transition-colors"
          >
            {loading ? "Spawning..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
