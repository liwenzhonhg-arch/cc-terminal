import { useSettingsStore, type Locale } from "@/store/settings";
import { useT } from "@/i18n";

const LOCALE_OPTIONS: { value: Locale; labelKey: "settings.chinese" | "settings.english" }[] = [
  { value: "zh", labelKey: "settings.chinese" },
  { value: "en", labelKey: "settings.english" },
];

export function SettingsPanelContent() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-1.5 shrink-0">
        <span className="text-amber/70 font-mono text-xs select-none">⚙</span>
        <span className="font-serif text-sm text-ink">{t("settings.title")}</span>
      </div>

      <div className="px-4 py-4">
        <div className="font-mono text-2xs text-muted uppercase tracking-operator mb-3">
          {t("settings.language")}
        </div>
        <div className="space-y-1">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLocale(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-sm font-mono text-xs transition-colors ${
                locale === opt.value
                  ? "bg-border/50 text-ink"
                  : "text-muted hover:text-ink hover:bg-border/40"
              }`}
            >
              <span className="text-2xs select-none">
                {locale === opt.value ? "●" : "○"}
              </span>
              <span>{t(opt.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="font-mono text-2xs text-faint mt-2">
          {t("settings.languageDesc")}
        </div>
      </div>
    </div>
  );
}
