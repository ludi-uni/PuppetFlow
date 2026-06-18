import type { BehaviorId, MicroBehaviorSnapshot } from "@puppetflow/micro-behavior";
import { MicroBehaviorDebugPanel } from "../../../components/MicroBehaviorDebugPanel";
import { MicroBehaviorEditorPanel } from "../../../components/MicroBehaviorEditorPanel";
import type { MicroBehaviorDraft } from "../../../utils/micro-behavior-draft";

export interface MicroBehaviorsTabProps {
  isSimpleMode: boolean;
  microBehaviorSnapshot: MicroBehaviorSnapshot;
  customBehaviorIds: BehaviorId[];
  selectedCustomBehaviorId: string | null;
  editorDraft: MicroBehaviorDraft | null;
  customBehaviorEditorJson: string;
  customBehaviorEditorError: string | null;
  onCustomBehaviorEditorJsonChange: (value: string) => void;
  onSelectCustomBehavior: (id: string | null) => void;
  onDraftChange: (draft: MicroBehaviorDraft) => void;
  onSyncJsonFromDraft: () => void;
  onSyncDraftFromJson: () => void;
  onAddCustomBehavior: () => void;
  onAddFromTemplate: (templateId: string) => void;
  onDeleteCustomBehavior: () => void;
  onApplyCustomBehavior: () => void;
  onTestCustomBehavior: () => void;
  onTriggerMicroBehavior: (behavior: BehaviorId) => void;
  onExportCustomBehaviors: () => void;
  onImportCustomBehaviors: (file: File | undefined, mode: "merge" | "replace") => void;
}

export function MicroBehaviorsTab({
  isSimpleMode,
  microBehaviorSnapshot,
  customBehaviorIds,
  selectedCustomBehaviorId,
  editorDraft,
  customBehaviorEditorJson,
  customBehaviorEditorError,
  onCustomBehaviorEditorJsonChange,
  onSelectCustomBehavior,
  onDraftChange,
  onSyncJsonFromDraft,
  onSyncDraftFromJson,
  onAddCustomBehavior,
  onAddFromTemplate,
  onDeleteCustomBehavior,
  onApplyCustomBehavior,
  onTestCustomBehavior,
  onTriggerMicroBehavior,
  onExportCustomBehaviors,
  onImportCustomBehaviors,
}: MicroBehaviorsTabProps) {
  return (
    <section className="micro-behaviors-tab micro-behaviors-tab-compact">
      <h2>{isSimpleMode ? "仕草づくり" : "Micro Behaviors"}</h2>

      <details className="micro-behavior-tab-io">
        <summary>{isSimpleMode ? "ファイル" : "Import / Export"}</summary>
        <div className="micro-behavior-file-actions micro-behavior-file-actions-compact">
          <button type="button" className="micro-behavior-btn-compact" onClick={onExportCustomBehaviors}>
            エクスポート
          </button>
          <label className="file-button micro-behavior-btn-compact">
            マージ
            <input
              type="file"
              accept=".pfmicrobehaviors,.json,application/json"
              hidden
              onChange={(event) => {
                onImportCustomBehaviors(event.target.files?.[0], "merge");
                event.target.value = "";
              }}
            />
          </label>
          <label className="file-button micro-behavior-btn-compact">
            置換
            <input
              type="file"
              accept=".pfmicrobehaviors,.json,application/json"
              hidden
              onChange={(event) => {
                onImportCustomBehaviors(event.target.files?.[0], "replace");
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </details>

      <MicroBehaviorEditorPanel
        isSimpleMode={isSimpleMode}
        customBehaviorIds={customBehaviorIds}
        selectedCustomId={selectedCustomBehaviorId}
        editorDraft={editorDraft}
        editorJson={customBehaviorEditorJson}
        editorError={customBehaviorEditorError}
        onSelectCustomId={onSelectCustomBehavior}
        onDraftChange={onDraftChange}
        onEditorJsonChange={onCustomBehaviorEditorJsonChange}
        onSyncJsonFromDraft={onSyncJsonFromDraft}
        onSyncDraftFromJson={onSyncDraftFromJson}
        onAdd={onAddCustomBehavior}
        onAddFromTemplate={onAddFromTemplate}
        onDelete={onDeleteCustomBehavior}
        onApply={onApplyCustomBehavior}
        onTest={onTestCustomBehavior}
      />

      <details className="micro-behavior-tab-debug">
        <summary>{isSimpleMode ? "試す" : "Test"}</summary>
        <MicroBehaviorDebugPanel
          snapshot={microBehaviorSnapshot}
          onTrigger={onTriggerMicroBehavior}
          customBehaviorIds={customBehaviorIds}
          isSimpleMode={isSimpleMode}
        />
      </details>
    </section>
  );
}
