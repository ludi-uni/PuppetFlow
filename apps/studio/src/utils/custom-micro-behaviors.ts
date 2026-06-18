import type { MicroBehaviorDefinition } from "@puppetflow/micro-behavior";
import {
  DEFAULT_MICRO_BEHAVIORS_FILE_NAME,
  isMicroBehaviorId,
  isValidBehaviorId,
  mergeMicroBehaviorDefinitions,
  parseBehaviorDefinitionInput,
  parseMicroBehaviorsFile,
  serializeMicroBehaviorsFile,
} from "@puppetflow/micro-behavior";
import { getRuntime } from "../runtime";

const STORAGE_KEY = "puppetflow.studio.customMicroBehaviors.v1";

let cachedCustomBehaviors: MicroBehaviorDefinition[] | null = null;

export const CUSTOM_MICRO_BEHAVIOR_PARAM_HINT =
  "lookX, lookY, eyeOpen, headTilt, facePitch, faceYaw";

export function createCustomMicroBehaviorTemplate(): MicroBehaviorDefinition {
  return {
    id: "my_custom",
    duration: 1,
    cooldown: 3,
    keyframes: [
      { t: 0, params: { lookY: 0.5 } },
      { t: 0.4, params: { lookY: 0.25 } },
      { t: 1, params: { lookY: 0.5 } },
    ],
  };
}

export function formatCustomMicroBehaviorJson(
  definition: MicroBehaviorDefinition,
): string {
  return JSON.stringify(definition, null, 2);
}

export function loadCustomMicroBehaviors(): MicroBehaviorDefinition[] {
  return readStorage();
}

export function saveCustomMicroBehaviors(
  definitions: readonly MicroBehaviorDefinition[],
): void {
  writeStorage(definitions);
}

export function syncCustomMicroBehaviorsToRuntime(
  definitions: readonly MicroBehaviorDefinition[],
): void {
  getRuntime().microBehavior.setCustomDefinitions(definitions);
}

export function serializeCustomMicroBehaviorsForExport(
  definitions: readonly MicroBehaviorDefinition[],
): string {
  return serializeMicroBehaviorsFile(definitions);
}

export type ParseCustomMicroBehaviorResult =
  | { ok: true; definition: MicroBehaviorDefinition }
  | { ok: false; error: string };

export type ParseCustomMicroBehaviorsImportResult =
  | { ok: true; definitions: MicroBehaviorDefinition[] }
  | { ok: false; error: string };

export function parseCustomMicroBehaviorEditorJson(
  json: string,
): ParseCustomMicroBehaviorResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `JSON の解析に失敗しました: ${message}` };
  }

  try {
    if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null && "behaviors" in parsed)) {
      const definitions = parseMicroBehaviorsFile(parsed);
      if (definitions.length !== 1) {
        return {
          ok: false,
          error:
            "1 件の Behavior 定義オブジェクトを指定してください（複数件はインポートを使用）。",
        };
      }
      return { ok: true, definition: definitions[0]! };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "定義は JSON オブジェクトである必要があります。" };
    }

    const record = parsed as Partial<MicroBehaviorDefinition>;
    if (typeof record.id !== "string" || !isValidBehaviorId(record.id)) {
      return {
        ok: false,
        error:
          "id は英字で始まる 1〜64 文字（英数字・_・-）である必要があります。",
      };
    }

    if (isMicroBehaviorId(record.id)) {
      return {
        ok: false,
        error: `組み込み Behavior「${record.id}」は上書きできません。`,
      };
    }

    const { id, ...body } = record;
    return { ok: true, definition: parseBehaviorDefinitionInput(id!, body) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export function parseCustomMicroBehaviorsImport(
  json: string,
): ParseCustomMicroBehaviorsImportResult {
  try {
    const parsed = JSON.parse(json);
    return { ok: true, definitions: parseMicroBehaviorsFile(parsed) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export function mergeImportedCustomMicroBehaviors(
  current: readonly MicroBehaviorDefinition[],
  incoming: readonly MicroBehaviorDefinition[],
): MicroBehaviorDefinition[] {
  return mergeMicroBehaviorDefinitions(current, incoming);
}

export { DEFAULT_MICRO_BEHAVIORS_FILE_NAME };

function readStorage(): MicroBehaviorDefinition[] {
  if (typeof localStorage === "undefined") {
    return cachedCustomBehaviors ? [...cachedCustomBehaviors] : [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cachedCustomBehaviors ? [...cachedCustomBehaviors] : [];
    }

    const definitions = parseMicroBehaviorsFile(JSON.parse(raw));
    cachedCustomBehaviors = definitions;
    return [...definitions];
  } catch {
    return cachedCustomBehaviors ? [...cachedCustomBehaviors] : [];
  }
}

function writeStorage(definitions: readonly MicroBehaviorDefinition[]): void {
  cachedCustomBehaviors = [...definitions];
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, serializeMicroBehaviorsFile(definitions));
}

/** @internal test helper */
export function resetCustomMicroBehaviorsStorageForTests(): void {
  cachedCustomBehaviors = null;
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
