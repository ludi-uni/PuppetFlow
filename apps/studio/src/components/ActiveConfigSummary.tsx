import type { MotionMapperEditorConfig } from "../mapper-config";
import type { PresetName, SourceConfig } from "../runtime";

interface ActiveConfigSummaryProps {
  preset: PresetName;
  isCustomPreset: boolean;
  sources: SourceConfig;
  behaviorPluginIds: string[];
  pluginIds: string[];
  mapperConfig: MotionMapperEditorConfig;
  httpHealth: "unknown" | "ok" | "error" | "idle";
  onExportCliConfig?: () => void;
}

function sourceLabel(
  active: boolean,
  health?: "unknown" | "ok" | "error" | "idle",
): string {
  if (!active) {
    return "—";
  }

  if (health === "ok") {
    return "有効 ✓";
  }

  if (health === "error") {
    return "エラー";
  }

  if (health === "unknown") {
    return "確認中…";
  }

  return "有効";
}

export function ActiveConfigSummary({
  preset,
  isCustomPreset,
  sources,
  behaviorPluginIds,
  pluginIds,
  mapperConfig,
  httpHealth,
  onExportCliConfig,
}: ActiveConfigSummaryProps) {
  const enabledOscTargets = (["vmc", "live2d", "vrm"] as const).filter(
    (target) => mapperConfig[target].enabled,
  );

  return (
    <section className="config-summary" aria-label="適用済み設定">
      <div className="config-summary-header">
        <h2>適用済み設定</h2>
        {onExportCliConfig ? (
          <button
            type="button"
            className="config-export-button"
            onClick={onExportCliConfig}
            title="CLI 用 puppetflow.yaml をダウンロード"
          >
            CLI 設定をエクスポート
          </button>
        ) : null}
      </div>
      <dl className="summary-grid">
        <div>
          <dt>Preset</dt>
          <dd>
            {preset}
            {isCustomPreset ? " (custom)" : ""}
          </dd>
        </div>
        <div>
          <dt>behaviorPlugins</dt>
          <dd>{behaviorPluginIds.length > 0 ? behaviorPluginIds.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt>Plugins</dt>
          <dd>{pluginIds.length > 0 ? pluginIds.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt>HTTP Source</dt>
          <dd>
            {sources.httpUrl
              ? `${sourceLabel(true, httpHealth)} — ${sources.httpUrl}`
              : sourceLabel(false)}
          </dd>
        </div>
        <div>
          <dt>WebSocket Source</dt>
          <dd>{sources.wsUrl ? `有効 — ${sources.wsUrl}` : "—"}</dd>
        </div>
        <div>
          <dt>MQTT Source</dt>
          <dd>
            {sources.mqttBroker && sources.mqttTopic
              ? `有効 — ${sources.mqttBroker} / ${sources.mqttTopic}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>OSC 送信</dt>
          <dd>
            {enabledOscTargets.length > 0
              ? enabledOscTargets
                  .map((target) => {
                    const model = mapperConfig[target];
                    return `${target} → ${model.host}:${model.port}`;
                  })
                  .join(", ")
              : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
