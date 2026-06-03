import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "@/store/agents";
import { getEnabledSkillNames } from "@/store/console";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
        skills: getEnabledSkillNames() ?? null,
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Team Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Refactoring Squad"
              autoFocus
              className="font-sans text-sm"
            />
          </div>

          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Team Lead Description
            </label>
            <Textarea
              value={tlDescription}
              onChange={(e) => setTlDescription(e.target.value)}
              rows={3}
              className="font-sans text-sm resize-none"
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

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || !tlDescription.trim() || loading}
          >
            {loading ? "Creating..." : "Create & Open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
