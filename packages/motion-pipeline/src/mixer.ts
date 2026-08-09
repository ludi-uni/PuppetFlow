import type { BoneTransform, MotionFrame, Quaternion, Vec3 } from "@puppetflow/core";

import { negateQuaternion, normalizeQuaternion, quaternionDot } from "./quaternion.js";
import type {
  MotionChannelOwner,
  MotionFrameInput,
  MotionLayer,
  MotionLayerPolicy,
  MotionMixer,
  MotionMixerInspection,
} from "./types.js";

interface Candidate<T> {
  value: T;
  priority: number;
  weight: number;
}

const DEFAULT_LAYER: MotionLayer = { source: "", priority: 0, weight: 1 };

export function createMotionMixer(layers: readonly MotionLayer[] = []): MotionMixer {
  const layerMap = new Map<string, MotionLayer>();
  for (const layer of layers) {
    validateLayer(layer);
    layerMap.set(layer.source, { ...layer });
  }

  return {
    mix(inputs, policy) {
      return mixFrames(applySourcePolicy(inputs, policy), layerMap, policy);
    },
    inspect(inputs, policy) {
      return inspectFrames(applySourcePolicy(inputs, policy), layerMap, policy);
    },
  };
}

function inspectFrames(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): MotionMixerInspection {
  return {
    bones: inspectBones(inputs, layerMap, policy),
    blendShapes: inspectNumericDomain(inputs, layerMap, "blendShapes", policy),
    parameters: inspectNumericDomain(inputs, layerMap, "parameters", policy),
  };
}

