import { buildCliYamlFromStudio, serializeCliYamlConfig } from "@puppetflow/cli-config";
import { DEFAULT_MICRO_BEHAVIORS_FILE_NAME } from "@puppetflow/micro-behavior";
import type { StateValue } from "@puppetflow/core";

import type { MotionMapperEditorConfig } from "../mapper-config";
import type { PresetName, SourceConfig } from "../runtime";
import {
  canPickSaveDirectory,
  canPickSaveLocation,
  saveFilesToDirectory,
  saveTextFile,
} from "./save-text-file";

function sanitizePresetFileName(name: string): string {
  const trimmed = name.trim() || "preset";
  return trimmed.replace(/[^\w.-]+/g, "-");
}

export interface ExportCliConfigInput {
  preset: PresetName | string;
  isCustomPreset: boolean;
  presetJson?: string;
  sources: SourceConfig;
  mapperConfig: MotionMapperEditorConfig;
  initialState?: Record<string, StateValue>;
  customMicroBehaviorsJson?: string;
}

export interface ExportCliConfigResult {
  saved: boolean;
  cancelled: boolean;
  downloadedPreset: boolean;
  downloadedMicroBehaviors: boolean;
  usedDirectoryPicker: boolean;
}

export async function exportStudioCliConfig(
  input: ExportCliConfigInput,
): Promise<ExportCliConfigResult> {
  const yamlConfig = buildCliYamlFromStudio({
    presetName: String(input.preset),
    isCustomPreset: input.isCustomPreset,
    sources: input.sources,
    mapperConfig: input.mapperConfig,
    initialState: input.initialState,
    includeMicroBehaviorsFile: Boolean(input.customMicroBehaviorsJson),
  });

  const yaml = serializeCliYamlConfig(yamlConfig, {
    includeCustomPresetNote: input.isCustomPreset,
  });

  const extraFiles: Array<{ fileName: string; contents: string }> = [];
  if (input.customMicroBehaviorsJson) {
    extraFiles.push({
      fileName: DEFAULT_MICRO_BEHAVIORS_FILE_NAME,
      contents: input.customMicroBehaviorsJson,
    });
  }

  if (
    (input.isCustomPreset && input.presetJson && canPickSaveDirectory()) ||
    (extraFiles.length > 0 && canPickSaveDirectory())
  ) {
    const files = [{ fileName: "puppetflow.yaml", contents: yaml }];
    if (input.isCustomPreset && input.presetJson) {
      files.push({
        fileName: `${sanitizePresetFileName(String(input.preset))}.pfpreset`,
        contents: input.presetJson,
      });
    }
    files.push(...extraFiles);

    const directoryResult = await saveFilesToDirectory(files);

    if (!directoryResult.ok) {
      return {
        saved: false,
        cancelled: directoryResult.reason === "cancelled",
        downloadedPreset: false,
        downloadedMicroBehaviors: false,
        usedDirectoryPicker: false,
      };
    }

    return {
      saved: true,
      cancelled: false,
      downloadedPreset: Boolean(input.isCustomPreset && input.presetJson),
      downloadedMicroBehaviors: extraFiles.length > 0,
      usedDirectoryPicker: directoryResult.method === "picker",
    };
  }

  const yamlResult = await saveTextFile({
    suggestedName: "puppetflow.yaml",
    contents: yaml,
    description: "PuppetFlow CLI config",
    extensions: [".yaml", ".yml"],
    mimeType: "text/yaml",
  });

  if (!yamlResult.ok) {
    return {
      saved: false,
      cancelled: yamlResult.reason === "cancelled",
      downloadedPreset: false,
      downloadedMicroBehaviors: false,
      usedDirectoryPicker: false,
    };
  }

  let downloadedPreset = false;
  if (input.isCustomPreset && input.presetJson) {
    const presetFileName = `${sanitizePresetFileName(String(input.preset))}.pfpreset`;
    const presetResult = await saveTextFile({
      suggestedName: presetFileName,
      contents: input.presetJson,
      description: "PuppetFlow Preset",
      extensions: [".pfpreset", ".json"],
      mimeType: "application/json",
    });

    if (!presetResult.ok) {
      return {
        saved: true,
        cancelled: presetResult.reason === "cancelled",
        downloadedPreset: false,
        downloadedMicroBehaviors: false,
        usedDirectoryPicker: false,
      };
    }

    downloadedPreset = true;
  }

  let downloadedMicroBehaviors = false;
  if (input.customMicroBehaviorsJson) {
    const microResult = await saveTextFile({
      suggestedName: DEFAULT_MICRO_BEHAVIORS_FILE_NAME,
      contents: input.customMicroBehaviorsJson,
      description: "PuppetFlow Micro Behaviors",
      extensions: [".pfmicrobehaviors", ".json"],
      mimeType: "application/json",
    });

    if (!microResult.ok) {
      return {
        saved: true,
        cancelled: microResult.reason === "cancelled",
        downloadedPreset,
        downloadedMicroBehaviors: false,
        usedDirectoryPicker: false,
      };
    }

    downloadedMicroBehaviors = true;
  }

  return {
    saved: true,
    cancelled: false,
    downloadedPreset,
    downloadedMicroBehaviors,
    usedDirectoryPicker: false,
  };
}

export function describeCliExportCapability(): string {
  if (canPickSaveDirectory()) {
    return "保存先フォルダを選択できます。";
  }
  if (canPickSaveLocation()) {
    return "保存先ファイルを選択できます。";
  }
  return "ブラウザのダウンロードフォルダへ保存されます。";
}
