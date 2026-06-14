import { useState } from "react";
import {
  applyViewerPreset,
  VIEWER_PRESETS,
  type ViewerPreset,
} from "../constants/viewer-presets";
import { cloneMapperConfig, type MotionMapperEditorConfig } from "../mapper-config";

interface SimpleOscMapperEditorProps {
  initialConfig: MotionMapperEditorConfig;
  extensionCustomParamIds?: string[];
  onApply: (config: MotionMapperEditorConfig) => Promise<void>;
  onOpenExpert: () => void;
}

function detectViewerPreset(config: MotionMapperEditorConfig): string {
  const enabled = (["vmc", "live2d", "vrm"] as const).find(
    (target) => config[target].enabled,
  );
  if (!enabled) {
    return "custom";
  }

  const model = config[enabled];
  const match = VIEWER_PRESETS.find(
    (preset) =>
      preset.primaryTarget === enabled &&
      preset.host === model.host &&
      preset.port === model.port,
  );
  return match?.id ?? "custom";
}

export function SimpleOscMapperEditor({
  initialConfig,
  extensionCustomParamIds = [],
  onApply,
  onOpenExpert,
}: SimpleOscMapperEditorProps) {
  const [config, setConfig] = useState<MotionMapperEditorConfig>(
    cloneMapperConfig(initialConfig),
  );
  const [selectedId, setSelectedId] = useState(() => detectViewerPreset(initialConfig));
  const [applying, setApplying] = useState(false);

  const selectedPreset =
    VIEWER_PRESETS.find((preset) => preset.id === selectedId) ?? VIEWER_PRESETS[0]!;

  const applyPresetSelection = (preset: ViewerPreset) => {
    setSelectedId(preset.id);
    setConfig((current) => applyViewerPreset(current, preset));
  };

  return (
    <section className="simple-mapper-editor">
      <h2>キャラへの送信</h2>
      <p className="hint">
        キャラを表示しているアプリを選びます。PuppetFlow
        は動きデータをそのアプリへ送ります（キャラの描画は外部 Viewer で行います）。
      </p>

      <div className="viewer-preset-grid">
        {VIEWER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={selectedId === preset.id ? "viewer-card active" : "viewer-card"}
            onClick={() => applyPresetSelection(preset)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>

      <div className="viewer-summary">
        <p>
          送信先: <strong>{selectedPreset.label}</strong>（{selectedPreset.host}:
          {selectedPreset.port}）
        </p>
        <p className="hint">
          まず外部 Viewer を起動し、VMC / OSC 受信を有効にしてください。
        </p>
        {extensionCustomParamIds.length > 0 ? (
          <p className="hint emotion-plugin-hint">
            尻尾・耳などの拡張パラメータ（{extensionCustomParamIds.join(", ")}
            ）の OSC 送信名は「詳細設定（エキスパート）」の Motion Mapper で設定してください。
          </p>
        ) : null}
      </div>

      <div className="mapper-actions">
        <button
          type="button"
          className="primary"
          disabled={applying}
          onClick={() => {
            setApplying(true);
            void onApply(config).finally(() => setApplying(false));
          }}
        >
          送信設定を反映
        </button>
        <button type="button" className="ghost-btn" onClick={onOpenExpert}>
          詳細設定（エキスパート）
        </button>
      </div>
    </section>
  );
}
