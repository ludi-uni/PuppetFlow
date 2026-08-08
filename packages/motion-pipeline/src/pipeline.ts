import { cloneMotionFrame, type MotionFrame } from "@puppetflow/core";

import { createMotionFilterPipeline } from "./filters.js";
import { createMotionMixer } from "./mixer.js";
import { applyRetarget } from "./retarget.js";
import type {
  MotionFrameFilter,
  MotionFramePipeline,
  MotionLayer,
  MotionMixer,
  MotionMixerInspection,
  MotionRetargetProfile,
} from "./types.js";

export interface MotionFramePipelineOptions {
  mixer?: MotionMixer;
  layers?: readonly MotionLayer[];
  sourceFilters?: Readonly<Record<string, readonly MotionFrameFilter[]>>;
  retarget?: MotionRetargetProfile;
  outputFilters?: readonly MotionFrameFilter[];
}

export function createMotionFramePipeline(
  options: MotionFramePipelineOptions = {},
): MotionFramePipeline {
  const mixer = options.mixer ?? createMotionMixer(options.layers);
  const sourceFilters = options.sourceFilters ?? {};
  const outputFilterPipeline = createMotionFilterPipeline(options.outputFilters ?? []);
  const allFilters = new Set<MotionFrameFilter>(options.outputFilters ?? []);
  for (const filters of Object.values(sourceFilters)) {
    for (const filter of filters) {
      allFilters.add(filter);
    }
  }

  return {
    process(inputs, deltaTime) {
      const filteredInputs = inputs.map((input) => ({
        sourceId: input.sourceId,
        frame: applyFilters(
          input.frame,
          sourceFilters[input.sourceId] ?? [],
          deltaTime,
        ),
      }));
      const mixed = mixer.mix(filteredInputs);
      if (!mixed) {
        return undefined;
      }

      const retargeted = options.retarget
        ? applyRetarget(mixed, options.retarget)
        : cloneMotionFrame(mixed);
      return outputFilterPipeline.apply(retargeted, deltaTime);
    },
    inspect(inputs) {
      if (!mixer.inspect) {
        return undefined;
      }

      const filteredInputs = inputs.map((input) => ({
        sourceId: input.sourceId,
        frame: applyFilters(input.frame, sourceFilters[input.sourceId] ?? [], 0),
      }));
      const inspection = mixer.inspect(filteredInputs);
      return options.retarget
        ? remapInspection(inspection, options.retarget)
        : cloneInspection(inspection);
    },
    reset() {
      for (const filter of allFilters) {
        filter.reset();
      }
    },
  };
}

function remapInspection(
  inspection: MotionMixerInspection,
  profile: MotionRetargetProfile,
): MotionMixerInspection {
  return {
    bones: remapBoneOwnership(inspection.bones, profile.mapping),
    blendShapes: cloneOwnership(inspection.blendShapes),
    parameters: cloneOwnership(inspection.parameters),
  };
}

function cloneInspection(inspection: MotionMixerInspection): MotionMixerInspection {
  return {
    bones: cloneOwnership(inspection.bones),
    blendShapes: cloneOwnership(inspection.blendShapes),
    parameters: cloneOwnership(inspection.parameters),
  };
}

function remapBoneOwnership(
  ownership: Record<string, MotionMixerInspection["bones"][string]>,
  mapping: Readonly<Record<string, string>> | undefined,
): MotionMixerInspection["bones"] {
  const result: MotionMixerInspection["bones"] = {};
  for (const [boneId, owners] of Object.entries(ownership)) {
    const targetId = mapping?.[boneId] ?? boneId;
    result[targetId] = [
      ...(result[targetId] ?? []),
      ...owners.map((owner) => ({ ...owner })),
    ];
  }
  return result;
}

function cloneOwnership(
  ownership: Record<string, MotionMixerInspection["bones"][string]>,
): MotionMixerInspection["bones"] {
  return Object.fromEntries(
    Object.entries(ownership).map(([key, owners]) => [
      key,
      owners.map((owner) => ({ ...owner })),
    ]),
  );
}

function applyFilters(
  frame: MotionFrame,
  filters: readonly MotionFrameFilter[],
  deltaTime: number,
): MotionFrame {
  return filters.reduce(
    (current, filter) => filter.apply(current, deltaTime),
    cloneMotionFrame(frame),
  );
}