function inspectBones(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): Record<string, MotionChannelOwner[]> {
  const boneIds = new Set<string>();
  for (const { frame } of inputs) {
    for (const boneId of Object.keys(frame.bones ?? {})) {
      boneIds.add(boneId);
    }
  }

  const result: Record<string, MotionChannelOwner[]> = {};
  for (const boneId of boneIds) {
    const candidates = inputs
      .map(({ sourceId, frame }) => ({
        sourceId,
        layer: resolveLayer(sourceId, layerMap, policy),
        transform: frame.bones?.[boneId],
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          sourceId: string;
          layer: MotionLayer;
          transform: NonNullable<typeof candidate.transform>;
        } => candidate.transform !== undefined,
      )
      .filter(({ layer }) => isAllowed(layer.bones, boneId));
    const owners = inspectCandidates(
      candidates.map(({ sourceId, layer }) => ({ sourceId, layer })),
    );
    if (owners.length > 0) {
      result[boneId] = owners;
    }
  }
  return result;
}

function inspectNumericDomain(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  domain: "blendShapes" | "parameters",
  policy: MotionLayerPolicy | undefined,
): Record<string, MotionChannelOwner[]> {
  const keys = new Set<string>();
  for (const { frame } of inputs) {
    for (const key of Object.keys(frame[domain] ?? {})) {
      keys.add(key);
    }
  }

  const result: Record<string, MotionChannelOwner[]> = {};
  for (const key of keys) {
    const candidates = inputs
      .map(({ sourceId, frame }) => ({
        sourceId,
        layer: resolveLayer(sourceId, layerMap, policy),
        value: frame[domain]?.[key],
      }))
      .filter(({ value }) => value !== undefined)
      .filter(({ layer }) => isAllowed(layer[domain], key));
    const owners = inspectCandidates(
      candidates.map(({ sourceId, layer }) => ({ sourceId, layer })),
    );
    if (owners.length > 0) {
      result[key] = owners;
    }
  }
  return result;
}

function inspectCandidates(
  candidates: readonly { sourceId: string; layer: MotionLayer }[],
): MotionChannelOwner[] {
  const eligible = candidates
    .map(({ sourceId, layer }) => ({
      sourceId,
      priority: layer.priority,
      weight: layer.weight ?? 1,
    }))
    .filter(({ weight }) => weight > 0);
  if (eligible.length === 0) {
    return [];
  }

  const highestPriority = Math.max(...eligible.map(({ priority }) => priority));
  return eligible.filter(({ priority }) => priority === highestPriority);
}

function mixFrames(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): MotionFrame | undefined {
  if (inputs.length === 0) {
    return undefined;
  }

  const bones = mixBones(inputs, layerMap, policy);
  const blendShapes = mixNumericDomain(inputs, layerMap, "blendShapes", policy);
  const parameters = mixNumericDomain(inputs, layerMap, "parameters", policy);
  const sequences = inputs
    .map(({ frame }) => frame.sequence)
    .filter((sequence): sequence is number => sequence !== undefined);
  const sourceIds = inputs.map(({ sourceId }) => sourceId);

  return {
    timestamp: Math.max(...inputs.map(({ frame }) => frame.timestamp)),
    ...(sequences.length > 0 ? { sequence: Math.max(...sequences) } : {}),
    ...(Object.keys(bones).length > 0 ? { bones } : {}),
    ...(Object.keys(blendShapes).length > 0 ? { blendShapes } : {}),
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    metadata: {
      sourceType: "mixer",
      sourceIds,
    },
  };
}

function mixBones(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): Record<string, BoneTransform> {
  const boneIds = new Set<string>();
  for (const { frame } of inputs) {
    for (const boneId of Object.keys(frame.bones ?? {})) {
      boneIds.add(boneId);
    }
  }

  const result: Record<string, BoneTransform> = {};
  for (const boneId of boneIds) {
    const transforms = inputs
      .map(({ sourceId, frame }) => {
        const transform = frame.bones?.[boneId];
        if (!transform) {
          return undefined;
        }

        return {
          layer: resolveLayer(sourceId, layerMap, policy),
          transform,
        };
      })
      .filter(
        (entry): entry is { layer: MotionLayer; transform: BoneTransform } =>
          entry !== undefined,
      );

    const transform: BoneTransform = {};
    const position = mixComponent(
      transforms.map(({ layer, transform: value }) => ({
        value: value.position,
        layer,
        allowed: isAllowed(layer.bones, boneId),
      })),
      weightedVec3,
    );
    const rotation = mixComponent(
      transforms.map(({ layer, transform: value }) => ({
        value: value.rotation,
        layer,
        allowed: isAllowed(layer.bones, boneId),
      })),
      weightedQuaternion,
    );
    const scale = mixComponent(
      transforms.map(({ layer, transform: value }) => ({
        value: value.scale,
        layer,
        allowed: isAllowed(layer.bones, boneId),
      })),
      weightedVec3,
    );
    const confidence = mixComponent(
      transforms.map(({ layer, transform: value }) => ({
        value: value.confidence,
        layer,
        allowed: isAllowed(layer.bones, boneId),
      })),
      weightedNumber,
    );

    if (position !== undefined) transform.position = position;
    if (rotation !== undefined) transform.rotation = rotation;
    if (scale !== undefined) transform.scale = scale;
    if (confidence !== undefined) transform.confidence = confidence;
    if (Object.keys(transform).length > 0) {
      result[boneId] = transform;
    }
  }

  return result;
}

function mixNumericDomain(
  inputs: readonly MotionFrameInput[],
  layerMap: ReadonlyMap<string, MotionLayer>,
  domain: "blendShapes" | "parameters",
  policy: MotionLayerPolicy | undefined,
): Record<string, number> {
  const keys = new Set<string>();
  for (const { frame } of inputs) {
    for (const key of Object.keys(frame[domain] ?? {})) {
      keys.add(key);
    }
  }

  const result: Record<string, number> = {};
  for (const key of keys) {
    const candidates = inputs.map(({ sourceId, frame }) => ({
      value: frame[domain]?.[key],
      layer: resolveLayer(sourceId, layerMap, policy),
      allowed: isAllowed(resolveLayer(sourceId, layerMap, policy)[domain], key),
    }));
    const value = mixComponent(candidates, weightedNumber);
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function mixComponent<T>(
  candidates: ReadonlyArray<{
    value: T | undefined;
    layer: MotionLayer;
    allowed: boolean;
  }>,
  blend: (candidates: readonly Candidate<T>[]) => T,
): T | undefined {
  const eligible = candidates
    .filter(({ value, allowed }) => value !== undefined && allowed)
    .map(({ value, layer }) => ({
      value: value as T,
      priority: layer.priority,
      weight: layer.weight ?? 1,
    }))
    .filter(({ weight }) => weight > 0);

  if (eligible.length === 0) {
    return undefined;
  }

  const highestPriority = Math.max(...eligible.map(({ priority }) => priority));
  const highest = eligible.filter(({ priority }) => priority === highestPriority);
  return blend(highest);
}

function weightedNumber(candidates: readonly Candidate<number>[]): number {
  return weightedAverage(candidates);
}

function weightedVec3(candidates: readonly Candidate<Vec3>[]): Vec3 {
  return {
    x: weightedAverage(
      candidates.map(({ value, priority, weight }) => ({
        value: value.x,
        priority,
        weight,
      })),
    ),
    y: weightedAverage(
      candidates.map(({ value, priority, weight }) => ({
        value: value.y,
        priority,
        weight,
      })),
    ),
    z: weightedAverage(
      candidates.map(({ value, priority, weight }) => ({
        value: value.z,
        priority,
        weight,
      })),
    ),
  };
}

function weightedQuaternion(candidates: readonly Candidate<Quaternion>[]): Quaternion {
  const first = normalizeQuaternion(candidates[0]!.value);
  let x = 0;
  let y = 0;
  let z = 0;
  let w = 0;
  for (const { value, weight } of candidates) {
    const quaternion = normalizeQuaternion(value);
    const aligned =
      quaternionDot(first, quaternion) < 0 ? negateQuaternion(quaternion) : quaternion;
    x += aligned.x * weight;
    y += aligned.y * weight;
    z += aligned.z * weight;
    w += aligned.w * weight;
  }
  return normalizeQuaternion({ x, y, z, w });
}

function weightedAverage(candidates: readonly Candidate<number>[]): number {
  const totalWeight = candidates.reduce(
    (total, candidate) => total + candidate.weight,
    0,
  );
  if (totalWeight === 0) {
    return 0;
  }
  return (
    candidates.reduce(
      (total, candidate) => total + candidate.value * candidate.weight,
      0,
    ) / totalWeight
  );
}

function resolveLayer(
  sourceId: string,
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): MotionLayer {
  const base = layerMap.get(sourceId) ?? { ...DEFAULT_LAYER, source: sourceId };
  const override = policy?.[sourceId];
  const layer = {
    ...base,
    ...(override?.priority !== undefined ? { priority: override.priority } : {}),
    ...(override?.weight !== undefined ? { weight: override.weight } : {}),
  };
  validateLayer(layer);
  return layer;
}

function applySourcePolicy(
  inputs: readonly MotionFrameInput[],
  policy: MotionLayerPolicy | undefined,
): readonly MotionFrameInput[] {
  return inputs.filter(({ sourceId }) => policy?.[sourceId]?.enabled !== false);
}

function isAllowed(mask: readonly string[] | undefined, key: string): boolean {
  return mask === undefined || mask.includes(key);
}

function validateLayer(layer: MotionLayer): void {
  if (!layer.source.trim()) {
    throw new Error("MotionLayer.source must be a non-empty string");
  }
  if (!Number.isFinite(layer.priority)) {
    throw new Error("MotionLayer.priority must be finite");
  }
  if (
    layer.weight !== undefined &&
    (!Number.isFinite(layer.weight) || layer.weight < 0 || layer.weight > 1)
  ) {
    throw new Error("MotionLayer.weight must be between 0 and 1");
  }
}
