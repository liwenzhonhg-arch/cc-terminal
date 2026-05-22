import { query } from "@anthropic-ai/claude-agent-sdk";

console.log("Starting query...");

try {
  for await (const msg of query({
    prompt: "say hi in one word",
    options: {
      model: "claude-haiku-4-5-20251001",
      permissionMode: "acceptEdits",
    },
  })) {
    console.log(JSON.stringify(msg));
  }
  console.log("Done");
} catch (err) {
  console.error("Error:", err.message ?? err);
  console.error("Full:", JSON.stringify(err, null, 2));
}
