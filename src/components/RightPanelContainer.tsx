import { useAgentStore } from "@/store/agents";
import { CostPanelContent } from "@/features/agents/CostPanel";
import { SkillsPanelContent } from "@/features/console/SkillsPanelContent";
import { McpPanelContent } from "@/features/console/McpPanelContent";
import { PluginsPanelContent } from "@/features/console/PluginsPanelContent";
import { HooksPanelContent } from "@/features/console/HooksPanelContent";
import { GitPanelContent } from "@/features/agents/GitPanelContent";
import { SettingsPanelContent } from "@/components/SettingsPanel";

export function RightPanelContainer({ width }: { width: number }) {
  const activeTab = useAgentStore((s) => s.rightPanelActiveTab);

  if (activeTab === null) return null;

  return (
    <aside className="shrink-0 border-l border-border/30 bg-surface flex flex-col overflow-hidden" style={{ width }}>
      {activeTab === "cost" && <CostPanelContent />}
      {activeTab === "skills" && <SkillsPanelContent />}
      {activeTab === "mcp" && <McpPanelContent />}
      {activeTab === "plugins" && <PluginsPanelContent />}
      {activeTab === "hooks" && <HooksPanelContent />}
      {activeTab === "git" && <GitPanelContent />}
      {activeTab === "settings" && <SettingsPanelContent />}
    </aside>
  );
}
