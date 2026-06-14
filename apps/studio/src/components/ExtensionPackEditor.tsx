import { useMemo } from "react";
import {
  formatExtensionPackOutputs,
  mergeExtensionsPart,
  parseExtensionCustomParameterRows,
  parseExtensionPackRows,
  serializeExtensions,
  type ExtensionCustomParameterRow,
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

function parseExtensionsObject(extensionsJson: string): Parameters<
  typeof parseExtensionPackRows
>[0] {
  try {
    return JSON.parse(extensionsJson) as Parameters<typeof parseExtensionPackRows>[0];
  } catch {
    return { packs: [] };
  }
}

export function ExtensionPackEditor({
  presetJson,
  extensionsJson,
  graphJson,
  simpleMode,
  onChange,
}: ExtensionPackEditorProps) {
  const extensionsObject = useMemo(
    () => parseExtensionsObject(extensionsJson),
    [extensionsJson],
  );

  const packRows = useMemo(
    () => parseExtensionPackRows(extensionsObject),
    [extensionsObject],
  );

  const enabledPackIds = useMemo(
    () => packRows.filter((row) => row.enabled).map((row) => row.id),
    [packRows],
  );

  const customRows = useMemo(
    () => parseExtensionCustomParameterRows(extensionsObject, enabledPackIds),
    [extensionsObject, enabledPackIds],
  );

  const activeCustomRows = useMemo(
    () => customRows.filter((row) => row.active),
    [customRows],
  );

  const duplicateWarning = useMemo(
    () =>
      formatDuplicatePackWarning(
        findDuplicateExtensionPackIdsFromGraphJson(presetJson, graphJson),
      ),
    [graphJson, presetJson],
  );

  const commitExtensions = (
    nextPackRows: ExtensionPackRow[],
    nextCustomRows: ExtensionCustomParameterRow[],
  ) => {
    const nextExtensionsJson = JSON.stringify(
      serializeExtensions(nextPackRows, nextCustomRows),
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

      <div className="plugin-motion-editor">
        {packRows.map((row) => (
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
                  commitExtensions(
                    packRows.map((item) =>
                      item.id === row.id
                        ? { ...item, enabled: event.target.checked }
                        : item,
                    ),
                    customRows,
                  );
                }}
              />
            </label>

            {row.enabled ? (
              <div className="plugin-parameter-grid">
                <p className="hint plugin-motion-output">
                  動かす部分: {formatExtensionPackOutputs(row) || "（標準 MotionState）"}
                </p>
                {row.configFields.length === 0 ? (
                  <p className="hint">（この Pack に調整スライダーはありません）</p>
                ) : (
                  row.configFields.map((field) => (
                    <label key={field.key} className="row row-slider plugin-param-row">
                      <span>{field.label}</span>
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={row.config[field.key] ?? field.default}
                        onChange={(event) => {
                          commitExtensions(
                            packRows.map((item) =>
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
                            customRows,
                          );
                        }}
                      />
                      <span className="value">
                        {(row.config[field.key] ?? field.default).toFixed(2)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {activeCustomRows.length > 0 ? (
        <section className="extension-custom-params">
          <h4>{simpleMode ? "拡張パラメータ（custom）" : "Extension custom parameters"}</h4>
          <p className="hint">
            {simpleMode
              ? "Pack 無効時に手動で custom 値を設定できます。Pack 有効時は Pack の intensity 等で調整してください。"
              : "Pack 無効時のみ手動値が使われます。Pack 有効時は Pack 出力が優先されます（intensity 等で調整）。"}
          </p>
          <div className="plugin-motion-editor">
            {activeCustomRows.map((row) => (
              <article key={row.id} className="plugin-motion-card">
                <label className="row row-slider plugin-param-row">
                  <span>
                    {row.label}
                    <span className="hint">custom.{row.id}</span>
                  </span>
                  <input
                    type="range"
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    value={row.value}
                    onChange={(event) => {
                      commitExtensions(
                        packRows,
                        customRows.map((item) =>
                          item.id === row.id
                            ? { ...item, value: Number(event.target.value) }
                            : item,
                        ),
                      );
                    }}
                  />
                  <span className="value">{row.value.toFixed(2)}</span>
                </label>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
