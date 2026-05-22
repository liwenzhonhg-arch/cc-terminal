export function formatTokenCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(ts: number, locale: "zh" | "en" = "en"): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return locale === "zh" ? "刚刚" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "zh" ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return locale === "zh" ? `${days} 天前` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
}

export function abbreviatePath(fullPath: string): string {
  const home = /^[A-Z]:\\Users\\[^\\]+/i.exec(fullPath)?.[0];
  let result = home ? "~" + fullPath.slice(home.length) : fullPath;
  result = result.replace(/\\/g, "/");
  if (result.length <= 30) return result;
  const parts = result.split("/").filter(Boolean);
  if (parts.length <= 2) return result;
  return ".../" + parts.slice(-2).join("/");
}
