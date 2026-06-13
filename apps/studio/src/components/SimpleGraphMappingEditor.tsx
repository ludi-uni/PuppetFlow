import { useMemo, useState } from "react";
import { hasLipsyncGraph, LIPSYNC_GRAPH_TEMPLATE } from "../constants/lipsync-template";
import {
  applySimpleMappingsToGraph,
  createDefaultMappingRow,
  parseSimpleMappingsFromGraph,
  SIMPLE_INPUT_OPTIONS,
  SIMPLE_OUTPUT_OPTIONS,
  type SimpleMappingRow,
} from "../constants/simple-mapping";
import { mergeGraphPart } from "../utils/preset-parts";

interface SimpleGraphMappingEditorProps {
  presetJson: string;
  graphJson: string;
  applying: boolean;
  onGraphChange: (graphJson: string, presetJson: string) => void;
  onApply: () => void;
}

export function SimpleGraphMappingEditor({
  presetJson,
  graphJson,
  applying,
  onGraphChange,
  onApply,
}: SimpleGraphMappingEditorProps) {
  const rows = useMemo(() => parseSimpleMappingsFromGraph(graphJson), [graphJson]);
  const lipsyncEnabled = useMemo(() => {
    try {
      return hasLipsyncGraph(
        JSON.parse(graphJson) as { nodes?: Array<{ type?: string }> },
      );
    } catch {
      return false;
    }
  }, [graphJson]);

  const [draftRows, setDraftRows] = useState<SimpleMappingRow[] | null>(null);
  const displayRows = draftRows ?? rows;

  const commitRows = (nextRows: SimpleMappingRow[]) => {
    setDraftRows(nextRows);
    const nextGraphJson = applySimpleMappingsToGraph(graphJson, nextRows);
    onGraphChange(nextGraphJson, mergeGraphPart(presetJson, nextGraphJson));
  };

  const setLipsync = (enabled: boolean) => {
    const templateIds = new Set(LIPSYNC_GRAPH_TEMPLATE.nodes.map((node) => node.id));
    let baseGraph = { nodes: [] as unknown[], edges: [] as unknown[] };

    try {
      baseGraph = JSON.parse(graphJson) as { nodes: unknown[]; edges: unknown[] };
    } catch {
      baseGraph = { nodes: [], edges: [] };
    }

    const withoutLipsync = {
      nodes: (baseGraph.nodes as Array<{ id: string }>).filter(
        (node) => !templateIds.has(node.id),
      ),
      edges: (baseGraph.edges as Array<{ source: string; target: string }>).filter(
        (edge) => !templateIds.has(edge.source) && !templateIds.has(edge.target),
      ),
    };

    const nextGraph = enabled
      ? {
          nodes: [...withoutLipsync.nodes, ...LIPSYNC_GRAPH_TEMPLATE.nodes],
          edges: [...withoutLipsync.edges, ...LIPSYNC_GRAPH_TEMPLATE.edges],
        }
      : withoutLipsync;

    const nextGraphJson = JSON.stringify(nextGraph, null, 2);
    onGraphChange(nextGraphJson, mergeGraphPart(presetJson, nextGraphJson));
  };

  return (
    <section className="simple-mapping-editor">
      <h2>動きのつなぎ</h2>
      <p className="hint">
        「きっかけ」と「動かす部分」を表で設定します。たとえば「興味が高いほど笑顔を強く」など。
      </p>

      <div className="mapping-table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>きっかけ</th>
              <th>動かす部分</th>
              <th>強さ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="hint">
                  まだつなぎがありません。「行を追加」から始めてください。
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <select
                      value={row.input}
                      onChange={(event) => {
                        commitRows(
                          displayRows.map((item) =>
                            item.id === row.id
                              ? { ...item, input: event.target.value }
                              : item,
                          ),
                        );
                      }}
                    >
                      {SIMPLE_INPUT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.output}
                      onChange={(event) => {
                        commitRows(
                          displayRows.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  output: event.target
                                    .value as SimpleMappingRow["output"],
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      {SIMPLE_OUTPUT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={row.gain}
                      onChange={(event) => {
                        commitRows(
                          displayRows.map((item) =>
                            item.id === row.id
                              ? { ...item, gain: Number(event.target.value) }
                              : item,
                          ),
                        );
                      }}
                    />
                    <span className="mapping-gain">{row.gain.toFixed(2)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        commitRows(displayRows.filter((item) => item.id !== row.id));
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mapping-actions">
        <button
          type="button"
          onClick={() => {
            commitRows([...displayRows, createDefaultMappingRow()]);
          }}
        >
          行を追加
        </button>
      </div>

      <section className="mapping-lipsync">
        <h3>リップシンク（声で口を動かす）</h3>
        <p className="hint">
          有効にすると、声の大きさ（Volume）と口の形（Phoneme）で口が動きます。動作確認タブの
          Volume スライダーで試せます。
        </p>
        <label className="row lipsync-toggle">
          <span>リップシンクを使う</span>
          <input
            type="checkbox"
            checked={lipsyncEnabled}
            onChange={(event) => setLipsync(event.target.checked)}
          />
        </label>
      </section>

      <button type="button" className="primary" disabled={applying} onClick={onApply}>
        動きのつなぎを反映
      </button>
    </section>
  );
}
