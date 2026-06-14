import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import {
  getDefaultProfile,
  profileToParamNames,
  profileToTransforms,
  rebuildProfile,
  type ModelTarget,
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";

export type MapperTarget = Exclude<ModelTarget, "custom">;

export interface ModelMapperConfig {
  enabled: boolean;
  host: string;
  port: number;
  params: Record<MotionStateKey, string>;
  transforms: Record<MotionStateKey, ValueTransform>;
  /** MotionState.custom keys → OSC parameter names */
  customParams: Record<string, string>;
  customTransforms: Record<string, ValueTransform>;
}

export interface MotionMapperEditorConfig {
  vmc: ModelMapperConfig;
  live2d: ModelMapperConfig;
  vrm: ModelMapperConfig;
  loggerEnabled: boolean;
  loggerThrottleMs: number;
}

const TARGETS: MapperTarget[] = ["vmc", "live2d", "vrm"];

function createModelConfig(target: MapperTarget): ModelMapperConfig {
  const profile = getDefaultProfile(target);
  return {
    enabled: target === "vmc",
    host: "127.0.0.1",
    port: 39539,
    params: profileToParamNames(profile),
    transforms: profileToTransforms(profile),
    customParams: {},
    customTransforms: {},
  };
}

export const DEFAULT_MAPPER_CONFIG: MotionMapperEditorConfig = {
  vmc: createModelConfig("vmc"),
  live2d: createModelConfig("live2d"),
  vrm: createModelConfig("vrm"),
  loggerEnabled: true,
  loggerThrottleMs: 5000,
};

export function toMotionMapperProfile(
  target: MapperTarget,
  config: ModelMapperConfig,
): MotionMapperProfile {
  return rebuildProfile(
    `${target}-studio`,
    target,
    target.toUpperCase(),
    config.params,
    config.transforms,
  );
}

export function resetModelConfig(target: MapperTarget): ModelMapperConfig {
  return createModelConfig(target);
}

export function getMapperTargets(): MapperTarget[] {
  return TARGETS;
}

export function cloneMapperConfig(
  config: MotionMapperEditorConfig,
): MotionMapperEditorConfig {
  return {
    vmc: {
      ...config.vmc,
      params: { ...config.vmc.params },
      transforms: { ...config.vmc.transforms },
      customParams: { ...(config.vmc.customParams ?? {}) },
      customTransforms: { ...(config.vmc.customTransforms ?? {}) },
    },
    live2d: {
      ...config.live2d,
      params: { ...config.live2d.params },
      transforms: { ...config.live2d.transforms },
      customParams: { ...(config.live2d.customParams ?? {}) },
      customTransforms: { ...(config.live2d.customTransforms ?? {}) },
    },
    vrm: {
      ...config.vrm,
      params: { ...config.vrm.params },
      transforms: { ...config.vrm.transforms },
      customParams: { ...(config.vrm.customParams ?? {}) },
      customTransforms: { ...(config.vrm.customTransforms ?? {}) },
    },
    loggerEnabled: config.loggerEnabled,
    loggerThrottleMs: config.loggerThrottleMs,
  };
}

export function exportModelProfile(
  target: MapperTarget,
  config: ModelMapperConfig,
): string {
  const profile = toMotionMapperProfile(target, config);
  return JSON.stringify(
    {
      target,
      host: config.host,
      port: config.port,
      profile,
    },
    null,
    2,
  );
}

export function emptyParamRecord(): Record<MotionStateKey, string> {
  return Object.fromEntries(MOTION_STATE_KEYS.map((key) => [key, ""])) as Record<
    MotionStateKey,
    string
  >;
}

export function pruneUnusedCustomMappings(
  config: MotionMapperEditorConfig,
  activeCustomKeys: readonly string[],
): MotionMapperEditorConfig {
  const allowed = new Set(activeCustomKeys);

  const pruneModel = (model: ModelMapperConfig): ModelMapperConfig => {
    const customParams: Record<string, string> = {};
    const customTransforms: Record<string, ValueTransform> = {};

    for (const [key, value] of Object.entries(model.customParams ?? {})) {
      if (allowed.has(key)) {
        customParams[key] = value;
      }
    }

    for (const [key, value] of Object.entries(model.customTransforms ?? {})) {
      if (allowed.has(key)) {
        customTransforms[key] = value;
      }
    }

    return { ...model, customParams, customTransforms };
  };

  return {
    ...config,
    vmc: pruneModel(config.vmc),
    live2d: pruneModel(config.live2d),
    vrm: pruneModel(config.vrm),
  };
}
