import { useEffect, useState } from "react";
import { useT } from "@/i18n";

type Theme = "light" | "dark";

const STORAGE_KEY = "cc-terminal:theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitial);
  const t = useT();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      className="font-mono text-2xs text-muted hover:text-ink transition-colors"
      aria-label={t("theme.toggle")}
    >
      {theme === "light" ? `[ ${t("theme.light")} ]` : `[ ${t("theme.dark")} ]`}
    </button>
  );
}
