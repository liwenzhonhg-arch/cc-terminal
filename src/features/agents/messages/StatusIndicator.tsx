import type { ThreadStatus } from "@/store/agents";
import { useT } from "@/i18n";

export function StatusIndicator({ status }: { status: ThreadStatus }) {
  const t = useT();
  const label = status === "thinking" ? t("status.reasoning") : t("status.executing");
  return (
    <div className="flex items-center gap-3 py-4 mt-2">
      <span className="inline-block w-[3px] h-4 bg-amber rounded-[1px] animate-[blink_1.06s_steps(2)_infinite]" />
      <span className="font-mono text-2xs text-amber tracking-operator uppercase">
        {label}
      </span>
    </div>
  );
}
