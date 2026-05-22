import { useSettingsStore, type Locale } from "@/store/settings";
import { zh, type TranslationKey } from "./zh";
import { en } from "./en";

const translations: Record<Locale, Record<TranslationKey, string>> = { zh, en };

export type { TranslationKey, Locale };

export function useT(): (key: TranslationKey, params?: Record<string, string | number>) => string {
  const locale = useSettingsStore((s) => s.locale);
  return (key, params) => {
    let text = translations[locale][key] ?? translations.zh[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = useSettingsStore.getState().locale;
  let text = translations[locale][key] ?? translations.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
