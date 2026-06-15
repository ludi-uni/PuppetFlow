import { buildCliYamlFromStudio, serializeCliYamlConfig } from "@puppetflow/cli-config";
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
}

export interface ExportCliConfigResult {
  saved: boolean;
  cancelled: boolean;
  downloadedPreset: boolean;
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
  });

  const yaml = serializeCliYamlConfig(yamlConfig, {
    includeCustomPresetNote: input.isCustomPreset,
  });

  if (input.isCustomPreset && input.presetJson && canPickSaveDirectory()) {
    const presetFileName = `${sanitizePresetFileName(String(input.preset))}.pfpreset`;
    const directoryResult = await saveFilesToDirectory([
      { fileName: "puppetflow.yaml", contents: yaml },
      { fileName: presetFileName, contents: input.presetJson },
    ]);

    if (!directoryResult.ok) {
      return {
        saved: false,
        cancelled: directoryResult.reason === "cancelled",
        downloadedPreset: false,
        usedDirectoryPicker: false,
      };
    }

    return {
      saved: true,
      cancelled: false,
      downloadedPreset: true,
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
        usedDirectoryPicker: false,
      };
    }

    downloadedPreset = true;
  }

  return {
    saved: true,
    cancelled: false,
    downloadedPreset,
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
