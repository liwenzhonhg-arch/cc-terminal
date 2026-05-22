export function CommandMessage({ content }: { content: string }) {
  return (
    <div className="mb-6 py-2.5 px-3 rounded border border-border/50 bg-surface-raised/30">
      <div className="flex items-start gap-2">
        <span className="font-mono text-2xs text-amber shrink-0 mt-px select-none">/</span>
        <span className="font-mono text-xs text-muted leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </span>
      </div>
    </div>
  );
}
