interface GraphNode {
  type?: string;
  data?: { key?: string };
}

export function presetHasMouthChannelMapping(presetJson: string): boolean {
  try {
    const parsed = JSON.parse(presetJson) as {
      graph?: { nodes?: GraphNode[] };
    };
    const nodes = parsed.graph?.nodes ?? [];
    const hasMouthOutput = nodes.some(
      (node) =>
        node.type === "output" &&
        (node.data?.key === "mouthX" || node.data?.key === "mouthY"),
    );
    const hasChannelPipeline = nodes.some((node) =>
      ["channelInput", "volumeToMouth", "phonemeToShape"].includes(String(node.type)),
    );
    return hasMouthOutput && hasChannelPipeline;
  } catch {
    return false;
  }
}
