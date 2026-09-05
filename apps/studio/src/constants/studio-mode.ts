import {
  loadPersistedStudioMode,
  loadPersistedTab,
  loadPersistedBlocklyEnabled,
  savePersistedBlocklyEnabled,
  savePersistedStudioMode,
  savePersistedTab,
} from "../utils/studio-config-storage";

export type StudioMode = "simple" | "expert";

export type TabId =
  | "pipeline"
  | "micro-behaviors"
  | "scratch"
  | "pfscript"
  | "mapping"
  | "graph"
  | "presets"
  | "plugins"
  | "sources"
  | "mapper"
  | "acting";

export function loadStudioMode(): StudioMode {
  return loadPersistedStudioMode();
}

export function saveStudioMode(mode: StudioMode): void {
  savePersistedStudioMode(mode);
}

export function loadStudioTab(mode: StudioMode): TabId | undefined {
  return loadPersistedTab(mode);
}

export function saveStudioTab(mode: StudioMode, tab: TabId): void {
  savePersistedTab(mode, tab);
}

export function loadBlocklyEnabled(): boolean {
  return loadPersistedBlocklyEnabled();
}

export function saveBlocklyEnabled(enabled: boolean): void {
  savePersistedBlocklyEnabled(enabled);
}

export function getTabsForMode(
  mode: StudioMode,
  blocklyEnabled = false,
): Array<{ id: TabId; label: string; description?: string }> {
  if (mode === "expert") {
    return [
      { id: "pipeline", label: "Pipeline" },
      { id: "micro-behaviors", label: "Micro Behaviors" },
      { id: "pfscript", label: "PFScript" },
      { id: "graph", label: "Graph Editor" },
      { id: "presets", label: "Preset Manager" },
      { id: "plugins", label: "Plugins" },
      { id: "sources", label: "Input Sources" },
      { id: "mapper", label: "Motion Mapper" },
      { id: "acting", label: "Acting" },
      ...(blocklyEnabled ? [{ id: "scratch" as const, label: "Blockly Editor" }] : []),
    ];
  }

  return [
    { id: "presets", label: "キャラの雰囲気", description: "プリセットを選ぶ" },
    { id: "acting", label: "演技・表情", description: "演技と表情を試す" },
    { id: "mapper", label: "キャラへの送信", description: "Viewer 接続" },
    { id: "pipeline", label: "動作確認", description: "スライダーで試す" },
    { id: "micro-behaviors", label: "仕草づくり", description: "カスタム動き" },
    { id: "mapping", label: "動きのつなぎ", description: "きっかけと動き" },
    { id: "plugins", label: "オプション動き", description: "まばたき・視線など" },
  ];
}

export function getDefaultTab(mode: StudioMode): TabId {
  return mode === "simple" ? "presets" : "pipeline";
}

export function normalizeTabForMode(
  tab: TabId,
  mode: StudioMode,
  blocklyEnabled = false,
): TabId {
  const visible = new Set(getTabsForMode(mode, blocklyEnabled).map((item) => item.id));
  if (visible.has(tab)) {
    return tab;
  }

  if (tab === "graph" && mode === "simple") {
    return "mapping";
  }

  return getDefaultTab(mode);
}
