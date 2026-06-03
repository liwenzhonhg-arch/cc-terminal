import { useT } from "@/i18n";
import { useSettingsStore } from "@/store/settings";

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const t = useT();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="font-mono text-2xs text-muted hover:text-ink transition-colors"
      aria-label={t("theme.toggle")}
    >
      {theme === "light" ? `[ ${t("theme.light")} ]` : `[ ${t("theme.dark")} ]`}
    </button>
  );
}
