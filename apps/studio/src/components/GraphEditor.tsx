import {
  addEdge,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivePluginsPanel } from "./ActivePluginsPanel";
import { mergeGraphIntoPreset } from "../graph-to-preset";
import {
  getChannelKeyOptions,
  getMotionKeyOptions,
  getStateKeyOptions,
  presetJsonToGraph,
} from "../preset-json-to-graph";

const INITIAL_NODES: Node[] = [
  {
    id: "interest",
    type: "input",
    position: { x: 0, y: 80 },
    data: { label: "Interest", key: "interest" },
  },
  {
    id: "multiply",
    type: "multiply",
    position: { x: 220, y: 80 },
    data: { label: "Multiply", gain: 0.5 },
  },
  {
    id: "mouthX",
    type: "output",
    position: { x: 460, y: 80 },
    data: { label: "mouthX", key: "mouthX" },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1", source: "interest", target: "multiply" },
  { id: "e2", source: "multiply", target: "mouthX" },
];

const STATE_KEY_OPTIONS = getStateKeyOptions();
const CHANNEL_KEY_OPTIONS = getChannelKeyOptions();
const MOTION_KEY_OPTIONS = getMotionKeyOptions();

function InputNode({
  id,
  data,
  onKeyChange,
}: {
  id: string;
  data: { label: string; key: string };
  onKeyChange: (nodeId: string, key: string) => void;
}) {
  return (
    <div className="node">
      <strong>State Input</strong>
      <select
        className="node-select"
        value={data.key}
        onChange={(event) => onKeyChange(id, event.target.value)}
      >
        {STATE_KEY_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function MultiplyNode({
  id,
  data,
  onGainChange,
}: {
  id: string;
  data: { label: string; gain: number };
  onGainChange: (nodeId: string, gain: number) => void;
}) {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <strong>Multiply</strong>
      <label className="node-field">
        <span>gain</span>
        <input
          className="node-input"
          type="number"
          min={0}
          max={2}
          step={0.05}
          value={data.gain}
          onChange={(event) => onGainChange(id, Number(event.target.value) || 0)}
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function ChannelInputNode({
  id,
  data,
  onKeyChange,
}: {
  id: string;
  data: { label: string; key: string };
  onKeyChange: (nodeId: string, key: string) => void;
}) {
  return (
    <div className="node">
      <strong>Channel Input</strong>
      <select
        className="node-select"
        value={data.key}
        onChange={(event) => onKeyChange(id, event.target.value)}
      >
        {CHANNEL_KEY_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function VolumeToMouthNode({
  id,
  data,
  onGainChange,
}: {
  id: string;
  data: { label: string; gain: number };
  onGainChange: (nodeId: string, gain: number) => void;
}) {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <strong>Volume → Mouth</strong>
      <label className="node-field">
        <span>gain</span>
        <input
          className="node-input"
          type="number"
          min={0}
          max={2}
          step={0.05}
          value={data.gain}
          onChange={(event) => onGainChange(id, Number(event.target.value) || 0)}
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function PhonemeToShapeNode({
  id,
  data,
  onAxisChange,
  onSourceChange,
}: {
  id: string;
  data: { label: string; axis: string; source: string };
  onAxisChange: (nodeId: string, axis: string) => void;
  onSourceChange: (nodeId: string, source: string) => void;
}) {
  return (
    <div className="node">
      <strong>Phoneme → Shape</strong>
      <label className="node-field">
        <span>axis</span>
        <select
          className="node-select"
          value={data.axis}
          onChange={(event) => onAxisChange(id, event.target.value)}
        >
          <option value="mouthX">mouthX</option>
          <option value="mouthY">mouthY</option>
        </select>
      </label>
      <label className="node-field">
        <span>from</span>
        <select
          className="node-select"
          value={data.source}
          onChange={(event) => onSourceChange(id, event.target.value)}
        >
          <option value="auto">auto</option>
          <option value="timeline">timeline</option>
          <option value="channel">channel</option>
        </select>
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function OutputNode({
  id,
  data,
  onKeyChange,
}: {
  id: string;
  data: { label: string; key: string };
  onKeyChange: (nodeId: string, key: string) => void;
}) {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <strong>Motion Output</strong>
      <select
        className="node-select"
        value={data.key}
        onChange={(event) => onKeyChange(id, event.target.value)}
      >
        {MOTION_KEY_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
    </div>
  );
}

function suppressNativeContextMenu(event: Event): void {
  event.preventDefault();
}

interface GraphEditorProps {
  exportJson: string;
  presetJson: string;
  presetGraphKey: number;
  activePluginIds: string[];
  onExport: (json: string) => void;
  onLoadExportedPreset: () => void;
  onStatus: (message: string, kind: "success" | "error" | "info") => void;
}

const LIPSYNC_TEMPLATE_NODES: Node[] = [
  {
    id: "ls-vol",
    type: "channelInput",
    position: { x: 0, y: 40 },
    data: { label: "volume", key: "volume" },
  },
  {
    id: "ls-vtm",
    type: "volumeToMouth",
    position: { x: 220, y: 40 },
    data: { label: "VolumeToMouth", gain: 1 },
  },
  {
    id: "ls-mouthY",
    type: "output",
    position: { x: 460, y: 40 },
    data: { label: "mouthY", key: "mouthY" },
  },
  {
    id: "ls-ph-x",
    type: "phonemeToShape",
    position: { x: 0, y: 160 },
    data: { label: "mouthX", axis: "mouthX", source: "auto" },
  },
  {
    id: "ls-out-x",
    type: "output",
    position: { x: 260, y: 160 },
    data: { label: "mouthX", key: "mouthX" },
  },
];

const LIPSYNC_TEMPLATE_EDGES: Edge[] = [
  { id: "ls-e1", source: "ls-vol", target: "ls-vtm" },
  { id: "ls-e2", source: "ls-vtm", target: "ls-mouthY" },
  { id: "ls-e3", source: "ls-ph-x", target: "ls-out-x" },
];

let nextNodeId = 1;

function createNodeId(prefix: string): string {
  nextNodeId += 1;
  return `${prefix}-${nextNodeId}`;
}

export function GraphEditor({
  exportJson,
  presetJson,
  presetGraphKey,
  activePluginIds,
  onExport,
  onLoadExportedPreset,
  onStatus,
}: GraphEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    },
    [setNodes],
  );

  const nodeTypes = useMemo(
    () => ({
      input: (props: { id: string; data: { label: string; key: string } }) => (
        <InputNode
          {...props}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
      multiply: (props: { id: string; data: { label: string; gain: number } }) => (
        <MultiplyNode
          {...props}
          onGainChange={(nodeId, gain) => {
            updateNodeData(nodeId, { gain });
          }}
        />
      ),
      channelInput: (props: { id: string; data: { label: string; key: string } }) => (
        <ChannelInputNode
          {...props}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
      volumeToMouth: (props: { id: string; data: { label: string; gain: number } }) => (
        <VolumeToMouthNode
          {...props}
          onGainChange={(nodeId, gain) => {
            updateNodeData(nodeId, { gain });
          }}
        />
      ),
      phonemeToShape: (props: {
        id: string;
        data: { label: string; axis: string; source: string };
      }) => (
        <PhonemeToShapeNode
          {...props}
          onAxisChange={(nodeId, axis) => {
            updateNodeData(nodeId, { axis, label: axis });
          }}
          onSourceChange={(nodeId, source) => {
            updateNodeData(nodeId, { source });
          }}
        />
      ),
      output: (props: { id: string; data: { label: string; key: string } }) => (
        <OutputNode
          {...props}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
    }),
    [updateNodeData],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener("contextmenu", suppressNativeContextMenu, {
      capture: true,
    });
    return () => {
      canvas.removeEventListener("contextmenu", suppressNativeContextMenu, {
        capture: true,
      });
    };
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge(connection, current));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (
      type:
        | "input"
        | "channelInput"
        | "volumeToMouth"
        | "phonemeToShape"
        | "multiply"
        | "output",
    ) => {
      const y = nodes.length * 80 + 40;
      const id = createNodeId(type);

      if (type === "input") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 0, y },
            data: { label: "interest", key: "interest" },
          },
        ]);
        return;
      }

      if (type === "channelInput") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 0, y },
            data: { label: "volume", key: "volume" },
          },
        ]);
        return;
      }

      if (type === "volumeToMouth") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "VolumeToMouth", gain: 1 },
          },
        ]);
        return;
      }

      if (type === "phonemeToShape") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "mouthY", axis: "mouthY", source: "auto" },
          },
        ]);
        return;
      }

      if (type === "multiply") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Multiply", gain: 0.5 },
          },
        ]);
        return;
      }

      setNodes((current) => [
        ...current,
        {
          id,
          type,
          position: { x: 460, y },
          data: { label: "mouthX", key: "mouthX" },
        },
      ]);
    },
    [nodes.length, setNodes],
  );

  const removeSelectedNodes = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );
    if (selectedIds.size === 0) {
      onStatus("削除するノードを選択してください。", "info");
      return;
    }

    setNodes((current) => current.filter((node) => !selectedIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target),
      ),
    );
    onStatus(`${selectedIds.size} 個のノードを削除しました。`, "success");
  }, [nodes, onStatus, setEdges, setNodes]);

  const loadFromPreset = useCallback(() => {
    const graph = presetJsonToGraph(presetJson);
    if (graph.nodes.length === 0) {
      onStatus("プリセットから読み込める graph / rules がありません。", "error");
      return;
    }

    setNodes(graph.nodes);
    setEdges(graph.edges);
    onStatus("現在のプリセットからグラフを読み込みました。", "success");
  }, [onStatus, presetJson, setEdges, setNodes]);

  useEffect(() => {
    const graph = presetJsonToGraph(presetJson);
    if (graph.nodes.length > 0) {
      setNodes(graph.nodes);
      setEdges(graph.edges);
    }
  }, [presetGraphKey, presetJson, setEdges, setNodes]);

  const insertLipsyncTemplate = useCallback(() => {
    setNodes(LIPSYNC_TEMPLATE_NODES.map((node) => ({ ...node })));
    setEdges(LIPSYNC_TEMPLATE_EDGES.map((edge) => ({ ...edge })));
    onStatus(
      "リップシンク簡易テンプレを配置しました。Export → 適用後、Pipeline で Volume / Phoneme を試してください。",
      "success",
    );
  }, [onStatus, setEdges, setNodes]);

  const handleContextMenu = (event: { preventDefault(): void }) => {
    event.preventDefault();
  };

  return (
    <section className="graph-editor">
      <p className="hint">
        数値マッピングは State / Channel Input → 変換ノード → Motion
        Output。リップシンクは <strong>Graph に mouthX / mouthY 出力が必要</strong>
        です。まず「リップシンク簡易テンプレ」を試してください。
      </p>
      <ActivePluginsPanel pluginIds={activePluginIds} />

      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">テンプレ</span>
          <button type="button" className="primary" onClick={insertLipsyncTemplate}>
            リップシンク簡易テンプレ
          </button>
          <button type="button" onClick={loadFromPreset}>
            プリセットから読み込み
          </button>
        </div>
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">State / Channel</span>
          <button type="button" onClick={() => addNode("input")}>
            + State
          </button>
          <button type="button" onClick={() => addNode("channelInput")}>
            + Channel
          </button>
          <button type="button" onClick={() => addNode("volumeToMouth")}>
            + Volume→Mouth
          </button>
          <button type="button" onClick={() => addNode("phonemeToShape")}>
            + Phoneme→Shape
          </button>
        </div>
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">Math / Out</span>
          <button type="button" onClick={() => addNode("multiply")}>
            + Multiply
          </button>
          <button type="button" onClick={() => addNode("output")}>
            + Output
          </button>
          <button type="button" onClick={removeSelectedNodes}>
            選択削除
          </button>
        </div>
      </div>

      <div className="canvas" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onPaneContextMenu={handleContextMenu}
          onNodeContextMenu={handleContextMenu}
          onEdgeContextMenu={handleContextMenu}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div className="graph-actions">
        <button
          type="button"
          onClick={() => {
            const json = mergeGraphIntoPreset(presetJson, { nodes, edges });
            onExport(json);
            onStatus(
              "Preset JSON をエクスポートしました（plugins を保持）。",
              "success",
            );
          }}
        >
          Export to Preset JSON
        </button>
        {exportJson ? (
          <button type="button" onClick={onLoadExportedPreset}>
            エクスポートをランタイムに適用
          </button>
        ) : null}
      </div>

      {exportJson ? <pre className="export-preview">{exportJson}</pre> : null}
    </section>
  );
}
