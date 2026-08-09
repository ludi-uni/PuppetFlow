import type { BoneId, MotionFrame, Quaternion, Vec3 } from "@puppetflow/core";
import type { MotionSourcePolicyOverride } from "@puppetflow/motion-graph";

export interface MotionFrameInput {
  sourceId: string;
  frame: MotionFrame;
}

export interface MotionLayer {
  source: string;
  priority: number;
  weight?: number;
  bones?: readonly BoneId[];
  blendShapes?: readonly string[];
  parameters?: readonly string[];
}

export type MotionLayerPolicy = Readonly<Record<string, MotionSourcePolicyOverride>>;

export interface MotionChannelOwner {
  sourceId: string;
  priority: number;
  weight: number;
}

export interface MotionMixerInspection {
  bones: Record<string, MotionChannelOwner[]>;
  blendShapes: Record<string, MotionChannelOwner[]>;
  parameters: Record<string, MotionChannelOwner[]>;
}

export interface MotionFrameFilter {
  readonly id: string;
  apply(frame: MotionFrame, deltaTime: number): MotionFrame;
  reset(): void;
}

export interface MotionMixer {
  mix(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionFrame | undefined;
  inspect?(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionMixerInspection;
}

export interface MotionRetargetBoneConfig {
  rotationOffset?: Quaternion;
  positionOffset?: Vec3;
  scale?: number;
}

export interface MotionRetargetProfile {
  mapping?: Readonly<Record<BoneId, BoneId>>;
  bones?: Readonly<Record<BoneId, MotionRetargetBoneConfig>>;
}

export interface MotionFramePipeline {
  process(
    inputs: readonly MotionFrameInput[],
    deltaTime: number,
    policy?: MotionLayerPolicy,
  ): MotionFrame | undefined;
  reset(): void;
  inspect?(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionMixerInspection | undefined;
}
