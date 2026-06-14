import { lazy, Suspense } from "react";
import type { StatusKind } from "../../../components/StatusBanner";

const GraphEditor = lazy(() =>
  import("../../../components/GraphEditor").then((module) => ({
    default: module.GraphEditor,
  })),
);

export interface GraphTabProps {
  exportJson: string;
  assembledPresetJson: string;
  graphEditorKey: number;
  activePluginIds: string[];
  onPresetGraphChange: (nextGraphJson: string, merged: string) => void;
  onExport: (json: string) => void;
  onLoadExportedPreset: () => void;
  onStatus: (message: string, kind?: StatusKind) => void;
}

export function GraphTab({
  exportJson,
  assembledPresetJson,
  graphEditorKey,
  activePluginIds,
  onPresetGraphChange,
  onExport,
  onLoadExportedPreset,
  onStatus,
}: GraphTabProps) {
  return (
    <Suspense fallback={<p className="hint">Graph Editor を読み込み中…</p>}>
      <GraphEditor
        exportJson={exportJson}
        presetJson={assembledPresetJson}
        presetGraphKey={graphEditorKey}
        activePluginIds={activePluginIds}
        onPresetGraphChange={onPresetGraphChange}
        onExport={onExport}
        onLoadExportedPreset={onLoadExportedPreset}
        onStatus={onStatus}
      />
    </Suspense>
  );
}
