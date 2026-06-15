import "@xyflow/react/dist/style.css";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { LIPSYNC_GRAPH_TEMPLATE } from "../constants/lipsync-template";
import {
  defaultExtensionCustomNodeData,
  defaultMotionFunctionNodeData,
  defaultMotionGeneratorNodeData,
  defaultMotionPackNodeData,
  getExtensionGraphCustomNodes,
  getExtensionGraphFunctions,
  getExtensionGraphGenerators,
  getExtensionGraphPacks,
} from "../constants/extension-graph-nodes";
import {
  ExtensionCustomNode,
  MotionFunctionNode,
  MotionGeneratorNode,
  MotionPackNode,
} from "./graph/ExtensionGraphNodes";
import { ActivePluginsPanel } from "./ActivePluginsPanel";
import { mergeGraphIntoPreset } from "../graph-to-preset";
import { extractGraphJson } from "../utils/preset-parts";
import {
  findDuplicateExtensionPackIds,
  formatDuplicatePackWarning,
} from "../utils/extension-duplicates";
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

const EXTENSION_GRAPH_PACKS = getExtensionGraphPacks();
const EXTENSION_GRAPH_GENERATORS = getExtensionGraphGenerators();
const EXTENSION_GRAPH_FUNCTIONS = getExtensionGraphFunctions();
const EXTENSION_GRAPH_CUSTOM_NODES = getExtensionGraphCustomNodes();

function findPackConfigFields(packId: string) {
  return EXTENSION_GRAPH_PACKS.find((pack) => pack.id === packId)?.configFields ?? [];
}

function findGeneratorConfigFields(generatorId: string) {
  return (
    EXTENSION_GRAPH_GENERATORS.find((generator) => generator.id === generatorId)
      ?.configFields ?? []
  );
}

function findFunctionConfigFields(functionName: string) {
  return (
    EXTENSION_GRAPH_FUNCTIONS.find((fn) => fn.name === functionName)?.configFields ?? []
  );
}

function findCustomNodeConfigFields(nodeType: string) {
  return (
    EXTENSION_GRAPH_CUSTOM_NODES.find((node) => node.type === nodeType)?.configFields ??
    []
  );
}

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

function OscillatorNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; frequency: number; stateId?: string };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Oscillator</strong>
      <label className="node-field">
        <span>frequency</span>
        <input
          className="node-input"
          type="number"
          min={0.05}
          max={4}
          step={0.05}
          value={data.frequency}
          onChange={(event) =>
            onChange(id, { frequency: Number(event.target.value) || 0.5 })
          }
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SmoothNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; speed: number; stateId?: string };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <Handle type="target" position={Position.Left} />
      <strong>Smooth</strong>
      <label className="node-field">
        <span>speed</span>
        <input
          className="node-input"
          type="number"
          min={0.1}
          max={20}
          step={0.1}
          value={data.speed}
          onChange={(event) => onChange(id, { speed: Number(event.target.value) || 2 })}
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SpringNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; stiffness: number; damping: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <Handle type="target" position={Position.Left} />
      <strong>Spring</strong>
      <label className="node-field">
        <span>stiffness</span>
        <input
          className="node-input"
          type="number"
          min={10}
          max={500}
          step={10}
          value={data.stiffness}
          onChange={(event) =>
            onChange(id, { stiffness: Number(event.target.value) || 180 })
          }
        />
      </label>
      <label className="node-field">
        <span>damping</span>
        <input
          className="node-input"
          type="number"
          min={1}
          max={80}
          step={1}
          value={data.damping}
          onChange={(event) =>
            onChange(id, { damping: Number(event.target.value) || 18 })
          }
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function RandomHoldNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; interval: number; min: number; max: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Random Hold</strong>
      <label className="node-field">
        <span>interval (s)</span>
        <input
          className="node-input"
          type="number"
          min={0.2}
          max={30}
          step={0.1}
          value={data.interval}
          onChange={(event) =>
            onChange(id, { interval: Number(event.target.value) || 3 })
          }
        />
      </label>
      <label className="node-field">
        <span>min</span>
        <input
          className="node-input"
          type="number"
          min={-1}
          max={1}
          step={0.05}
          value={data.min}
          onChange={(event) => onChange(id, { min: Number(event.target.value) })}
        />
      </label>
      <label className="node-field">
        <span>max</span>
        <input
          className="node-input"
          type="number"
          min={-1}
          max={1}
          step={0.05}
          value={data.max}
          onChange={(event) => onChange(id, { max: Number(event.target.value) })}
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function BlinkNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; averageInterval: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Blink</strong>
      <label className="node-field">
        <span>avg interval (s)</span>
        <input
          className="node-input"
          type="number"
          min={1}
          max={20}
          step={0.5}
          value={data.averageInterval}
          onChange={(event) =>
            onChange(id, { averageInterval: Number(event.target.value) || 4 })
          }
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function BreathNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; rate: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Breath</strong>
      <label className="node-field">
        <span>rate</span>
        <input
          className="node-input"
          type="number"
          min={0.05}
          max={1}
          step={0.05}
          value={data.rate}
          onChange={(event) =>
            onChange(id, { rate: Number(event.target.value) || 0.25 })
          }
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function WanderNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; speed: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Wander</strong>
      <label className="node-field">
        <span>speed</span>
        <input
          className="node-input"
          type="number"
          min={0.05}
          max={2}
          step={0.05}
          value={data.speed}
          onChange={(event) =>
            onChange(id, { speed: Number(event.target.value) || 0.2 })
          }
        />
      </label>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function CooldownNode({
  id,
  data,
  onChange,
}: {
  id: string;
  data: { label: string; duration: number };
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="node node-extension">
      <strong>Cooldown</strong>
      <label className="node-field">
        <span>duration (s)</span>
        <input
          className="node-input"
          type="number"
          min={0.1}
          max={30}
          step={0.1}
          value={data.duration}
          onChange={(event) =>
            onChange(id, { duration: Number(event.target.value) || 3 })
          }
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
  onPresetGraphChange?: (graphJson: string, mergedPresetJson: string) => void;
  onStatus: (message: string, kind: "success" | "error" | "info") => void;
}

const LIPSYNC_POSITIONS: Record<string, { x: number; y: number }> = {
  "ls-vol": { x: 0, y: 40 },
  "ls-vtm": { x: 220, y: 40 },
  "ls-mouthY": { x: 460, y: 40 },
  "ls-ph-x": { x: 0, y: 160 },
  "ls-out-x": { x: 260, y: 160 },
};

const LIPSYNC_TEMPLATE_NODES: Node[] = LIPSYNC_GRAPH_TEMPLATE.nodes.map((node) => ({
  id: node.id,
  type: node.type,
  position: LIPSYNC_POSITIONS[node.id] ?? { x: 0, y: 0 },
  data: { label: String(node.data.label ?? node.type), ...node.data },
}));

const LIPSYNC_TEMPLATE_EDGES: Edge[] = LIPSYNC_GRAPH_TEMPLATE.edges.map((edge) => ({
  ...edge,
}));

let nextNodeId = 1;

function createNodeId(prefix: string): string {
  nextNodeId += 1;
  return `${prefix}-${nextNodeId}`;
}

function GraphEditorContent({
  exportJson,
  presetJson,
  presetGraphKey,
  activePluginIds,
  onExport,
  onLoadExportedPreset,
  onPresetGraphChange,
  onStatus,
}: GraphEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const graphDirtyRef = useRef(false);
  const nodesRef = useRef(INITIAL_NODES);
  const edgesRef = useRef(INITIAL_EDGES);
  const presetJsonRef = useRef(presetJson);
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  presetJsonRef.current = presetJson;

  const markGraphDirty = useCallback(() => {
    graphDirtyRef.current = true;
  }, []);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      markGraphDirty();
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    },
    [markGraphDirty, setNodes],
  );

  const nodeTypes = useMemo(() => {
    const types: Record<
      string,
      (props: { id: string; data: Record<string, unknown> }) => JSX.Element
    > = {
      input: (props) => (
        <InputNode
          id={props.id}
          data={props.data as { label: string; key: string }}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
      multiply: (props) => (
        <MultiplyNode
          id={props.id}
          data={props.data as { label: string; gain: number }}
          onGainChange={(nodeId, gain) => {
            updateNodeData(nodeId, { gain });
          }}
        />
      ),
      oscillator: (props) => (
        <OscillatorNode
          id={props.id}
          data={props.data as { label: string; frequency: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      smooth: (props) => (
        <SmoothNode
          id={props.id}
          data={props.data as { label: string; speed: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      spring: (props) => (
        <SpringNode
          id={props.id}
          data={props.data as { label: string; stiffness: number; damping: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      randomHold: (props) => (
        <RandomHoldNode
          id={props.id}
          data={
            props.data as { label: string; interval: number; min: number; max: number }
          }
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      blink: (props) => (
        <BlinkNode
          id={props.id}
          data={props.data as { label: string; averageInterval: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      breath: (props) => (
        <BreathNode
          id={props.id}
          data={props.data as { label: string; rate: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      wander: (props) => (
        <WanderNode
          id={props.id}
          data={props.data as { label: string; speed: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      cooldown: (props) => (
        <CooldownNode
          id={props.id}
          data={props.data as { label: string; duration: number }}
          onChange={(nodeId, patch) => updateNodeData(nodeId, patch)}
        />
      ),
      channelInput: (props) => (
        <ChannelInputNode
          id={props.id}
          data={props.data as { label: string; key: string }}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
      volumeToMouth: (props) => (
        <VolumeToMouthNode
          id={props.id}
          data={props.data as { label: string; gain: number }}
          onGainChange={(nodeId, gain) => {
            updateNodeData(nodeId, { gain });
          }}
        />
      ),
      phonemeToShape: (props) => (
        <PhonemeToShapeNode
          id={props.id}
          data={props.data as { label: string; axis: string; source: string }}
          onAxisChange={(nodeId, axis) => {
            updateNodeData(nodeId, { axis, label: axis });
          }}
          onSourceChange={(nodeId, source) => {
            updateNodeData(nodeId, { source });
          }}
        />
      ),
      output: (props) => (
        <OutputNode
          id={props.id}
          data={props.data as { label: string; key: string }}
          onKeyChange={(nodeId, key) => {
            updateNodeData(nodeId, { key, label: key });
          }}
        />
      ),
      motionPack: (props) => (
        <MotionPackNode
          data={props.data}
          configFields={findPackConfigFields(String(props.data.packId ?? ""))}
          onChange={(patch) => updateNodeData(props.id, patch)}
        />
      ),
      motionGenerator: (props) => (
        <MotionGeneratorNode
          data={props.data}
          configFields={findGeneratorConfigFields(String(props.data.generatorId ?? ""))}
          onChange={(patch) => updateNodeData(props.id, patch)}
        />
      ),
      motionFunction: (props) => (
        <MotionFunctionNode
          data={props.data}
          configFields={findFunctionConfigFields(String(props.data.functionName ?? ""))}
          onChange={(patch) => updateNodeData(props.id, patch)}
        />
      ),
    };

    for (const customNode of EXTENSION_GRAPH_CUSTOM_NODES) {
      types[customNode.type] = (props) => (
        <ExtensionCustomNode
          data={props.data}
          label={customNode.label}
          configFields={findCustomNodeConfigFields(customNode.type)}
          onChange={(patch) => updateNodeData(props.id, patch)}
        />
      );
    }

    return types;
  }, [updateNodeData]);

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
      markGraphDirty();
      setEdges((current) => addEdge(connection, current));
    },
    [markGraphDirty, setEdges],
  );

  const addExtensionNode = useCallback(
    (
      kind: "motionPack" | "motionGenerator" | "motionFunction" | "ext",
      targetId: string,
    ) => {
      markGraphDirty();
      const y = nodes.length * 80 + 40;
      const x = 640;

      if (kind === "motionPack") {
        const id = createNodeId("pack");
        setNodes((current) => [
          ...current,
          {
            id,
            type: "motionPack",
            position: { x, y },
            data: defaultMotionPackNodeData(targetId),
          },
        ]);
        return;
      }

      if (kind === "motionGenerator") {
        const id = createNodeId("gen");
        setNodes((current) => [
          ...current,
          {
            id,
            type: "motionGenerator",
            position: { x, y },
            data: defaultMotionGeneratorNodeData(targetId),
          },
        ]);
        return;
      }

      if (kind === "motionFunction") {
        const id = createNodeId("fn");
        setNodes((current) => [
          ...current,
          {
            id,
            type: "motionFunction",
            position: { x, y },
            data: defaultMotionFunctionNodeData(targetId),
          },
        ]);
        return;
      }

      const id = createNodeId("ext");
      setNodes((current) => [
        ...current,
        {
          id,
          type: targetId,
          position: { x, y },
          data: defaultExtensionCustomNodeData(targetId),
        },
      ]);
    },
    [markGraphDirty, nodes.length, setNodes],
  );

  const addNode = useCallback(
    (
      type:
        | "input"
        | "channelInput"
        | "volumeToMouth"
        | "phonemeToShape"
        | "multiply"
        | "oscillator"
        | "smooth"
        | "spring"
        | "randomHold"
        | "blink"
        | "breath"
        | "wander"
        | "cooldown"
        | "output",
    ) => {
      markGraphDirty();
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

      if (type === "oscillator") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Oscillator", frequency: 0.5 },
          },
        ]);
        return;
      }

      if (type === "smooth") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Smooth", speed: 2 },
          },
        ]);
        return;
      }

      if (type === "spring") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Spring", stiffness: 180, damping: 18 },
          },
        ]);
        return;
      }

      if (type === "randomHold") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "RandomHold", interval: 3, min: -0.3, max: 0.3 },
          },
        ]);
        return;
      }

      if (type === "blink") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Blink", averageInterval: 4 },
          },
        ]);
        return;
      }

      if (type === "breath") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Breath", rate: 0.25 },
          },
        ]);
        return;
      }

      if (type === "wander") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Wander", speed: 0.2 },
          },
        ]);
        return;
      }

      if (type === "cooldown") {
        setNodes((current) => [
          ...current,
          {
            id,
            type,
            position: { x: 220, y },
            data: { label: "Cooldown", duration: 3 },
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
    [markGraphDirty, nodes.length, setNodes],
  );

  const removeSelectedNodes = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    );
    if (selectedIds.size === 0) {
      onStatus("削除するノードを選択してください。", "info");
      return;
    }

    markGraphDirty();
    setNodes((current) => current.filter((node) => !selectedIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target),
      ),
    );
    onStatus(`${selectedIds.size} 個のノードを削除しました。`, "success");
  }, [markGraphDirty, nodes, onStatus, setEdges, setNodes]);

  const loadFromPreset = useCallback(() => {
    const graph = presetJsonToGraph(presetJson);
    if (graph.nodes.length === 0) {
      onStatus("プリセットから読み込める graph がありません。", "error");
      return;
    }

    setNodes(graph.nodes);
    setEdges(graph.edges);
    onStatus("現在のプリセットからグラフを読み込みました。", "success");
  }, [onStatus, presetJson, setEdges, setNodes]);

  useEffect(() => {
    const graph = presetJsonToGraph(presetJson);
    graphDirtyRef.current = false;
    if (graph.nodes.length > 0) {
      setNodes(graph.nodes);
      setEdges(graph.edges);
      return;
    }

    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
  }, [presetGraphKey, presetJson, setEdges, setNodes]);

  useEffect(() => {
    return () => {
      if (!onPresetGraphChange || !graphDirtyRef.current) {
        return;
      }

      const merged = mergeGraphIntoPreset(presetJsonRef.current, {
        nodes: nodesRef.current,
        edges: edgesRef.current,
      });
      onPresetGraphChange(extractGraphJson(merged), merged);
    };
  }, [onPresetGraphChange]);

  const insertLipsyncTemplate = useCallback(() => {
    markGraphDirty();
    setNodes(LIPSYNC_TEMPLATE_NODES.map((node) => ({ ...node })));
    setEdges(LIPSYNC_TEMPLATE_EDGES.map((edge) => ({ ...edge })));
    onStatus(
      "リップシンク簡易テンプレを配置しました。Export → 適用後、Pipeline で Volume / Phoneme を試してください。",
      "success",
    );
  }, [markGraphDirty, onStatus, setEdges, setNodes]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (changes.some((change) => change.type !== "select")) {
        markGraphDirty();
      }
      onNodesChange(changes);
    },
    [markGraphDirty, onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some((change) => change.type !== "select")) {
        markGraphDirty();
      }
      onEdgesChange(changes);
    },
    [markGraphDirty, onEdgesChange],
  );

  const handleContextMenu = (event: { preventDefault(): void }) => {
    event.preventDefault();
  };

  return (
    <section className="graph-editor">
      <p className="hint">
        数値マッピングは State / Channel Input → 変換ノード → Motion Output。 Motion
        Pack / Generator はエッジ不要で配置するだけで Extension Layer に反映されます。
        リップシンクは <strong>Graph に mouthX / mouthY 出力が必要</strong>
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
          <span className="graph-toolbar-label">Stateful</span>
          <button type="button" onClick={() => addNode("oscillator")}>
            + Oscillator
          </button>
          <button type="button" onClick={() => addNode("smooth")}>
            + Smooth
          </button>
          <button type="button" onClick={() => addNode("spring")}>
            + Spring
          </button>
          <button type="button" onClick={() => addNode("randomHold")}>
            + Random Hold
          </button>
          <button type="button" onClick={() => addNode("blink")}>
            + Blink
          </button>
          <button type="button" onClick={() => addNode("breath")}>
            + Breath
          </button>
          <button type="button" onClick={() => addNode("wander")}>
            + Wander
          </button>
          <button type="button" onClick={() => addNode("cooldown")}>
            + Cooldown
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
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">Motion Pack</span>
          {EXTENSION_GRAPH_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="graph-toolbar-extension"
              title={pack.description}
              onClick={() => addExtensionNode("motionPack", pack.id)}
            >
              + {pack.label}
            </button>
          ))}
        </div>
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">Generator</span>
          {EXTENSION_GRAPH_GENERATORS.map((generator) => (
            <button
              key={generator.id}
              type="button"
              className="graph-toolbar-extension"
              title={generator.description}
              onClick={() => addExtensionNode("motionGenerator", generator.id)}
            >
              + {generator.label}
            </button>
          ))}
        </div>
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">Function</span>
          {EXTENSION_GRAPH_FUNCTIONS.map((fn) => (
            <button
              key={fn.name}
              type="button"
              className="graph-toolbar-extension"
              title={fn.description}
              onClick={() => addExtensionNode("motionFunction", fn.name)}
            >
              + {fn.label}
            </button>
          ))}
        </div>
        <div className="graph-toolbar-group">
          <span className="graph-toolbar-label">Custom Node</span>
          {EXTENSION_GRAPH_CUSTOM_NODES.map((node) => (
            <button
              key={node.type}
              type="button"
              className="graph-toolbar-extension"
              onClick={() => addExtensionNode("ext", node.type)}
            >
              + {node.label}
            </button>
          ))}
        </div>
      </div>

      <div className="canvas" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
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
            const duplicateWarning = formatDuplicatePackWarning(
              findDuplicateExtensionPackIds(presetJson, nodes),
            );
            const json = mergeGraphIntoPreset(presetJson, { nodes, edges });
            onExport(json);
            if (duplicateWarning) {
              onStatus(`エクスポート完了。警告: ${duplicateWarning}`, "info");
              return;
            }
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

export function GraphEditor(props: GraphEditorProps) {
  return (
    <ReactFlowProvider>
      <GraphEditorContent {...props} />
    </ReactFlowProvider>
  );
}
