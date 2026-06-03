import { useRef, useEffect } from "react";
import type { SlashCommand } from "@/lib/commands";
import { useT } from "@/i18n";
import {
  Command,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

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
      className="absolute left-8 bottom-full mb-1 w-64 z-50"
    >
      <Command className="border border-border">
        <CommandList>
          <CommandEmpty className="py-3 text-center font-mono text-2xs text-faint">
            {t("cmd.noResults")}
          </CommandEmpty>
          {commands.map((cmd, i) => {
            const isDeferred = cmd.category === "deferred";
            const isSelected = i === selectedIndex;
            return (
              <CommandItem
                key={cmd.name}
                onSelect={() => onSelect(cmd)}
                className={`${isSelected ? "bg-border/40" : ""} ${isDeferred ? "opacity-40" : ""}`}
              >
                <span className="text-amber/70 w-4 text-center shrink-0 select-none text-2xs">
                  {cmd.icon}
                </span>
                <span className={isDeferred ? "text-faint" : "text-ink"}>
                  /{cmd.name}
                </span>
                <span className="text-2xs text-faint truncate flex-1">
                  {t(cmd.descKey)}
                </span>
                {isDeferred && (
                  <span className="text-2xs text-faint shrink-0">{t("cmd.soon")}</span>
                )}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </div>
  );
}
