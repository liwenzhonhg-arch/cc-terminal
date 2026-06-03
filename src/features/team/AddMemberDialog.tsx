import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTeamStore } from "@/store/team";
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
        skills: getEnabledSkillNames() ?? null,
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
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block font-mono text-2xs text-muted mb-1">
              Name (@mention identifier)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="frontend"
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
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Frontend specialist. Handles React components, CSS, and UI implementation."
              rows={3}
              className="font-sans text-sm resize-none"
            />
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
            className="bg-moss hover:bg-moss/80 text-white"
            onClick={handleSubmit}
            disabled={!isValidName || !description.trim() || loading}
          >
            {loading ? "Spawning..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
