import type { Message } from "@/store/agents";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SystemMessage } from "./SystemMessage";
import { CommandMessage } from "./CommandMessage";
import { ToolCard } from "./ToolCard";
import { ToolResult } from "./ToolResult";

export function MessageBlock({ message }: { message: Message }) {
  switch (message.role) {
    case "user":
      return <UserMessage content={message.content} ts={message.timestamp} />;
    case "assistant":
      return <AssistantMessage content={message.content} />;
    case "tool_use":
      return <ToolCard message={message} />;
    case "tool_result":
      return <ToolResult message={message} />;
    case "system":
      return <SystemMessage content={message.content} />;
    case "command":
      return <CommandMessage content={message.content} />;
    default:
      return null;
  }
}
