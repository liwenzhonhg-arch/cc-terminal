import type React from "react";

export const markdownComponents: Record<string, React.FC<Record<string, unknown>>> = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-[1.7]">{children as React.ReactNode}</p>
  ),
  h1: ({ children }) => (
    <h1 className="font-serif text-lg font-medium mt-8 mb-3 text-ink tracking-tight">
      {children as React.ReactNode}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-serif text-base font-medium mt-6 mb-2 text-ink">
      {children as React.ReactNode}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-sans text-sm font-semibold mt-5 mb-2 text-ink uppercase tracking-operator">
      {children as React.ReactNode}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1 pl-4">{children as React.ReactNode}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 space-y-1 pl-4 list-decimal">{children as React.ReactNode}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-[1.7] text-ink/90 relative before:content-['·'] before:absolute before:-left-3 before:text-faint [ol_&]:before:content-none list-none">
      {children as React.ReactNode}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children as React.ReactNode}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-ink/80">{children as React.ReactNode}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href as string}
      className="text-amber underline underline-offset-2 decoration-amber/30 hover:decoration-amber/70 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children as React.ReactNode}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = (className as string | undefined)?.includes("language-");
    if (isBlock) {
      const lang = (className as string)?.replace("language-", "") ?? "";
      return (
        <div className="my-4 rounded border-2 border-border overflow-hidden">
          {lang && (
            <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-surface-raised">
              <span className="font-mono text-2xs text-muted">{lang}</span>
            </div>
          )}
          <pre className="bg-surface-raised px-3 py-2.5 overflow-x-auto">
            <code className="font-mono text-xs text-ink/85 leading-relaxed" {...props}>
              {children as React.ReactNode}
            </code>
          </pre>
        </div>
      );
    }
    return (
      <code
        className="font-mono text-xs bg-surface-raised px-1 py-px rounded border border-border/60 text-ink/85"
        {...props}
      >
        {children as React.ReactNode}
      </code>
    );
  },
  pre: ({ children }) => <>{children as React.ReactNode}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber/40 pl-3 my-4 text-muted italic">
      {children as React.ReactNode}
    </blockquote>
  ),
  hr: () => (
    <div className="my-8 flex items-center gap-3 text-border">
      <span className="flex-1 h-px bg-border" />
      <span className="font-mono text-2xs select-none">◆</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded border border-border">
      <table className="w-full font-mono text-xs border-collapse">
        {children as React.ReactNode}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 border-b border-border bg-surface-raised/80 font-medium text-2xs uppercase tracking-operator text-muted">
      {children as React.ReactNode}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-border/40 text-ink/75">
      {children as React.ReactNode}
    </td>
  ),
};
