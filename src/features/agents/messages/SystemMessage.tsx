import { invoke } from "@tauri-apps/api/core";

export function SystemMessage({ content }: { content: string }) {
  const isAuthError = content.includes("403") || content.includes("authenticate");

  const handleLogin = () => {
    invoke("open_login").catch((err) =>
      console.error("open_login failed:", err)
    );
  };

  return (
    <div className="mb-6 py-2.5 px-3 rounded border border-vermilion/15 bg-vermilion/[0.03]">
      <div className="flex items-start gap-2">
        <span className="font-mono text-2xs text-vermilion shrink-0 mt-px select-none">!</span>
        <span className="font-mono text-xs text-vermilion/70 break-words leading-relaxed">
          {content}
        </span>
      </div>
      {isAuthError && (
        <button
          onClick={handleLogin}
          className="mt-3 ml-4 px-3 py-1.5 font-mono text-2xs text-amber border border-amber/25 rounded hover:bg-amber/8 hover:border-amber/40 transition-colors"
        >
          Login with Claude.ai
        </button>
      )}
    </div>
  );
}
