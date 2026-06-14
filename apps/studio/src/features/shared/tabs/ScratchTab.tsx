import { lazy, Suspense } from "react";
import type { StatusKind } from "../../../components/StatusBanner";

const ScratchEditor = lazy(() =>
  import("../../../components/ScratchEditor").then((module) => ({
    default: module.ScratchEditor,
  })),
);

export interface ScratchTabProps {
  isSimpleMode: boolean;
  assembledPresetJson: string;
  graphJson: string;
  behaviorPluginsJson: string;
  activePluginIds: string[];
  behaviorPreviewJson: string;
  onPreviewJson: (json: string) => void;
  onApply: (merged: string) => Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

export function ScratchTab({
  isSimpleMode,
  assembledPresetJson,
  graphJson,
  behaviorPluginsJson,
  activePluginIds,
  behaviorPreviewJson,
  onPreviewJson,
  onApply,
  onStatus,
}: ScratchTabProps) {
  return (
    <Suspense fallback={<p className="hint">Scratch Editor を読み込み中…</p>}>
      <ScratchEditor
        presetJson={assembledPresetJson}
        graphJson={graphJson}
        behaviorPluginsJson={behaviorPluginsJson}
        activePluginIds={activePluginIds}
        onPreviewJson={onPreviewJson}
        onApply={async (_behavior, merged) => {
          await onApply(merged);
        }}
        onStatus={onStatus}
      />
      {!isSimpleMode && behaviorPreviewJson ? (
        <details className="scratch-preview">
          <summary>behavior JSON プレビュー</summary>
          <pre>{behaviorPreviewJson}</pre>
        </details>
      ) : null}
    </Suspense>
  );
}
