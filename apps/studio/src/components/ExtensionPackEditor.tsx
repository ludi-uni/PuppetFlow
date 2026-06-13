import { useMemo } from "react";
import {
  mergeExtensionsPart,
  parseExtensionPackRows,
  serializeExtensionPacks,
  type ExtensionPackRow,
} from "../utils/extension-config";
import {
  findDuplicateExtensionPackIdsFromGraphJson,
  formatDuplicatePackWarning,
} from "../utils/extension-duplicates";

interface ExtensionPackEditorProps {
  presetJson: string;
  extensionsJson: string;
  graphJson: string;
  simpleMode: boolean;
  onChange: (extensionsJson: string, presetJson: string) => void;
}

export function ExtensionPackEditor({
  presetJson,
  extensionsJson,
  graphJson,
  simpleMode,
  onChange,
}: ExtensionPackEditorProps) {
  const rows = useMemo(() => {
    try {
      return parseExtensionPackRows(
        JSON.parse(extensionsJson) as Parameters<typeof parseExtensionPackRows>[0],
      );
    } catch {
      return parseExtensionPackRows({ packs: [] });
    }
  }, [extensionsJson]);

  const duplicateWarning = useMemo(
    () =>
      formatDuplicatePackWarning(
        findDuplicateExtensionPackIdsFromGraphJson(presetJson, graphJson),
      ),
    [graphJson, presetJson],
  );

  const commitRows = (nextRows: ExtensionPackRow[]) => {
    const nextExtensionsJson = JSON.stringify(
      serializeExtensionPacks(nextRows),
      null,
      2,
    );
    onChange(nextExtensionsJson, mergeExtensionsPart(presetJson, nextExtensionsJson));
  };

  return (
    <section className="extension-pack-editor">
      <h3>{simpleMode ? "動きパック（拡張）" : "Motion Pack Extensions"}</h3>
      <p className="hint">
        {simpleMode
          ? "考え込む・視線探索・尻尾など、決まった動きを追加できます。Graph に同じ Pack を置いている場合はどちらか一方にしてください。"
          : "Extension Layer の Motion Pack。behavior / graph / PFScript と同じ registry を参照します。"}
      </p>

      {duplicateWarning ? (
        <p className="hint emotion-plugin-hint">⚠ {duplicateWarning}</p>
      ) : null}

      {rows.map((row) => (
        <article key={row.id} className="plugin-motion-card">
          <label className="row plugin-toggle-row">
            <span>
              {row.label}
              <span className="hint plugin-toggle-desc">{row.description}</span>
            </span>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) => {
                commitRows(
                  rows.map((item) =>
                    item.id === row.id
                      ? { ...item, enabled: event.target.checked }
                      : item,
                  ),
                );
              }}
            />
          </label>

          {row.enabled ? (
            <div className="plugin-parameter-grid">
              {row.configFields.map((field) => (
                <label key={field.key} className="row row-slider plugin-param-row">
                  <span>{field.label}</span>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={row.config[field.key] ?? field.default}
                    onChange={(event) => {
                      commitRows(
                        rows.map((item) =>
                          item.id === row.id
                            ? {
                                ...item,
                                config: {
                                  ...item.config,
                                  [field.key]: Number(event.target.value),
                                },
                              }
                            : item,
                        ),
                      );
                    }}
                  />
                  <span className="value">
                    {(row.config[field.key] ?? field.default).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
