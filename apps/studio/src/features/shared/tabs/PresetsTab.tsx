import { SimplePresetPicker } from "../../../components/SimplePresetPicker";
import { PRESET_OPTIONS } from "../../../hooks/usePresetState";
import type { PresetName } from "../../../runtime";

export interface PresetsTabProps {
  isSimpleMode: boolean;
  preset: PresetName;
  customPreset: boolean;
  applyingPreset: boolean;
  presetJson: string;
  behaviorJson: string;
  graphJson: string;
  behaviorPluginsJson: string;
  onLoadBuiltinPreset: (presetName: PresetName) => void;
  onDownloadPreset: () => void;
  onImportPresetFile: (file: File | undefined) => void;
  onSelectBuiltinDraft: (presetName: PresetName) => void;
  onApplyPresetJson: () => void;
  onUpdateBehaviorPluginsJson: (value: string) => void;
  onUpdateBehaviorJson: (value: string) => void;
  onUpdateGraphJson: (value: string) => void;
  onUpdatePresetJson: (value: string) => void;
}

export function PresetsTab({
  isSimpleMode,
  preset,
  customPreset,
  applyingPreset,
  presetJson,
  behaviorJson,
  graphJson,
  behaviorPluginsJson,
  onLoadBuiltinPreset,
  onDownloadPreset,
  onImportPresetFile,
  onSelectBuiltinDraft,
  onApplyPresetJson,
  onUpdateBehaviorPluginsJson,
  onUpdateBehaviorJson,
  onUpdateGraphJson,
  onUpdatePresetJson,
}: PresetsTabProps) {
  return (
    <section className="preset-manager">
      {isSimpleMode ? (
        <SimplePresetPicker
          activePreset={preset}
          isCustomPreset={customPreset}
          applying={applyingPreset}
          onSelect={(presetName) => {
            onLoadBuiltinPreset(presetName);
          }}
          onDownload={onDownloadPreset}
          onImportFile={(file) => {
            onImportPresetFile(file);
          }}
        />
      ) : (
        <>
          <label className="row">
            <span>Built-in Preset</span>
            <select
              value={preset}
              onChange={(e) => {
                onSelectBuiltinDraft(e.target.value as PresetName);
              }}
            >
              {PRESET_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="preset-actions">
            <button
              type="button"
              disabled={applyingPreset}
              onClick={() => {
                onLoadBuiltinPreset(preset);
              }}
            >
              組み込み Preset を適用
            </button>
            <button type="button" onClick={onDownloadPreset}>
              .pfpreset をダウンロード
            </button>
            <label className="file-button">
              ファイルからインポート
              <input
                type="file"
                accept=".json,.pfpreset,application/json"
                hidden
                onChange={(event) => {
                  onImportPresetFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </>
      )}

      {!isSimpleMode ? (
        <>
          <div className="preset-split">
            <label className="preset-editor-label">
              <span>behaviorPlugins（決められた動き）</span>
              <textarea
                className="preset-editor preset-editor-half"
                value={behaviorPluginsJson}
                onChange={(event) => {
                  onUpdateBehaviorPluginsJson(event.target.value);
                }}
                spellCheck={false}
              />
            </label>
            <label className="preset-editor-label">
              <span>behavior（If / Assign）</span>
              <textarea
                className="preset-editor preset-editor-half"
                value={behaviorJson}
                onChange={(event) => {
                  onUpdateBehaviorJson(event.target.value);
                }}
                spellCheck={false}
              />
            </label>
            <label className="preset-editor-label">
              <span>graph（数値ノードのみ）</span>
              <textarea
                className="preset-editor preset-editor-half"
                value={graphJson}
                onChange={(event) => {
                  onUpdateGraphJson(event.target.value);
                }}
                spellCheck={false}
              />
            </label>
          </div>

          <details className="preset-full-json">
            <summary>フル Preset JSON</summary>
            <textarea
              className="preset-editor"
              value={presetJson}
              onChange={(event) => {
                onUpdatePresetJson(event.target.value);
              }}
              spellCheck={false}
            />
          </details>

          <button
            type="button"
            className={customPreset ? "primary" : undefined}
            disabled={applyingPreset}
            onClick={() => {
              onApplyPresetJson();
            }}
          >
            編集した Preset を適用
          </button>
          {customPreset ? (
            <p className="hint">カスタム Preset がランタイムに適用されています。</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
