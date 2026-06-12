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
    },
    live2d: {
      ...config.live2d,
      params: { ...config.live2d.params },
      transforms: { ...config.live2d.transforms },
    },
    vrm: {
      ...config.vrm,
      params: { ...config.vrm.params },
      transforms: { ...config.vrm.transforms },
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
