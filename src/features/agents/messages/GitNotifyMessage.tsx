import type { Message } from "@/store/agents";
import { useAgentStore } from "@/store/agents";
import { useT } from "@/i18n";

type GitNotifyRaw = {
  files: { path: string; status: string; staged: boolean }[];
  cwd: string;
};

export function GitNotifyMessage({ message }: { message: Message }) {
  const t = useT();
  const activatePanel = useAgentStore((s) => s.activatePanel);
  const raw = message.raw as GitNotifyRaw | undefined;
  const files = raw?.files ?? [];

  const modified = files.filter((f) => f.status === "M").length;
  const added = files.filter((f) => f.status === "A" || f.status === "?").length;
  const deleted = files.filter((f) => f.status === "D").length;

  const parts: string[] = [];
  if (modified > 0) parts.push(`${modified} ${t("git.statusM")}`);
  if (added > 0) parts.push(`${added} ${t("git.statusA")}`);
  if (deleted > 0) parts.push(`${deleted} ${t("git.statusD")}`);

  return (
    <div className="mb-6 py-3 px-3 border border-border/50 bg-surface-raised/20">
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs text-amber shrink-0 mt-px select-none">◆</span>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-ink">{t("git.notifyTitle")}</p>
          <p className="font-mono text-2xs text-muted mt-0.5">
            {files.length} {t("git.notifyFiles")}
            {parts.length > 0 && ` (${parts.join(", ")})`}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => activatePanel("git")}
              className="font-mono text-2xs text-amber hover:text-amber/80 transition-colors"
            >
              {t("git.notifyOpen")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
