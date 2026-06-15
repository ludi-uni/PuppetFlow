import { useCallback, useMemo, useState } from "react";
import {
  getActivePluginIds,
  getBehaviorPluginIdsFromPresetJson,
  getCurrentPreset,
  getPresetBehaviorPluginIds,
  getPresetJson,
  isCustomPresetActive,
  loadCustomPreset,
  switchPreset,
  type PresetName,
} from "../runtime";
import { applyPresetToStudio } from "../utils/preset-apply";
import { presetHasMouthChannelMapping } from "../utils/graph-mouth-mapping";
import { extractExtensionsJson } from "../utils/extension-config";
import {
  assemblePresetFromParts,
  extractBehaviorJson,
  extractBehaviorPluginsJson,
  extractGraphJson,
  mergeBehaviorPart,
  mergeBehaviorPluginsPart,
  mergeGraphPart,
} from "../utils/preset-parts";
import { validatePresetJson } from "../utils/preset-validation";
import { saveTextFile } from "../utils/save-text-file";
import { saveTextFile } from "../utils/save-text-file";
import type { StatusKind } from "../components/StatusBanner";

export const PRESET_OPTIONS: PresetName[] = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
];

export interface UsePresetStateOptions {
  notify: (message: string, kind?: StatusKind) => void;
}

