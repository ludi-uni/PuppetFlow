import type { PresetName } from "../runtime";

export interface PresetApplySyncState {
  setPresetJson: (json: string) => void;
  setCustomPreset: (custom: boolean) => void;
  syncPresetParts: (json: string) => void;
  setBehaviorPluginIds: (ids: string[]) => void;
  setAppliedBehaviorPluginsJson: (json: string) => void;
  setAppliedExtensionsJson: (json: string) => void;
  setActivePluginIds: (ids: string[]) => void;
  bumpGraphEditorKey: () => void;
  setPreset?: (name: PresetName) => void;
}

export interface ApplyPresetOptions {
  json: string;
  custom: boolean;
  successMessage: string;
  reloadRuntime: () => Promise<unknown>;
  getBehaviorPluginIdsFromJson: (json: string) => string[];
  getActivePluginIds: () => string[];
  extractBehaviorPluginsJson: (json: string) => string;
  extractExtensionsJson: (json: string) => string;
  sync: PresetApplySyncState;
  setApplying: (applying: boolean) => void;
  notify: (message: string, kind: "success" | "error") => void;
  presetName?: PresetName;
}

export async function applyPresetToStudio(options: ApplyPresetOptions): Promise<boolean> {
  const {
    json,
    custom,
    successMessage,
    reloadRuntime,
    getBehaviorPluginIdsFromJson,
    getActivePluginIds,
    extractBehaviorPluginsJson,
    extractExtensionsJson,
    sync,
    setApplying,
    notify,
    presetName,
  } = options;

  setApplying(true);
  try {
    await reloadRuntime();
    sync.setPresetJson(json);
    sync.setCustomPreset(custom);
    if (presetName && sync.setPreset) {
      sync.setPreset(presetName);
    }
    sync.syncPresetParts(json);
    sync.setBehaviorPluginIds(getBehaviorPluginIdsFromJson(json));
    sync.setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(json));
    sync.setAppliedExtensionsJson(extractExtensionsJson(json));
    sync.setActivePluginIds(getActivePluginIds());
    sync.bumpGraphEditorKey();
    notify(successMessage, "success");
    return true;
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Preset の適用に失敗しました。",
      "error",
    );
    return false;
  } finally {
    setApplying(false);
  }
}
