import type { BehaviorId, MicroBehaviorDefinition } from "@puppetflow/micro-behavior";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { StatusKind } from "../components/StatusBanner";
import { MICRO_BEHAVIOR_STARTER_TEMPLATES } from "../constants/micro-behavior-params";
import { getRuntime } from "../runtime";
import {
  createCustomMicroBehaviorTemplate,
  DEFAULT_MICRO_BEHAVIORS_FILE_NAME,
  formatCustomMicroBehaviorJson,
  loadCustomMicroBehaviors,
  mergeImportedCustomMicroBehaviors,
  parseCustomMicroBehaviorEditorJson,
  parseCustomMicroBehaviorsImport,
  saveCustomMicroBehaviors,
  serializeCustomMicroBehaviorsForExport,
  syncCustomMicroBehaviorsToRuntime,
} from "../utils/custom-micro-behaviors";
import {
  createEmptyDraft,
  definitionToDraft,
  draftFromStarterTemplate,
  draftToDefinition,
  parseJsonToDraft,
  sortDraftKeyframes,
  type MicroBehaviorDraft,
} from "../utils/micro-behavior-draft";
import { saveTextFile } from "../utils/save-text-file";

function findDefinition(
  definitions: readonly MicroBehaviorDefinition[],
  id: string | null,
): MicroBehaviorDefinition | null {
  if (!id) {
    return null;
  }
  return definitions.find((entry) => entry.id === id) ?? null;
}

function draftToJson(draft: MicroBehaviorDraft): string {
  return formatCustomMicroBehaviorJson(draftToDefinition(sortDraftKeyframes(draft)));
}

