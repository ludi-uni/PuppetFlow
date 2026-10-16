import {
  cloneMotionFrame,
  normalizeMotionFrame,
  type BoneTransform,
  type MotionFrame,
} from "@puppetflow/core";
import { applyRetarget } from "@puppetflow/motion-pipeline";

import type { DecodedVmcEvent } from "./osc-decoder.js";
import type { VmcInputProfile } from "./profiles.js";

export interface VmcFrameState {
  bones: Record<string, BoneTransform>;
  blendShapes: Record<string, number>;
}

export function createVmcFrameState(): VmcFrameState {
  return { bones: {}, blendShapes: {} };
}

export function applyVmcEvents(
  state: VmcFrameState,
  events: readonly DecodedVmcEvent[],
  profile: VmcInputProfile,
  timestamp: number,
): MotionFrame | undefined {
  const next: VmcFrameState = {
    bones: cloneBones(state.bones),
    blendShapes: { ...state.blendShapes },
  };
  let changed = false;
  for (const event of events) {
    if (event.kind === "bone") {
      next.bones[event.name] = scaleTransform(event.transform, profile.positionScale);
      changed = true;
    } else if (event.kind === "root") {
      if (profile.rootPolicy === "preserve") {
        next.bones.Root = scaleTransform(event.transform, profile.positionScale);
        changed = true;
      }
    } else if (event.kind === "blend") {
      next.blendShapes[event.name] = event.value;
      changed = true;
    }
  }

  if (!changed) {
    return undefined;
  }

  const frame = normalizeMotionFrame({
    timestamp,
    bones: next.bones,
    blendShapes: next.blendShapes,
    metadata: {
      sourceType: "vmc",
      coordinateSpace: "local",
      inputProfile: profile.id,
    },
  });
  const result = profile.retarget
    ? normalizeMotionFrame(applyRetarget(frame, profile.retarget))
    : frame;
  Object.assign(state.bones, next.bones);
  Object.assign(state.blendShapes, next.blendShapes);
  return result;
}

function scaleTransform(transform: BoneTransform, scale: number): BoneTransform {
  const frame = cloneMotionFrame({ timestamp: 0, bones: { bone: transform } });
  const result = frame.bones!.bone!;
  if (result.position && scale !== 1) {
    result.position = {
      x: result.position.x * scale,
      y: result.position.y * scale,
      z: result.position.z * scale,
    };
  }
  return result;
}

function cloneBones(
  bones: Record<string, BoneTransform>,
): Record<string, BoneTransform> {
  return cloneMotionFrame({ timestamp: 0, bones }).bones ?? {};
}
