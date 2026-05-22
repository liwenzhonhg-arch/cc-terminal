import { useState, useCallback, useRef } from "react";
import { filterCommands, type SlashCommand } from "./commands";

type UseSlashCommandsReturn = {
  showPopup: boolean;
  filteredCommands: SlashCommand[];
  selectedIndex: number;
  updateFromInput: (input: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectCommand: (cmd: SlashCommand) => string;
  closePopup: () => void;
};

export function useSlashCommands(): UseSlashCommandsReturn {
  const [showPopup, setShowPopup] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const showRef = useRef(false);
  const commandsRef = useRef<SlashCommand[]>([]);

  const updateFromInput = useCallback((input: string) => {
    const match = input.match(/^\/([\w-]*)$/);
    if (match) {
      const query = match[1];
      const filtered = filterCommands(query);
      commandsRef.current = filtered;
      showRef.current = filtered.length > 0;
      setFilteredCommands(filtered);
      setSelectedIndex(0);
      setShowPopup(filtered.length > 0);
    } else {
      showRef.current = false;
      setShowPopup(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!showRef.current || commandsRef.current.length === 0) return false;

      switch (e.key) {
        case "ArrowUp": {
          setSelectedIndex((prev) =>
            prev <= 0 ? commandsRef.current.length - 1 : prev - 1
          );
          return true;
        }
        case "ArrowDown": {
          setSelectedIndex((prev) =>
            prev >= commandsRef.current.length - 1 ? 0 : prev + 1
          );
          return true;
        }
        case "Tab":
        case "Enter":
          return true;
        case "Escape": {
          showRef.current = false;
          setShowPopup(false);
          return true;
        }
        default:
          return false;
      }
    },
    []
  );

  const selectCommand = useCallback((cmd: SlashCommand): string => {
    showRef.current = false;
    setShowPopup(false);
    return `/${cmd.name} `;
  }, []);

  const closePopup = useCallback(() => {
    showRef.current = false;
    setShowPopup(false);
  }, []);

  return {
    showPopup,
    filteredCommands,
    selectedIndex,
    updateFromInput,
    handleKeyDown,
    selectCommand,
    closePopup,
  };
}
