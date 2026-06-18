import {
  isValidBehaviorId,
  parseBehaviorDefinitionInput,
} from "./parse-behavior-input.js";
import { isMicroBehaviorId } from "./registry.js";
import type { MicroBehaviorDefinition } from "./types.js";

export const MICRO_BEHAVIORS_FILE_VERSION = 1;
export const MICRO_BEHAVIORS_FILE_EXTENSION = ".pfmicrobehaviors";
export const DEFAULT_MICRO_BEHAVIORS_FILE_NAME = `micro-behaviors${MICRO_BEHAVIORS_FILE_EXTENSION}`;

export interface MicroBehaviorsFile {
  version: number;
  behaviors: MicroBehaviorDefinition[];
}

function parseDefinitionRecord(value: unknown, path: string): MicroBehaviorDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${path} must be an object`);
  }

  const record = value as Partial<MicroBehaviorDefinition>;
  if (typeof record.id !== "string" || !isValidBehaviorId(record.id)) {
    throw new Error(`${path}.id must be a valid behavior id`);
  }

  if (isMicroBehaviorId(record.id)) {
    throw new Error(`${path}.id cannot override built-in behavior "${record.id}"`);
  }

  const { id, ...body } = record;
  return parseBehaviorDefinitionInput(id!, body);
}

export function parseMicroBehaviorsFile(raw: unknown): MicroBehaviorDefinition[] {
  if (Array.isArray(raw)) {
    return raw.map((entry, index) =>
      parseDefinitionRecord(entry, `behaviors[${index}]`),
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Micro behaviors file must be an object or array");
  }

  const file = raw as Partial<MicroBehaviorsFile>;
  if (file.version !== undefined && file.version !== MICRO_BEHAVIORS_FILE_VERSION) {
    throw new Error(
      `Unsupported micro behaviors file version ${file.version}. Expected ${MICRO_BEHAVIORS_FILE_VERSION}.`,
    );
  }

  if (!Array.isArray(file.behaviors)) {
    throw new Error("Micro behaviors file must include a behaviors array");
  }

  return file.behaviors.map((entry, index) =>
    parseDefinitionRecord(entry, `behaviors[${index}]`),
  );
}

export function serializeMicroBehaviorsFile(
  definitions: readonly MicroBehaviorDefinition[],
): string {
  const file: MicroBehaviorsFile = {
    version: MICRO_BEHAVIORS_FILE_VERSION,
    behaviors: [...definitions],
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function mergeMicroBehaviorDefinitions(
  base: readonly MicroBehaviorDefinition[],
  incoming: readonly MicroBehaviorDefinition[],
): MicroBehaviorDefinition[] {
  const merged = new Map(base.map((entry) => [entry.id, entry]));
  for (const definition of incoming) {
    merged.set(definition.id, definition);
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}
