import type { PluginOutputSnapshot } from "@puppetflow/runtime";
import { MotionTable, type MotionTableColumn } from "./MotionTable";

interface PluginOutputsPanelProps {
  pluginOutputs: PluginOutputSnapshot[];
}

export function PluginOutputsPanel({ pluginOutputs }: PluginOutputsPanelProps) {
  if (pluginOutputs.length === 0) {
    return <p className="hint">No plugins are active.</p>;
  }

  const columns: MotionTableColumn[] = pluginOutputs.map((snapshot, index) => ({
    id: `${snapshot.pluginId}-${index}`,
    label: snapshot.pluginId,
    values: snapshot.output,
  }));

  return (
    <MotionTable
      columns={columns}
      onlyDefined
      emptyHint="(no motion output this frame)"
    />
  );
}
