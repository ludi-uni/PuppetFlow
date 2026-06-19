import {
  migrateLegacyMotionKey,
  MOTION_STATE_KEYS,
  type MotionStateKey,
} from "@puppetflow/core";
import {
  getDefaultProfile,
  profileToTransforms,
  type ModelTarget,
  type ValueTransform,
} from "@puppetflow/motion-mapper";

import type { OscAdapterLaunchConfig } from "@puppetflow/runtime-launcher";

export type OscAdapterTarget = Exclude<ModelTarget, "custom">;

export interface CustomMappingEntryYaml {
  param: string;
  transform?: ValueTransform;
}

export interface OscAdapterYamlConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  params?: Partial<Record<MotionStateKey, string>>;
  transforms?: Partial<Record<MotionStateKey, ValueTransform>>;
  custom?: Record<string, CustomMappingEntryYaml>;
}

const VALUE_TRANSFORMS = new Set<ValueTransform>(["identity", "centered", "invert"]);

export interface StudioOscMapperModel {
  enabled: boolean;
  host: string;
  port: number;
  params: Record<MotionStateKey, string>;
  transforms: Record<MotionStateKey, ValueTransform>;
  customParams: Record<string, string>;
  customTransforms: Record<string, ValueTransform>;
}

export function sparseMotionParams(
  params: Record<MotionStateKey, string>,
): Partial<Record<MotionStateKey, string>> | undefined {
  const result: Partial<Record<MotionStateKey, string>> = {};

  for (const key of MOTION_STATE_KEYS) {
    const value = params[key]?.trim();
    if (value) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function nonDefaultMotionTransforms(
  target: OscAdapterTarget,
  params: Partial<Record<MotionStateKey, string>>,
  transforms: Record<MotionStateKey, ValueTransform>,
): Partial<Record<MotionStateKey, ValueTransform>> | undefined {
  const defaults = profileToTransforms(getDefaultProfile(target));
  const result: Partial<Record<MotionStateKey, ValueTransform>> = {};

  for (const key of Object.keys(params) as MotionStateKey[]) {
    const current = transforms[key] ?? "identity";
    const fallback = defaults[key] ?? "identity";
    if (current !== fallback) {
      result[key] = current;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function exportCustomMappingsYaml(
  customParams: Record<string, string>,
  customTransforms: Record<string, ValueTransform>,
): Record<string, CustomMappingEntryYaml> | undefined {
  const result: Record<string, CustomMappingEntryYaml> = {};

  for (const [key, param] of Object.entries(customParams)) {
    const trimmed = param.trim();
    if (!trimmed) {
      continue;
    }

    const entry: CustomMappingEntryYaml = { param: trimmed };
    const transform = customTransforms[key];
    if (transform && transform !== "identity") {
      entry.transform = transform;
    }
    result[key] = entry;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function studioOscMapperToYamlForTarget(
  target: OscAdapterTarget,
  model: StudioOscMapperModel,
): OscAdapterYamlConfig {
  const params = sparseMotionParams(model.params);
  const yaml: OscAdapterYamlConfig = {
    enabled: model.enabled,
    host: model.host,
    port: model.port,
  };

  if (params) {
    yaml.params = params;
    const transforms = nonDefaultMotionTransforms(target, params, model.transforms);
    if (transforms) {
      yaml.transforms = transforms;
    }
  }

  const custom = exportCustomMappingsYaml(model.customParams, model.customTransforms);
  if (custom) {
    yaml.custom = custom;
  }

  return yaml;
}

function parseMotionStateKey(rawKey: string, path: string): MotionStateKey {
  const migrated = migrateLegacyMotionKey(rawKey);
  if (!MOTION_STATE_KEYS.includes(migrated.key as MotionStateKey)) {
    throw new Error(`${path}: unknown MotionState key "${rawKey}".`);
  }
  return migrated.key as MotionStateKey;
}

function parseTransformValue(value: unknown, path: string): ValueTransform {
  if (typeof value !== "string" || !VALUE_TRANSFORMS.has(value as ValueTransform)) {
    throw new Error(`${path}: transform must be one of identity, centered, invert.`);
  }
  return value as ValueTransform;
}

export function parseOscAdapterYamlConfig(
  _target: OscAdapterTarget,
  raw: unknown,
  path: string,
): OscAdapterYamlConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!raw || typeof raw !== "object") {
    throw new Error(`${path} must be an object.`);
  }

  const value = raw as Record<string, unknown>;
  const config: OscAdapterYamlConfig = {};

  if (value.enabled !== undefined) {
    if (typeof value.enabled !== "boolean") {
      throw new Error(`${path}.enabled must be a boolean.`);
    }
    config.enabled = value.enabled;
  }

  if (value.host !== undefined) {
    if (typeof value.host !== "string" || value.host.trim().length === 0) {
      throw new Error(`${path}.host must be a non-empty string.`);
    }
    config.host = value.host.trim();
  }

  if (value.port !== undefined) {
    if (typeof value.port !== "number" || !Number.isFinite(value.port)) {
      throw new Error(`${path}.port must be a number.`);
    }
    config.port = value.port;
  }

  if (value.params !== undefined) {
    if (!value.params || typeof value.params !== "object") {
      throw new Error(`${path}.params must be an object.`);
    }

    const params: Partial<Record<MotionStateKey, string>> = {};
    for (const [rawKey, paramValue] of Object.entries(
      value.params as Record<string, unknown>,
    )) {
      if (typeof paramValue !== "string") {
        throw new Error(`${path}.params.${rawKey} must be a string.`);
      }
      const trimmed = paramValue.trim();
      if (!trimmed) {
        continue;
      }
      params[parseMotionStateKey(rawKey, `${path}.params`)] = trimmed;
    }

    if (Object.keys(params).length > 0) {
      config.params = params;
    }
  }

  if (value.transforms !== undefined) {
    if (!value.transforms || typeof value.transforms !== "object") {
      throw new Error(`${path}.transforms must be an object.`);
    }

    const transforms: Partial<Record<MotionStateKey, ValueTransform>> = {};
    for (const [rawKey, transformValue] of Object.entries(
      value.transforms as Record<string, unknown>,
    )) {
      const key = parseMotionStateKey(rawKey, `${path}.transforms`);
      if (!config.params?.[key]) {
        continue;
      }
      transforms[key] = parseTransformValue(
        transformValue,
        `${path}.transforms.${rawKey}`,
      );
    }

    if (Object.keys(transforms).length > 0) {
      config.transforms = transforms;
    }
  }

  if (value.custom !== undefined) {
    if (!value.custom || typeof value.custom !== "object") {
      throw new Error(`${path}.custom must be an object.`);
    }

    const custom: Record<string, CustomMappingEntryYaml> = {};
    for (const [customKey, entryValue] of Object.entries(
      value.custom as Record<string, unknown>,
    )) {
      if (!entryValue || typeof entryValue !== "object") {
        throw new Error(`${path}.custom.${customKey} must be an object.`);
      }

      const entry = entryValue as Record<string, unknown>;
      if (typeof entry.param !== "string" || entry.param.trim().length === 0) {
        throw new Error(
          `${path}.custom.${customKey}.param must be a non-empty string.`,
        );
      }

      const parsed: CustomMappingEntryYaml = { param: entry.param.trim() };
      if (entry.transform !== undefined) {
        parsed.transform = parseTransformValue(
          entry.transform,
          `${path}.custom.${customKey}.transform`,
        );
      }
      custom[customKey] = parsed;
    }

    if (Object.keys(custom).length > 0) {
      config.custom = custom;
    }
  }

  return config;
}

export function oscAdapterYamlToLaunchConfig(
  yaml: OscAdapterYamlConfig | undefined,
): OscAdapterLaunchConfig | undefined {
  if (!yaml) {
    return undefined;
  }

  return {
    enabled: yaml.enabled,
    host: yaml.host,
    port: yaml.port,
    params: yaml.params,
    transforms: yaml.transforms,
    custom: yaml.custom,
  };
}
