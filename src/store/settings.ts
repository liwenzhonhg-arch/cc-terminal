import { create } from "zustand";

export type Locale = "zh" | "en";

const SETTINGS_KEY = "cc-terminal:settings:v1";

type PersistedSettings = {
  version: 1;
  locale: Locale;
};

type SettingsStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
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

const hydrated = loadSettings();

export const useSettingsStore = create<SettingsStore>((set) => ({
  locale: hydrated?.locale ?? "zh",
  setLocale: (locale) => set({ locale }),
}));

useSettingsStore.subscribe((state) => {
  const persisted: PersistedSettings = { version: 1, locale: state.locale };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(persisted));
  } catch { /* quota */ }
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
});

document.documentElement.lang = (hydrated?.locale ?? "zh") === "zh" ? "zh-CN" : "en";
