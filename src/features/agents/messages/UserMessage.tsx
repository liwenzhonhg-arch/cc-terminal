import { formatTime } from "@/lib/fmt";
import { useT } from "@/i18n";

export function UserMessage({ content, ts }: { content: string; ts: number }) {
  const t = useT();
  return (
    <div className="mb-5 pb-5 border-b border-border/60">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-ink uppercase tracking-operator font-medium">{t("message.you")}</span>
        <span className="font-mono text-[10px] text-faint cc-num">{formatTime(ts)}</span>
      </div>
      <div className="font-sans text-[14px] text-ink leading-[1.65] whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}
