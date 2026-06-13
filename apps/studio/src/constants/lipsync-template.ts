export const LIPSYNC_GRAPH_TEMPLATE = {
  nodes: [
    {
      id: "ls-vol",
      type: "channelInput",
      data: { label: "volume", key: "volume" },
    },
    {
      id: "ls-vtm",
      type: "volumeToMouth",
      data: { label: "VolumeToMouth", gain: 1 },
    },
    {
      id: "ls-mouthY",
      type: "output",
      data: { label: "mouthY", key: "mouthY" },
    },
    {
      id: "ls-ph-x",
      type: "phonemeToShape",
      data: { label: "mouthX", axis: "mouthX", source: "auto" },
    },
    {
      id: "ls-out-x",
      type: "output",
      data: { label: "mouthX", key: "mouthX" },
    },
  ],
  edges: [
    { id: "ls-e1", source: "ls-vol", target: "ls-vtm" },
    { id: "ls-e2", source: "ls-vtm", target: "ls-mouthY" },
    { id: "ls-e3", source: "ls-ph-x", target: "ls-out-x" },
  ],
} as const;

export function hasLipsyncGraph(graph: { nodes?: Array<{ type?: string }> }): boolean {
  const types = new Set((graph.nodes ?? []).map((node) => node.type));
  return types.has("volumeToMouth") && types.has("phonemeToShape");
}
