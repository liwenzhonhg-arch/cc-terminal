import { formatTime } from "@/lib/fmt";
import { useT } from "@/i18n";

export function UserMessage({ content, ts }: { content: string; ts: number }) {
  const t = useT();
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="font-mono text-2xs text-muted tracking-operator uppercase">{t("message.you")}</span>
        <span className="font-mono text-2xs text-faint cc-num">{formatTime(ts)}</span>
      </div>
      <div className="font-sans text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}
