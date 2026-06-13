import { PRESET_CATALOG } from "../constants/preset-catalog";
import type { PresetName } from "../runtime";

interface SimplePresetPickerProps {
  activePreset: PresetName;
  isCustomPreset: boolean;
  applying: boolean;
  onSelect: (preset: PresetName) => void;
  onDownload: () => void;
  onImportFile: (file: File | undefined) => void;
}

export function SimplePresetPicker({
  activePreset,
  isCustomPreset,
  applying,
  onSelect,
  onDownload,
  onImportFile,
}: SimplePresetPickerProps) {
  return (
    <section className="simple-preset-picker">
      <h2>キャラの雰囲気を選ぶ</h2>
      <p className="hint">
        プリセットはキャラの基本の動き方です。選んで「この雰囲気を使う」を押すと反映されます。
      </p>

      <div className="preset-card-grid">
        {PRESET_CATALOG.map((entry) => {
          const isActive = !isCustomPreset && activePreset === entry.id;
          return (
            <article
              key={entry.id}
              className={isActive ? "preset-card active" : "preset-card"}
            >
              <h3>{entry.title}</h3>
              <p className="preset-card-mood">{entry.mood}</p>
              <p className="preset-card-desc">{entry.description}</p>
              <button
                type="button"
                className={isActive ? "primary" : undefined}
                disabled={applying}
                onClick={() => onSelect(entry.id)}
              >
                {isActive ? "使用中" : "この雰囲気を使う"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="preset-actions simple-preset-actions">
        <button type="button" onClick={onDownload}>
          設定をファイルに保存
        </button>
        <label className="file-button">
          ファイルから読み込む
          <input
            type="file"
            accept=".json,.pfpreset,application/json"
            hidden
            onChange={(event) => {
              onImportFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {isCustomPreset ? (
        <p className="hint">
          カスタム設定が適用されています。組み込みプリセットを選ぶと上書きされます。
        </p>
      ) : null}
    </section>
  );
}
