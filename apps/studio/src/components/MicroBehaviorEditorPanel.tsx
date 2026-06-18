import { useState } from "react";
import type { BehaviorId } from "@puppetflow/micro-behavior";

import { MICRO_BEHAVIOR_STARTER_TEMPLATES } from "../constants/micro-behavior-params";
import type { MicroBehaviorDraft } from "../utils/micro-behavior-draft";
import { validateDraft } from "../utils/micro-behavior-draft";
import { MicroBehaviorFormEditor } from "./MicroBehaviorFormEditor";

export interface MicroBehaviorEditorPanelProps {
  isSimpleMode: boolean;
  customBehaviorIds: BehaviorId[];
  selectedCustomId: string | null;
  editorDraft: MicroBehaviorDraft | null;
  editorJson: string;
  editorError: string | null;
  onSelectCustomId: (id: string | null) => void;
  onDraftChange: (draft: MicroBehaviorDraft) => void;
  onEditorJsonChange: (value: string) => void;
  onSyncJsonFromDraft: () => void;
  onSyncDraftFromJson: () => void;
  onAdd: () => void;
  onAddFromTemplate: (templateId: string) => void;
  onDelete: () => void;
  onApply: () => void;
  onTest: () => void;
}

export function MicroBehaviorEditorPanel({
  isSimpleMode,
  customBehaviorIds,
  selectedCustomId,
  editorDraft,
  editorJson,
  editorError,
  onSelectCustomId,
  onDraftChange,
  onEditorJsonChange,
  onSyncJsonFromDraft,
  onSyncDraftFromJson,
  onAdd,
  onAddFromTemplate,
  onDelete,
  onApply,
  onTest,
}: MicroBehaviorEditorPanelProps) {
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const draftValidation = editorDraft ? validateDraft(editorDraft) : null;

  return (
    <div className="micro-behavior-editor micro-behavior-editor-compact">
      <div className="micro-behavior-editor-toolbar micro-behavior-editor-toolbar-compact">
        <label className="micro-behavior-field micro-behavior-field-grow">
          <span>{isSimpleMode ? "編集中" : "Behavior"}</span>
          <select
            value={selectedCustomId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onSelectCustomId(value || null);
            }}
            disabled={customBehaviorIds.length === 0}
          >
            {customBehaviorIds.length === 0 ? (
              <option value="">（未登録）</option>
            ) : (
              customBehaviorIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="micro-behavior-editor-actions">
          <button type="button" className="micro-behavior-btn-compact" onClick={onAdd}>
            {isSimpleMode ? "新規" : "新規"}
          </button>
          <button
            type="button"
            className="micro-behavior-btn-compact"
            onClick={onDelete}
            disabled={!selectedCustomId}
          >
            削除
          </button>
          <button
            type="button"
            className="micro-behavior-btn-compact"
            onClick={onApply}
            disabled={!editorDraft}
          >
            適用
          </button>
          <button
            type="button"
            className="micro-behavior-btn-compact"
            onClick={onTest}
            disabled={!editorDraft}
          >
            テスト
          </button>
        </div>
      </div>

      <div className="micro-behavior-starter-templates micro-behavior-starter-compact">
        <span className="micro-behavior-starter-label">
          {isSimpleMode ? "テンプレ" : "Template"}
        </span>
        <div className="micro-behavior-buttons micro-behavior-buttons-compact">
          {MICRO_BEHAVIOR_STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="micro-behavior-btn-compact"
              title={isSimpleMode ? template.simpleDescription : template.description}
              onClick={() => onAddFromTemplate(template.id)}
            >
              {isSimpleMode ? template.simpleLabel : template.label}
            </button>
          ))}
        </div>
      </div>

      {editorDraft ? (
        <>
          <MicroBehaviorFormEditor
            draft={editorDraft}
            isSimpleMode={isSimpleMode}
            onDraftChange={onDraftChange}
          />

          {draftValidation ? (
            <p className="micro-behavior-editor-error">{draftValidation}</p>
          ) : null}

          <details
            className="micro-behavior-advanced-json"
            open={showAdvancedJson}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setShowAdvancedJson(open);
              if (open) {
                onSyncJsonFromDraft();
              }
            }}
          >
            <summary>{isSimpleMode ? "JSON" : "Advanced JSON"}</summary>
            <textarea
              className="micro-behavior-editor-json"
              rows={8}
              spellCheck={false}
              value={editorJson}
              onChange={(event) => onEditorJsonChange(event.target.value)}
            />
            <button type="button" className="micro-behavior-btn-compact" onClick={onSyncDraftFromJson}>
              フォームへ反映
            </button>
          </details>
        </>
      ) : (
        <p className="hint micro-behavior-empty-hint">
          {isSimpleMode
            ? "テンプレまたは新規から作成してください。"
            : "テンプレートまたは新規から Behavior を作成してください。"}
        </p>
      )}

      {editorError ? <p className="micro-behavior-editor-error">{editorError}</p> : null}
    </div>
  );
}
