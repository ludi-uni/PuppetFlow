interface ActivePluginsPanelProps {
  pluginIds: string[];
}

export function ActivePluginsPanel({ pluginIds }: ActivePluginsPanelProps) {
  return (
    <aside className="active-plugins-panel">
      <h3>有効なプラグイン</h3>
      <p className="hint">
        {pluginIds.length > 0
          ? pluginIds.join(", ")
          : "(なし) — Plugins タブ、または Preset の behaviorPlugins で追加できます"}
      </p>
    </aside>
  );
}