export function usePresetState({ notify }: UsePresetStateOptions) {
  const initialJson = getPresetJson("Curious");

  const [preset, setPreset] = useState<PresetName>(getCurrentPreset());
  const [customPreset, setCustomPreset] = useState(isCustomPresetActive());
  const [presetJson, setPresetJson] = useState(initialJson);
  const [behaviorJson, setBehaviorJson] = useState(extractBehaviorJson(initialJson));
  const [graphJson, setGraphJson] = useState(extractGraphJson(initialJson));
  const [behaviorPluginsJson, setBehaviorPluginsJson] = useState(
    extractBehaviorPluginsJson(initialJson),
  );
  const [appliedBehaviorPluginsJson, setAppliedBehaviorPluginsJson] = useState(
    extractBehaviorPluginsJson(initialJson),
  );
  const [extensionsJson, setExtensionsJson] = useState(
    extractExtensionsJson(initialJson),
  );
  const [appliedExtensionsJson, setAppliedExtensionsJson] = useState(
    extractExtensionsJson(initialJson),
  );
  const [behaviorPluginIds, setBehaviorPluginIds] = useState<string[]>(
    getPresetBehaviorPluginIds(getCurrentPreset()),
  );
  const [graphEditorKey, setGraphEditorKey] = useState(0);
  const [exportJson, setExportJson] = useState("");
  const [applyingPreset, setApplyingPreset] = useState(false);

  const pluginsHaveChanges =
    behaviorPluginsJson !== appliedBehaviorPluginsJson ||
    extensionsJson !== appliedExtensionsJson;

  const graphMouthMapped = useMemo(
    () => presetHasMouthChannelMapping(presetJson),
    [presetJson],
  );

  const assembledPresetJson = useMemo(
    () =>
      assemblePresetFromParts(presetJson, {
        graphJson,
        behaviorPluginsJson,
        extensionsJson,
      }),
    [presetJson, graphJson, behaviorPluginsJson, extensionsJson],
  );

  const bumpGraphEditorKey = useCallback(() => {
    setGraphEditorKey((current) => current + 1);
  }, []);

  const syncPresetParts = useCallback((json: string) => {
    setBehaviorJson(extractBehaviorJson(json));
    setGraphJson(extractGraphJson(json));
    setBehaviorPluginsJson(extractBehaviorPluginsJson(json));
    setExtensionsJson(extractExtensionsJson(json));
  }, []);

  const presetApplySync = useMemo(
    () => ({
      setPresetJson,
      setCustomPreset,
      syncPresetParts,
      setBehaviorPluginIds,
      setAppliedBehaviorPluginsJson,
      setAppliedExtensionsJson,
      setActivePluginIds: () => {},
      bumpGraphEditorKey,
      setPreset,
    }),
    [syncPresetParts, bumpGraphEditorKey],
  );

  const runPresetApply = useCallback(
    (
      json: string,
      custom: boolean,
      successMessage: string,
      reloadRuntime: () => Promise<unknown>,
      presetName?: PresetName,
    ) =>
      applyPresetToStudio({
        json,
        custom,
        successMessage,
        presetName,
        reloadRuntime,
        getBehaviorPluginIdsFromJson: getBehaviorPluginIdsFromPresetJson,
        getActivePluginIds,
        extractBehaviorPluginsJson,
        extractExtensionsJson,
        sync: presetApplySync,
        setApplying: setApplyingPreset,
        notify,
      }),
    [notify, presetApplySync],
  );

  const handleApplyPresetJson = useCallback(async () => {
    const validationError = validatePresetJson(presetJson);
    if (validationError) {
      notify(`Preset JSON が不正です: ${validationError}`, "error");
      return;
    }

    await runPresetApply(presetJson, true, "カスタム Preset を適用しました。", () =>
      loadCustomPreset(presetJson),
    );
  }, [notify, presetJson, runPresetApply]);

  const handleLoadBuiltinPreset = useCallback(
    async (presetName: PresetName) => {
      const json = getPresetJson(presetName);
      await runPresetApply(
        json,
        false,
        `プリセット「${presetName}」を適用しました。`,
        () => switchPreset(presetName),
        presetName,
      );
    },
    [runPresetApply],
  );

  const handleDownloadPreset = useCallback(async () => {
    const validationError = validatePresetJson(presetJson);
    if (validationError) {
      notify(`ダウンロード前に JSON を修正してください: ${validationError}`, "error");
      return;
    }

    const result = await saveTextFile({
      suggestedName: `${preset}.pfpreset`,
      contents: presetJson,
      description: "PuppetFlow Preset",
      extensions: [".pfpreset", ".json"],
      mimeType: "application/json",
    });

    if (!result.ok) {
      if (result.reason === "cancelled") {
        return;
      }
      notify(`Preset の保存に失敗しました: ${result.message}`, "error");
      return;
    }

    notify(
      result.method === "picker"
        ? `${result.fileName} を保存しました。`
        : "Preset ファイルをダウンロードしました。",
      "success",
    );
  }, [notify, preset, presetJson]);

  const handleImportPresetFile = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const validationError = validatePresetJson(text);
        if (validationError) {
          notify(`インポートした JSON が不正です: ${validationError}`, "error");
          return;
        }

        setPresetJson(text);
        syncPresetParts(text);
        notify(
          `${file.name} を読み込みました。「Preset を適用」でランタイムに反映できます。`,
          "success",
        );
      } catch {
        notify("ファイルの読み込みに失敗しました。", "error");
      }
    },
    [notify, syncPresetParts],
  );

  const handleLoadExportedPreset = useCallback(async () => {
    if (!exportJson) {
      return;
    }

    const validationError = validatePresetJson(exportJson);
    if (validationError) {
      notify(`エクスポート JSON が不正です: ${validationError}`, "error");
      return;
    }

    setApplyingPreset(true);
    try {
      await loadCustomPreset(exportJson);
      setPresetJson(exportJson);
      syncPresetParts(exportJson);
      setCustomPreset(true);
      setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(exportJson));
      setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(exportJson));
      setAppliedExtensionsJson(extractExtensionsJson(exportJson));
      bumpGraphEditorKey();
      notify("グラフからエクスポートした Preset を適用しました。", "success");
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Preset の適用に失敗しました。",
        "error",
      );
      return false;
    } finally {
      setApplyingPreset(false);
    }
  }, [bumpGraphEditorKey, exportJson, notify, syncPresetParts]);

  const handlePresetGraphChange = useCallback(
    (nextGraphJson: string, merged: string) => {
      setGraphJson(nextGraphJson);
      setPresetJson(merged);
    },
    [],
  );

  const selectBuiltinPresetDraft = useCallback(
    (presetName: PresetName) => {
      const json = getPresetJson(presetName);
      setPreset(presetName);
      setPresetJson(json);
      syncPresetParts(json);
    },
    [syncPresetParts],
  );

  const applyMergedCustomPreset = useCallback(
    async (merged: string, successMessage: string) => {
      setPresetJson(merged);
      syncPresetParts(merged);
      setApplyingPreset(true);
      try {
        await loadCustomPreset(merged);
        setCustomPreset(true);
        setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(merged));
        setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(merged));
        setAppliedExtensionsJson(extractExtensionsJson(merged));
        bumpGraphEditorKey();
        notify(successMessage, "success");
        return true;
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Preset の適用に失敗しました。",
          "error",
        );
        return false;
      } finally {
        setApplyingPreset(false);
      }
    },
    [bumpGraphEditorKey, notify, syncPresetParts],
  );

  const updateBehaviorJson = useCallback(
    (next: string) => {
      setBehaviorJson(next);
      try {
        setPresetJson(mergeBehaviorPart(presetJson, next));
      } catch {
        // keep editing until JSON is valid
      }
    },
    [presetJson],
  );

  const updateGraphJson = useCallback(
    (next: string) => {
      setGraphJson(next);
      try {
        setPresetJson(mergeGraphPart(presetJson, next));
      } catch {
        // keep editing until JSON is valid
      }
    },
    [presetJson],
  );

  const updateBehaviorPluginsJson = useCallback(
    (next: string) => {
      setBehaviorPluginsJson(next);
      try {
        setPresetJson(mergeBehaviorPluginsPart(presetJson, next));
      } catch {
        // keep editing until JSON is valid
      }
    },
    [presetJson],
  );

  const updatePresetJson = useCallback(
    (next: string) => {
      setPresetJson(next);
      try {
        syncPresetParts(next);
      } catch {
        // keep editing until JSON is valid
      }
    },
    [syncPresetParts],
  );

  return {
    preset,
    setPreset,
    customPreset,
    setCustomPreset,
    presetJson,
    setPresetJson,
    behaviorJson,
    graphJson,
    setGraphJson,
    behaviorPluginsJson,
    setBehaviorPluginsJson,
    extensionsJson,
    setExtensionsJson,
    behaviorPluginIds,
    setBehaviorPluginIds,
    graphEditorKey,
    exportJson,
    setExportJson,
    applyingPreset,
    pluginsHaveChanges,
    appliedBehaviorPluginsJson,
    graphMouthMapped,
    assembledPresetJson,
    syncPresetParts,
    bumpGraphEditorKey,
    handleApplyPresetJson,
    handleLoadBuiltinPreset,
    handleDownloadPreset,
    handleImportPresetFile,
    handleLoadExportedPreset,
    handlePresetGraphChange,
    selectBuiltinPresetDraft,
    applyMergedCustomPreset,
    updateBehaviorJson,
    updateGraphJson,
    updateBehaviorPluginsJson,
    updatePresetJson,
  };
}
