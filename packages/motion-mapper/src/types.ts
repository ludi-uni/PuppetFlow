import type { MotionStateKey } from "@puppetflow/core";

export type ModelTarget = "vmc" | "live2d" | "vrm" | "custom";

export type ValueTransform = "identity" | "centered" | "invert";

export interface MappingRule {
  param: string;
  transform: ValueTransform;
}

export interface MotionMapperProfile {
  id: string;
  target: ModelTarget;
  label: string;
  rules: Partial<Record<MotionStateKey, MappingRule>>;
}

export type MappedMotion = Record<string, number>;

export type ParamNameMapping = Partial<Record<MotionStateKey, string>>;
