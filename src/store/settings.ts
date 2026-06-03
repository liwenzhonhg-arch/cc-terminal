import { create } from "zustand";

export type Locale = "zh" | "en";
export type Theme = "light" | "dark";

const SETTINGS_KEY = "cc-terminal:settings:v1";
const THEME_KEY = "cc-terminal:theme";

type PersistedSettings = {
  version: 1;
  locale: Locale;
};

type SettingsStore = {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

function loadSettings(): PersistedSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedSettings;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const hydrated = loadSettings();
const initialTheme = readInitialTheme();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  locale: hydrated?.locale ?? "zh",
  theme: initialTheme,
  setLocale: (locale) => set({ locale }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
}));

useSettingsStore.subscribe((state) => {
  const persisted: PersistedSettings = { version: 1, locale: state.locale };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted));
  } catch { /* quota */ }
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";

  document.documentElement.dataset.theme = state.theme;
  try {
    localStorage.setItem(THEME_KEY, state.theme);
  } catch { /* quota */ }
});

document.documentElement.lang = (hydrated?.locale ?? "zh") === "zh" ? "zh-CN" : "en";
document.documentElement.dataset.theme = initialTheme;
