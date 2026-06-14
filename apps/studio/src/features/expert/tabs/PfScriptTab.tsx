import { lazy, Suspense } from "react";
import type { StatusKind } from "../../../components/StatusBanner";

const PfScriptEditor = lazy(() =>
  import("../../../components/PfScriptEditor").then((module) => ({
    default: module.PfScriptEditor,
  })),
);

export interface PfScriptTabProps {
  assembledPresetJson: string;
  applyingPreset: boolean;
  behaviorPreviewJson: string;
  onPreviewJson: (json: string) => void;
  onApply: (merged: string) => Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

export function PfScriptTab({
  assembledPresetJson,
  applyingPreset,
  behaviorPreviewJson,
  onPreviewJson,
  onApply,
  onStatus,
}: PfScriptTabProps) {
  return (
    <Suspense fallback={<p className="hint">PFScript Editor を読み込み中…</p>}>
      <PfScriptEditor
        presetJson={assembledPresetJson}
        applying={applyingPreset}
        onPreviewJson={onPreviewJson}
        onApply={onApply}
        onStatus={onStatus}
      />
      {behaviorPreviewJson ? (
        <details className="pfscript-preview">
          <summary>behavior JSON（App プレビュー）</summary>
          <pre>{behaviorPreviewJson}</pre>
        </details>
      ) : null}
    </Suspense>
  );
}
