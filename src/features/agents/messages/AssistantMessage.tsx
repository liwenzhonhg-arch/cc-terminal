import ReactMarkdown from "react-markdown";
import { markdownComponents } from "../markdownComponents";

export function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="mb-5 pl-3 border-l-2 border-border-strong">
      <div className="flex items-center mb-2">
        <span className="font-mono text-[10px] text-amber uppercase tracking-operator font-medium">Assistant</span>
      </div>
      <div className="prose-cc font-sans text-[14px] text-ink/95 leading-[1.7]">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
