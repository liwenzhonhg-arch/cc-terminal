import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/sidecar.mjs",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: [
    "@anthropic-ai/claude-agent-sdk",
  ],
});

console.log("sidecar built → dist/sidecar.mjs");
