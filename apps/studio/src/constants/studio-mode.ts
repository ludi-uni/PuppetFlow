import {
  loadPersistedStudioMode,
  loadPersistedTab,
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
  | "mapper";

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

export function getTabsForMode(
  mode: StudioMode,
): Array<{ id: TabId; label: string; description?: string }> {
  if (mode === "expert") {
    return [
      { id: "pipeline", label: "Pipeline" },
      { id: "micro-behaviors", label: "Micro Behaviors" },
      { id: "scratch", label: "Scratch (Blockly)" },
      { id: "pfscript", label: "PFScript" },
      { id: "graph", label: "Graph Editor" },
      { id: "presets", label: "Preset Manager" },
      { id: "plugins", label: "Plugins" },
      { id: "sources", label: "Input Sources" },
      { id: "mapper", label: "Motion Mapper" },
    ];
  }

  return [
    { id: "pipeline", label: "動作確認", description: "スライダーで試す" },
    { id: "micro-behaviors", label: "仕草づくり", description: "カスタム動き" },
    { id: "presets", label: "キャラの雰囲気", description: "プリセットを選ぶ" },
    { id: "mapping", label: "動きのつなぎ", description: "きっかけと動き" },
    { id: "plugins", label: "オプション動き", description: "まばたき・視線など" },
    { id: "scratch", label: "条件づくり", description: "ブロックで条件" },
    { id: "mapper", label: "キャラへの送信", description: "Viewer 接続" },
  ];
}

export function getDefaultTab(_mode: StudioMode): TabId {
  return "pipeline";
}

export function normalizeTabForMode(tab: TabId, mode: StudioMode): TabId {
  const visible = new Set(getTabsForMode(mode).map((item) => item.id));
  if (visible.has(tab)) {
    return tab;
  }

  if (tab === "graph" && mode === "simple") {
    return "mapping";
  }

  if (tab === "sources" && mode === "simple") {
    return "pipeline";
  }

  return getDefaultTab(mode);
}
