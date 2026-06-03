import { useAgentStore, type PanelId } from "@/store/agents";
import { useT } from "@/i18n";
import { CostPanelContent } from "@/features/agents/CostPanel";
import { SkillsPanelContent } from "@/features/console/SkillsPanelContent";
import { McpPanelContent } from "@/features/console/McpPanelContent";
import { PluginsPanelContent } from "@/features/console/PluginsPanelContent";
import { HooksPanelContent } from "@/features/console/HooksPanelContent";
import { GitPanelContent } from "@/features/agents/GitPanelContent";
import { SettingsPanelContent } from "@/components/SettingsPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PANEL_ICONS: Record<PanelId, string> = {
  cost: "$",
  skills: "◇",
  mcp: "⊞",
  plugins: "▣",
  hooks: "↪",
  git: "⊕",
  settings: "⚙",
};

export function RightPanelContainer({ width }: { width: number }) {
  const t = useT();
  const activeTab = useAgentStore((s) => s.rightPanelActiveTab);
  const tabs = useAgentStore((s) => s.rightPanelTabs);
  const activatePanel = useAgentStore((s) => s.activatePanel);
  const togglePanel = useAgentStore((s) => s.togglePanel);

  if (activeTab === null || tabs.length === 0) return null;

  const panelLabel = (id: PanelId): string => {
    const map: Record<PanelId, string> = {
      cost: t("sidebar.cost"),
      skills: t("panel.skills"),
      mcp: t("panel.mcp"),
      plugins: t("panel.plugins"),
      hooks: t("sidebar.hooks"),
      git: t("panel.git"),
      settings: t("sidebar.settings"),
    };
    return map[id];
  };

  return (
    <aside className="shrink-0 border-l border-border/30 bg-surface flex flex-col overflow-hidden" style={{ width }}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => activatePanel(v as PanelId)}
        className="flex flex-col h-full"
      >
        {tabs.length > 1 && (
          <TabsList className="shrink-0 w-full justify-start overflow-x-auto">
            {tabs.map((id) => (
              <div key={id} className="relative flex items-center">
                <TabsTrigger value={id} className="gap-1 pr-6">
                  <span className="text-amber/70 select-none">{PANEL_ICONS[id]}</span>
                  {panelLabel(id)}
                </TabsTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0.5 h-4 w-4 p-0 text-faint hover:text-vermilion"
                  onClick={() => togglePanel(id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </TabsList>
        )}

        <TabsContent value="cost" className="overflow-hidden cc-panel-enter"><CostPanelContent /></TabsContent>
        <TabsContent value="skills" className="overflow-hidden cc-panel-enter"><SkillsPanelContent /></TabsContent>
        <TabsContent value="mcp" className="overflow-hidden cc-panel-enter"><McpPanelContent /></TabsContent>
        <TabsContent value="plugins" className="overflow-hidden cc-panel-enter"><PluginsPanelContent /></TabsContent>
        <TabsContent value="hooks" className="overflow-hidden cc-panel-enter"><HooksPanelContent /></TabsContent>
        <TabsContent value="git" className="overflow-hidden cc-panel-enter"><GitPanelContent /></TabsContent>
        <TabsContent value="settings" className="overflow-hidden cc-panel-enter"><SettingsPanelContent /></TabsContent>
      </Tabs>
    </aside>
  );
}
