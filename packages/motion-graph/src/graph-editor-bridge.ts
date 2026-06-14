import {
  isMotionStateKey,
  type MotionGraphDocument,
  type MotionGraphNode,
} from "./types.js";

export interface EditorGraphNode {
  id: string;
  type?: string | null;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface EditorGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface EditorGraphDocument {
  nodes: EditorGraphNode[];
  edges: EditorGraphEdge[];
}

function numericConfigFromData(data: Record<string, unknown>): Record<string, number> {
  const config: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "label" || key === "packId" || key === "generatorId" || key === "functionName") {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      config[key] = value;
    }
  }
  return config;
}

export function mapEditorTypeToRuntime(type: string): string {
  switch (type) {
    case "input":
      return "stateInput";
    case "channelInput":
      return "channelInput";
    case "volumeToMouth":
      return "volumeToMouth";
    case "phonemeToShape":
      return "phonemeToShape";
    case "multiply":
      return "multiply";
    case "output":
      return "output";
    case "motionPack":
      return "motionPack";
    case "motionGenerator":
      return "motionGenerator";
    case "motionFunction":
      return "motionFunction";
    default:
      return type;
  }
}

export function mapRuntimeTypeToEditor(type: string): string {
  switch (type) {
    case "stateInput":
      return "input";
    case "channelInput":
      return "channelInput";
    case "volumeToMouth":
      return "volumeToMouth";
    case "phonemeToShape":
      return "phonemeToShape";
    case "multiply":
      return "multiply";
    case "output":
      return "output";
    case "motionPack":
      return "motionPack";
    case "motionGenerator":
      return "motionGenerator";
    case "motionFunction":
      return "motionFunction";
    default:
      return type;
  }
}

export function mapEditorNodeDataToRuntime(
  node: EditorGraphNode,
): Record<string, unknown> {
  const type = String(node.type ?? "multiply");

  if (type === "input") {
    return { key: String(node.data.key ?? "interest") };
  }

  if (type === "channelInput") {
    return { key: String(node.data.key ?? "volume") };
  }

  if (type === "volumeToMouth") {
    return {
      key: String(node.data.key ?? "volume"),
      gain: Number(node.data.gain ?? 1),
    };
  }

  if (type === "phonemeToShape") {
    return {
      axis: String(node.data.axis ?? "mouthY"),
      source: String(node.data.source ?? "auto"),
    };
  }

  if (type === "multiply") {
    return { gain: Number(node.data.gain ?? 0.5) };
  }

  if (type === "output") {
    const key = String(node.data.key ?? "mouthX");
    return { key: isMotionStateKey(key) ? key : "mouthX" };
  }

  if (type === "motionPack") {
    return {
      packId: String(node.data.packId ?? ""),
      ...numericConfigFromData(node.data),
    };
  }

  if (type === "motionGenerator") {
    return {
      generatorId: String(node.data.generatorId ?? ""),
      ...numericConfigFromData(node.data),
    };
  }

  if (type === "motionFunction") {
    return {
      functionName: String(node.data.functionName ?? ""),
      ...numericConfigFromData(node.data),
    };
  }

  if (type.startsWith("ext:")) {
    return numericConfigFromData(node.data);
  }

  if (
    type === "oscillator" ||
    type === "smooth" ||
    type === "spring" ||
    type === "randomHold" ||
    type === "blink" ||
    type === "breath" ||
    type === "wander" ||
    type === "cooldown"
  ) {
    return numericConfigFromData(node.data);
  }

  return { ...node.data };
}

function editorNodeDataFromRuntime(node: MotionGraphNode): Record<string, unknown> {
  if (
    node.type === "motionPack" ||
    node.type === "motionGenerator" ||
    node.type === "motionFunction" ||
    node.type.startsWith("ext:") ||
    node.type === "oscillator" ||
    node.type === "smooth" ||
    node.type === "spring" ||
    node.type === "randomHold" ||
    node.type === "blink" ||
    node.type === "breath" ||
    node.type === "wander" ||
    node.type === "cooldown"
  ) {
    return {
      label: String(
        node.data.label ??
          node.data.packId ??
          node.data.generatorId ??
          node.data.functionName ??
          node.type,
      ),
      ...node.data,
    };
  }

  return {
    label: String(node.data.key ?? node.data.axis ?? node.type),
    key: node.data.key,
    gain: node.data.gain,
    axis: node.data.axis,
    source: node.data.source,
  };
}

export function serializeEditorGraph(graph: EditorGraphDocument): MotionGraphDocument {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: mapEditorTypeToRuntime(String(node.type ?? "multiply")),
      data: mapEditorNodeDataToRuntime(node),
      ...(node.position ? { position: node.position } : {}),
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export function deserializeGraphToEditor(
  graph: MotionGraphDocument,
): EditorGraphDocument {
  return {
    nodes: graph.nodes.map((node, index) => ({
      id: node.id,
      type: mapRuntimeTypeToEditor(node.type),
      position: node.position ?? {
        x: (index % 3) * 220,
        y: Math.floor(index / 3) * 100,
      },
      data: editorNodeDataFromRuntime(node),
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

/** Merges the visual graph into an existing preset JSON string. */
export function mergeGraphIntoPresetJson(
  presetJson: string,
  graph: EditorGraphDocument,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;

  parsed.version = 3;
  parsed.graph = serializeEditorGraph(graph);

  if (typeof parsed.behavior !== "object" || parsed.behavior === null) {
    parsed.behavior = { type: "Block", statements: [] };
  }

  return JSON.stringify(parsed, null, 2);
}

export function graphDocumentToPresetJson(
  graph: EditorGraphDocument,
  name = "GraphPreset",
): string {
  return mergeGraphIntoPresetJson(
    JSON.stringify({
      name,
      version: 3,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
    }),
    graph,
  );
}
