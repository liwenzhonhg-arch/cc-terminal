// === Inbound messages (stdin, from Rust backend) ===

export type HelloMessage = {
  type: "hello";
  cwd: string;
  systemPrompt?: string;
  model?: string;
  allowedTools?: string[];
  permissionMode?: string;
  sessionId?: string;
};

export type UserMessage = {
  type: "user";
  content: string;
};

export type InterruptMessage = {
  type: "interrupt";
};

export type ShutdownMessage = {
  type: "shutdown";
};

export type InboundMessage =
  | HelloMessage
  | UserMessage
  | InterruptMessage
  | ShutdownMessage;

// === Outbound messages (stdout, to Rust backend) ===

export type EventOutMessage = {
  type: "event";
  eventType: string;
  data: unknown;
};

export type UsageOutMessage = {
  type: "usage";
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  sessionId: string;
};

export type StatusOutMessage = {
  type: "status";
  state: "idle" | "thinking" | "tool_use" | "awaiting_input" | "done" | "error";
};

export type ErrorOutMessage = {
  type: "error";
  message: string;
};

export type OutboundMessage =
  | EventOutMessage
  | UsageOutMessage
  | StatusOutMessage
  | ErrorOutMessage;

export function parseInbound(line: string): InboundMessage | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
      return parsed as InboundMessage;
    }
    return null;
  } catch {
    return null;
  }
}

export function sendOut(msg: OutboundMessage): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
