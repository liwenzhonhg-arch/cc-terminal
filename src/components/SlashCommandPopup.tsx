import { useRef, useEffect } from "react";
import type { SlashCommand } from "@/lib/commands";
import { useT } from "@/i18n";

type SlashCommandPopupProps = {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
};

export function SlashCommandPopup({ commands, selectedIndex, onSelect, onClose }: SlashCommandPopupProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={listRef}
      className="absolute left-8 bottom-full mb-1 w-64 border border-border rounded-sm bg-surface max-h-[280px] overflow-y-auto z-50"
    >
      {commands.map((cmd, i) => {
        const isDeferred = cmd.category === "deferred";
        const isSelected = i === selectedIndex;
        return (
          <button
            key={cmd.name}
            onClick={() => onSelect(cmd)}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
              isSelected ? "bg-border/40" : "hover:bg-border/10"
            } ${isDeferred ? "opacity-40" : ""}`}
          >
            <span className="font-mono text-2xs text-amber/70 w-4 text-center shrink-0 select-none">
              {cmd.icon}
            </span>
            <span className={`font-mono text-xs ${isDeferred ? "text-faint" : "text-ink"}`}>
              /{cmd.name}
            </span>
            <span className="font-mono text-2xs text-faint truncate flex-1">
              {t(cmd.descKey)}
            </span>
            {isDeferred && (
              <span className="font-mono text-2xs text-faint shrink-0">{t("cmd.soon")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
