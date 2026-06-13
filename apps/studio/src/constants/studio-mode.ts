export type StudioMode = "simple" | "expert";

export type TabId =
  | "pipeline"
  | "scratch"
  | "mapping"
  | "graph"
  | "presets"
  | "plugins"
  | "sources"
  | "mapper";

const STORAGE_KEY = "puppetflow.studio.mode";

export function loadStudioMode(): StudioMode {
  if (typeof localStorage === "undefined") {
    return "simple";
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "expert" ? "expert" : "simple";
}

export function saveStudioMode(mode: StudioMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getTabsForMode(
  mode: StudioMode,
): Array<{ id: TabId; label: string; description?: string }> {
  if (mode === "expert") {
    return [
      { id: "pipeline", label: "Pipeline" },
      { id: "scratch", label: "Scratch (Blockly)" },
      { id: "graph", label: "Graph Editor" },
      { id: "presets", label: "Preset Manager" },
      { id: "plugins", label: "Plugins" },
      { id: "sources", label: "Input Sources" },
      { id: "mapper", label: "Motion Mapper" },
    ];
  }

  return [
    { id: "pipeline", label: "動作確認", description: "スライダーで試す" },
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
