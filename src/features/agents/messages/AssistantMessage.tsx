import ReactMarkdown from "react-markdown";
import { markdownComponents } from "../markdownComponents";

export function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="mb-6 pl-3 border-l border-border">
      <div className="prose-cc font-sans text-sm text-ink leading-[1.7]">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
