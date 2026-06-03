import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useConsoleStore, type SkillEntry } from "@/store/console";
import { ResizeDivider } from "@/components/ResizeDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";

export function SkillsPanelContent() {
  const t = useT();
  const skills = useConsoleStore((s) => s.skills);
  const loading = useConsoleStore((s) => s.skillsLoading);
  const search = useConsoleStore((s) => s.skillSearch);
  const filter = useConsoleStore((s) => s.skillFilter);
  const selectedSkill = useConsoleStore((s) => s.selectedSkill);
  const loadSkills = useConsoleStore((s) => s.loadSkills);
  const setSearch = useConsoleStore((s) => s.setSkillSearch);
  const setFilter = useConsoleStore((s) => s.setSkillFilter);
  const selectSkill = useConsoleStore((s) => s.selectSkill);
  const groupConfig = useConsoleStore((s) => s.skillGroupConfig);
  const setGroupDisplayName = useConsoleStore((s) => s.setGroupDisplayName);
  const setSkillGroup = useConsoleStore((s) => s.setSkillGroup);
  const toggleConfig = useConsoleStore((s) => s.skillToggleConfig);
  const setMasterEnabled = useConsoleStore((s) => s.setMasterEnabled);
  const toggleSkill = useConsoleStore((s) => s.toggleSkill);
  const pendingSkills = useConsoleStore((s) => s.pendingSkills);
  const addPendingSkill = useConsoleStore((s) => s.addPendingSkill);
  const removePendingSkill = useConsoleStore((s) => s.removePendingSkill);

  const getEffectiveNs = useCallback(
    (skill: SkillEntry) => {
      if (groupConfig.skillGroups[skill.name]) return groupConfig.skillGroups[skill.name];
      return skill.namespace ?? "local";
    },
    [groupConfig.skillGroups],
  );

  const isSkillEnabled = useCallback(
    (name: string) => toggleConfig.masterEnabled && !toggleConfig.disabledSkills.includes(name),
    [toggleConfig],
  );

  const enabledCount = skills.filter((s) => isSkillEnabled(s.name)).length;

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const filtered = skills.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, SkillEntry[]>>((acc, skill) => {
    const ns = getEffectiveNs(skill);
    if (!acc[ns]) acc[ns] = [];
    acc[ns].push(skill);
    return acc;
  }, {});

  const sortedGroups = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
    [grouped],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || skills.length === 0) return;
    initializedRef.current = true;
    const sg = useConsoleStore.getState().skillGroupConfig.skillGroups;
    const initial = new Set<string>();
    for (const s of skills) {
      const ns = sg[s.name] ?? s.namespace ?? "local";
      if (ns !== "local") initial.add(ns);
    }
    setCollapsed(initial);
  }, [skills]);

  const toggleGroup = (ns: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  const isExpanded = (ns: string) => !!search || !collapsed.has(ns);

  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newGroupInput, setNewGroupInput] = useState(false);
  const [newGroupValue, setNewGroupValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = (ns: string) => {
    setEditValue(groupConfig.groupNames[ns] ?? ns);
    setEditingGroup(ns);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (editingGroup && editValue.trim()) {
      setGroupDisplayName(editingGroup, editValue.trim());
    }
    setEditingGroup(null);
  };

  const allGroupKeys = useMemo(
    () => [...new Set([...Object.keys(grouped), ...Object.keys(groupConfig.groupNames)])].sort(),
    [grouped, groupConfig.groupNames],
  );

  const [detailHeight, setDetailHeight] = useState(200);

  const selected = selectedSkill ? skills.find((s) => s.name === selectedSkill) : null;
  const selectedNs = selected ? getEffectiveNs(selected) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber/70 font-mono text-xs select-none">{"◇"}</span>
          <span className="font-serif text-sm text-ink">{t("skills.title")}</span>
          <span className="font-mono text-2xs text-faint">
            {enabledCount}/{skills.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={toggleConfig.masterEnabled ? "success" : "outline"}
            className="cursor-pointer"
            onClick={() => setMasterEnabled(!toggleConfig.masterEnabled)}
            title={t("skills.masterToggle")}
          >
            {toggleConfig.masterEnabled ? t("skills.on") : t("skills.off")}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => loadSkills()} title={t("skills.refresh")}>
            ↻
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("skills.searchPlaceholder")}
          className="text-2xs h-7"
        />
        <div className="flex items-center gap-3 mt-1.5">
          {(["all", "installed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-2xs transition-colors ${
                filter === f ? "text-ink" : "text-faint hover:text-muted"
              }`}
            >
              {filter === f ? "●" : "○"} {f === "all" ? t("skills.all") : t("skills.installed")}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 font-mono text-2xs text-faint animate-pulse">
            {t("skills.scanning")}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-3 py-6 font-mono text-2xs text-faint text-center">
            {search ? t("skills.noMatch") : t("skills.noSkills")}
          </div>
        )}

        {sortedGroups.map(([ns, nsSkills]) => {
          const expanded = isExpanded(ns);
          return (
            <div key={ns}>
              <div className="w-full px-3 py-1.5 border-b border-border/30 flex items-center justify-between hover:bg-border/20 transition-colors">
                {editingGroup === ns ? (
                  <input
                    ref={renameInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingGroup(null);
                    }}
                    onBlur={commitRename}
                    className="flex-1 bg-transparent border border-amber/50 rounded-sm px-1 py-0 font-mono text-2xs text-ink focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => toggleGroup(ns)}
                    className="flex-1 text-left flex items-center gap-1 cursor-pointer"
                  >
                    <span className="font-mono text-2xs text-faint uppercase tracking-operator flex items-center gap-1">
                      <span className="select-none">{expanded ? "▾" : "▸"}</span>
                      {groupConfig.groupNames[ns] ?? ns}
                    </span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {editingGroup !== ns && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(ns); }}
                      className="font-mono text-2xs text-faint hover:text-ink transition-colors"
                      title={t("skills.renameGroup")}
                    >
                      {"✎"}
                    </button>
                  )}
                  <span className="font-mono text-2xs text-faint">
                    {nsSkills.filter((s) => isSkillEnabled(s.name)).length}/{nsSkills.length}
                  </span>
                </div>
              </div>
              {expanded &&
                nsSkills.map((skill) => {
                  const enabled = isSkillEnabled(skill.name);
                  return (
                    <button
                      key={skill.path}
                      onClick={() => selectSkill(selectedSkill === skill.name ? null : skill.name)}
                      className={`w-full text-left px-3 py-2 border-b border-border/20 transition-colors ${
                        selectedSkill === skill.name
                          ? "bg-border/60 text-ink"
                          : enabled
                            ? "text-muted hover:text-ink hover:bg-border/40"
                            : "text-faint/50 hover:text-faint hover:bg-border/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (toggleConfig.masterEnabled) toggleSkill(skill.name);
                          }}
                          className={`inline-flex items-center justify-center w-3.5 h-3.5 border text-2xs select-none shrink-0 ${
                            toggleConfig.masterEnabled ? "cursor-pointer" : "opacity-30 cursor-not-allowed"
                          } ${enabled ? "border-moss/50 text-moss" : "border-border/30 text-transparent"}`}
                          title={enabled ? t("skills.disable") : t("skills.enable")}
                        >
                          {enabled && "✓"}
                        </span>
                        <span className="text-amber/50 text-2xs select-none">{"◇"}</span>
                        <span className={`font-mono text-xs truncate ${!enabled ? "line-through opacity-50" : ""}`}>
                          {skill.name}
                        </span>
                        {enabled && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (pendingSkills.includes(skill.name)) {
                                removePendingSkill(skill.name);
                              } else {
                                addPendingSkill(skill.name);
                              }
                            }}
                            className={`ml-auto inline-flex items-center justify-center w-3 h-3 border cursor-pointer shrink-0 transition-colors ${
                              pendingSkills.includes(skill.name)
                                ? "border-amber bg-amber/20 text-amber"
                                : "border-border/50 text-transparent hover:border-amber/50"
                            }`}
                            title={pendingSkills.includes(skill.name) ? t("skills.unqueue") : t("skills.queue")}
                          >
                            {pendingSkills.includes(skill.name) && "●"}
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <div className={`font-sans text-2xs mt-0.5 line-clamp-2 pl-[3.25rem] ${enabled ? "text-muted" : "text-faint/40"}`}>
                          {skill.description}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 pl-[3.25rem]">
                        <span className={`font-mono text-2xs border px-1 rounded-sm ${enabled ? "text-moss/70 border-moss/30" : "text-faint/40 border-border/20"}`}>
                          {t("skills.installedBadge")}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Detail */}
      {selected && (
        <>
        <ResizeDivider direction="horizontal" onResize={(d) => setDetailHeight((h) => Math.max(100, h - d))} />
        <div className="shrink-0 overflow-y-auto" style={{ height: detailHeight }}>
          <div className="px-3 py-2">
            <div className="font-mono text-xs text-ink font-semibold">{selected.name}</div>
            {selected.namespace && (
              <div className="font-mono text-2xs text-faint mt-0.5">
                namespace: {selected.namespace}
              </div>
            )}
            {selected.description && (
              <div className="font-sans text-2xs text-muted mt-1">{selected.description}</div>
            )}
            <div className="font-mono text-2xs text-faint mt-2 break-all">{selected.path}</div>
            {selected.content_preview && (
              <div className="font-mono text-2xs text-faint mt-2 whitespace-pre-wrap line-clamp-6">
                {selected.content_preview}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="font-mono text-2xs text-faint">{t("skills.moveToGroup")}:</span>
              {newGroupInput ? (
                <input
                  autoFocus
                  value={newGroupValue}
                  onChange={(e) => setNewGroupValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupValue.trim()) {
                      setSkillGroup(selected.name, newGroupValue.trim());
                      setNewGroupInput(false);
                      setNewGroupValue("");
                    }
                    if (e.key === "Escape") {
                      setNewGroupInput(false);
                      setNewGroupValue("");
                    }
                  }}
                  onBlur={() => { setNewGroupInput(false); setNewGroupValue(""); }}
                  className="flex-1 bg-transparent border border-amber/50 rounded-sm px-1 py-0 font-mono text-2xs text-ink focus:outline-none"
                  placeholder={t("skills.newGroup")}
                />
              ) : (
                <select
                  value={selectedNs ?? "local"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__new__") {
                      setNewGroupInput(true);
                    } else {
                      setSkillGroup(selected.name, v);
                    }
                  }}
                  className="bg-transparent border border-border/50 rounded-sm px-1 py-0 font-mono text-2xs text-ink focus:outline-none focus:border-amber/50 cursor-pointer"
                >
                  {allGroupKeys.map((gk) => (
                    <option key={gk} value={gk}>
                      {groupConfig.groupNames[gk] ?? gk}
                    </option>
                  ))}
                  <option value="__new__">{t("skills.newGroup")}</option>
                </select>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-2 shrink-0">
        <span className="font-mono text-2xs text-faint">
          ~/.claude/skills/
        </span>
      </div>
    </div>
  );
}
