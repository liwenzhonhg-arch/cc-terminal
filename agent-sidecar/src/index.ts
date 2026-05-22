import { query } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "node:readline";
import {
  parseInbound,
  sendOut,
  type HelloMessage,
  type InboundMessage,
} from "./protocol.js";

let helloConfig: HelloMessage | null = null;
let sessionId: string | undefined;
let abortController: AbortController | null = null;

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line: string) => {
  const msg = parseInbound(line.trim());
  if (!msg) return;

  switch (msg.type) {
    case "hello":
      helloConfig = msg;
      if (msg.sessionId) {
        sessionId = msg.sessionId;
      }
      try { process.chdir(msg.cwd); } catch { /* keep current cwd */ }
      sendOut({ type: "status", state: "idle" });
      break;

    case "user":
      if (!helloConfig) {
        sendOut({ type: "error", message: "未收到 hello 消息，无法处理 user 请求" });
        return;
      }
      await handleUserMessage(msg.content);
      break;

    case "interrupt":
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      break;

    case "shutdown":
      rl.close();
      process.exit(0);
      break;
  }
});

rl.on("close", () => {
  process.exit(0);
});

async function handleUserMessage(content: string): Promise<void> {
  if (!helloConfig) return;

  abortController = new AbortController();
  sendOut({ type: "status", state: "thinking" });

  try {
    const options: Record<string, unknown> = {
      allowedTools: helloConfig.allowedTools ?? [
        "Read", "Edit", "Write", "Glob", "Grep", "Bash",
      ],
      permissionMode: helloConfig.permissionMode ?? "acceptEdits",
    };

    if (helloConfig.systemPrompt) {
      options.systemPrompt = helloConfig.systemPrompt;
    }
    if (helloConfig.model) {
      options.model = helloConfig.model;
    }
    if (sessionId) {
      options.resume = sessionId;
    }

    for await (const message of query({
      prompt: content,
      options: options as any,
      abortSignal: abortController?.signal,
    })) {
      if (abortController?.signal.aborted) break;

      // Capture session ID from init or result
      if (message.type === "system" && message.subtype === "init") {
        sessionId = (message as any).session_id;
      }

      // Forward all events as-is
      sendOut({
        type: "event",
        eventType: message.type,
        data: message,
      });

      // Track status changes
      if (message.type === "assistant") {
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          const hasToolUse = content.some(
            (b: any) => b.type === "tool_use"
          );
          if (hasToolUse) {
            sendOut({ type: "status", state: "tool_use" });
          }
        }
      }

      // Capture usage from result
      if (message.type === "result") {
        sessionId = (message as any).session_id ?? sessionId;
        const costUsd = (message as any).total_cost_usd ?? 0;
        sendOut({
          type: "usage",
          input: (message as any).input_tokens ?? 0,
          output: (message as any).output_tokens ?? 0,
          cacheRead: (message as any).cache_read_tokens ?? 0,
          cacheWrite: (message as any).cache_write_tokens ?? 0,
          costUsd,
          sessionId: sessionId ?? "",
        });
      }
    }

    sendOut({ type: "status", state: "idle" });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      sendOut({ type: "status", state: "idle" });
    } else {
      sendOut({ type: "error", message: String(err?.message ?? err) });
      sendOut({ type: "status", state: "error" });
    }
  } finally {
    abortController = null;
  }
}
