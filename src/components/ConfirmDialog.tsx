import { useEffect, useRef } from "react";
import { useT } from "@/i18n";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-surface border-2 border-border rounded-sm w-[360px] max-w-[90vw] shadow-lg"
      >
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="font-serif text-sm text-ink">{title}</h3>
        </div>

        <div className="px-4 py-3">
          <p className="font-sans text-xs text-muted">{description}</p>
          {detail && (
            <div className="mt-2 px-2 py-1.5 bg-border/40 rounded-sm">
              <code className="font-mono text-2xs text-muted break-all">{detail}</code>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border/50 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="font-mono text-xs text-muted hover:text-ink px-3 py-1.5 border border-border/50 rounded-sm transition-colors"
          >
            {t("dialog.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="font-mono text-xs text-white bg-vermilion hover:bg-vermilion/80 px-3 py-1.5 rounded-sm transition-colors"
          >
            {confirmLabel ?? t("dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