function resolveDefinitionFromEditor(
  draft: MicroBehaviorDraft | null,
  editorJson: string,
): { ok: true; definition: MicroBehaviorDefinition } | { ok: false; error: string } {
  if (draft) {
    try {
      return { ok: true, definition: draftToDefinition(sortDraftKeyframes(draft)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }
  return parseCustomMicroBehaviorEditorJson(editorJson);
}

export interface UseCustomMicroBehaviorsOptions {
  ready: boolean;
  notify: (message: string, kind?: StatusKind) => void;
}

export function useCustomMicroBehaviors({ ready, notify }: UseCustomMicroBehaviorsOptions) {
  const [customBehaviors, setCustomBehaviors] = useState<MicroBehaviorDefinition[]>(() =>
    loadCustomMicroBehaviors(),
  );
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(() =>
    loadCustomMicroBehaviors()[0]?.id ?? null,
  );
  const [editorDraft, setEditorDraft] = useState<MicroBehaviorDraft | null>(() => {
    const initial = loadCustomMicroBehaviors()[0];
    return initial ? definitionToDraft(initial) : null;
  });
  const [editorJson, setEditorJson] = useState(() => {
    const initial = loadCustomMicroBehaviors()[0];
    return initial ? formatCustomMicroBehaviorJson(initial) : "";
  });
  const [editorError, setEditorError] = useState<string | null>(null);

  const customBehaviorIds = useMemo(
    () => customBehaviors.map((entry) => entry.id),
    [customBehaviors],
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    syncCustomMicroBehaviorsToRuntime(customBehaviors);
  }, [ready, customBehaviors]);

  const loadDraft = useCallback((definition: MicroBehaviorDefinition | null) => {
    if (!definition) {
      setEditorDraft(null);
      setEditorJson("");
      return;
    }
    const draft = definitionToDraft(definition);
    setEditorDraft(draft);
    setEditorJson(draftToJson(draft));
  }, []);

  const selectCustomBehavior = useCallback(
    (id: string | null) => {
      setSelectedCustomId(id);
      setEditorError(null);
      loadDraft(findDefinition(customBehaviors, id));
    },
    [customBehaviors, loadDraft],
  );

  const handleDraftChange = useCallback((draft: MicroBehaviorDraft) => {
    const nextDraft = sortDraftKeyframes(draft);
    setEditorDraft(nextDraft);
    setEditorJson(draftToJson(nextDraft));
    setEditorError(null);
  }, []);

  const handleSyncJsonFromDraft = useCallback(() => {
    if (!editorDraft) {
      return;
    }
    setEditorJson(draftToJson(editorDraft));
  }, [editorDraft]);

  const handleSyncDraftFromJson = useCallback(() => {
    const parsed = parseJsonToDraft(editorJson);
    if (!parsed.ok) {
      setEditorError(parsed.error);
      notify(parsed.error, "error");
      return;
    }
    setEditorError(null);
    setEditorDraft(parsed.draft);
    setEditorJson(draftToJson(parsed.draft));
    notify("JSON をフォームに反映しました。", "success");
  }, [editorJson, notify]);

  const createUniqueId = useCallback(
    (baseId: string) => {
      let nextId = baseId;
      let suffix = 2;
      while (customBehaviors.some((entry) => entry.id === nextId)) {
        nextId = `${baseId}_${suffix}`;
        suffix += 1;
      }
      return nextId;
    },
    [customBehaviors],
  );

  const handleAddCustomBehavior = useCallback(() => {
    const nextId = createUniqueId(createCustomMicroBehaviorTemplate().id);
    const draft = createEmptyDraft(nextId);
    const definition = draftToDefinition(draft);
    const next = [...customBehaviors, definition].sort((a, b) => a.id.localeCompare(b.id));
    setCustomBehaviors(next);
    saveCustomMicroBehaviors(next);
    setSelectedCustomId(definition.id);
    loadDraft(definition);
    notify(`カスタム Behavior「${definition.id}」を追加しました。`, "success");
  }, [createUniqueId, customBehaviors, loadDraft, notify]);

  const handleAddFromTemplate = useCallback(
    (templateId: string) => {
      const template = MICRO_BEHAVIOR_STARTER_TEMPLATES.find((entry) => entry.id === templateId);
      if (!template) {
        return;
      }
      const nextId = createUniqueId(template.id);
      const draft = draftFromStarterTemplate(template, nextId);
      const definition = draftToDefinition(draft);
      const next = [...customBehaviors, definition].sort((a, b) => a.id.localeCompare(b.id));
      setCustomBehaviors(next);
      saveCustomMicroBehaviors(next);
      setSelectedCustomId(definition.id);
      loadDraft(definition);
      notify(`テンプレート「${template.simpleLabel}」から「${definition.id}」を追加しました。`, "success");
    },
    [createUniqueId, customBehaviors, loadDraft, notify],
  );

  const handleDeleteCustomBehavior = useCallback(() => {
    if (!selectedCustomId) {
      return;
    }

    const next = customBehaviors.filter((entry) => entry.id !== selectedCustomId);
    setCustomBehaviors(next);
    saveCustomMicroBehaviors(next);
    const nextSelected = next[0]?.id ?? null;
    selectCustomBehavior(nextSelected);
    notify(`カスタム Behavior「${selectedCustomId}」を削除しました。`, "success");
  }, [customBehaviors, notify, selectCustomBehavior, selectedCustomId]);

  const handleApplyCustomBehavior = useCallback(() => {
    const parsed = resolveDefinitionFromEditor(editorDraft, editorJson);
    if (!parsed.ok) {
      setEditorError(parsed.error);
      notify(parsed.error, "error");
      return;
    }

    setEditorError(null);
    const { definition } = parsed;
    const withoutCurrent = customBehaviors.filter(
      (entry) => entry.id !== selectedCustomId && entry.id !== definition.id,
    );
    const next = [...withoutCurrent, definition].sort((a, b) => a.id.localeCompare(b.id));
    setCustomBehaviors(next);
    saveCustomMicroBehaviors(next);
    selectCustomBehavior(definition.id);
    notify(`カスタム Behavior「${definition.id}」を適用しました。`, "success");
  }, [customBehaviors, editorDraft, editorJson, notify, selectCustomBehavior, selectedCustomId]);

  const handleTestCustomBehavior = useCallback(() => {
    const parsed = resolveDefinitionFromEditor(editorDraft, editorJson);
    if (!parsed.ok) {
      setEditorError(parsed.error);
      notify(parsed.error, "error");
      return;
    }

    setEditorError(null);
    const { definition } = parsed;
    getRuntime().microBehavior.registerDefinition(definition);
    const accepted = getRuntime().microBehavior.request({ behavior: definition.id });
    notify(
      accepted
        ? `カスタム Behavior「${definition.id}」を実行しました。`
        : `カスタム Behavior「${definition.id}」は Cooldown 中のため無視されました。`,
      accepted ? "success" : "info",
    );
  }, [editorDraft, editorJson, notify]);

  const handleTriggerBehavior = useCallback(
    (behavior: BehaviorId) => {
      const accepted = getRuntime().microBehavior.request({ behavior });
      notify(
        accepted
          ? `Micro Behavior「${behavior}」を実行しました。`
          : `Micro Behavior「${behavior}」は Cooldown 中のため無視されました。`,
        accepted ? "success" : "info",
      );
    },
    [notify],
  );

  const applyDefinitions = useCallback(
    (next: MicroBehaviorDefinition[], selectedId: string | null) => {
      setCustomBehaviors(next);
      saveCustomMicroBehaviors(next);
      selectCustomBehavior(selectedId ?? next[0]?.id ?? null);
    },
    [selectCustomBehavior],
  );

  const handleExportCustomBehaviors = useCallback(async () => {
    if (customBehaviors.length === 0) {
      notify("エクスポートするカスタム Behavior がありません。", "info");
      return;
    }

    const result = await saveTextFile({
      suggestedName: DEFAULT_MICRO_BEHAVIORS_FILE_NAME,
      contents: serializeCustomMicroBehaviorsForExport(customBehaviors),
      description: "PuppetFlow Micro Behaviors",
      extensions: [".pfmicrobehaviors", ".json"],
      mimeType: "application/json",
    });

    if (!result.ok) {
      if (result.reason !== "cancelled") {
        notify("Micro Behaviors のエクスポートに失敗しました。", "error");
      }
      return;
    }

    notify(`${result.fileName} を保存しました。`, "success");
  }, [customBehaviors, notify]);

  const handleImportCustomBehaviors = useCallback(
    async (file: File | undefined, mode: "merge" | "replace") => {
      if (!file) {
        return;
      }

      let text: string;
      try {
        text = await file.text();
      } catch {
        notify("ファイルの読み込みに失敗しました。", "error");
        return;
      }

      const parsed = parseCustomMicroBehaviorsImport(text);
      if (!parsed.ok) {
        notify(parsed.error, "error");
        return;
      }

      if (parsed.definitions.length === 0) {
        notify("インポートする Behavior が含まれていません。", "info");
        return;
      }

      const next =
        mode === "replace"
          ? parsed.definitions
          : mergeImportedCustomMicroBehaviors(customBehaviors, parsed.definitions);
      applyDefinitions(
        next,
        parsed.definitions[parsed.definitions.length - 1]?.id ?? null,
      );
      notify(
        `${parsed.definitions.length} 件の Behavior を${mode === "replace" ? "読み込み" : "マージ"}しました。`,
        "success",
      );
    },
    [applyDefinitions, customBehaviors, notify],
  );

  return {
    customBehaviors,
    customBehaviorIds,
    selectedCustomId,
    editorDraft,
    editorJson,
    editorError,
    setEditorJson,
    selectCustomBehavior,
    handleDraftChange,
    handleSyncJsonFromDraft,
    handleSyncDraftFromJson,
    handleAddCustomBehavior,
    handleAddFromTemplate,
    handleDeleteCustomBehavior,
    handleApplyCustomBehavior,
    handleTestCustomBehavior,
    handleTriggerBehavior,
    handleExportCustomBehaviors,
    handleImportCustomBehaviors,
  };
}
