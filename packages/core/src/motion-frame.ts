export type BoneId = string;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BoneTransform {
  position?: Vec3;
  rotation?: Quaternion;
  scale?: Vec3;
  confidence?: number;
}

export interface MotionMetadata {
  sourceId?: string;
  sourceType?: string;
  coordinateSpace?: "local" | "world";
  clock?: "relative" | "monotonic" | "unix";
  [key: string]: unknown;
}

export interface MotionFrame {
  timestamp: number;
  sequence?: number;
  bones?: Record<BoneId, BoneTransform>;
  blendShapes?: Record<string, number>;
  parameters?: Record<string, number>;
  metadata?: MotionMetadata;
}

export function normalizeMotionFrame(value: unknown): MotionFrame {
  const record = asRecord(value, "MotionFrame");
  const timestamp = readFiniteNumber(record.timestamp, "timestamp");
  if (timestamp < 0) {
    throw new Error("MotionFrame.timestamp must be non-negative");
  }

  const sequence = record.sequence;
  if (
    sequence !== undefined &&
    (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0)
  ) {
    throw new Error("MotionFrame.sequence must be a non-negative integer");
  }

  return {
    timestamp,
    ...(sequence === undefined ? {} : { sequence }),
    ...(record.bones === undefined ? {} : { bones: normalizeBones(record.bones) }),
    ...(record.blendShapes === undefined
      ? {}
      : { blendShapes: normalizeNumericRecord(record.blendShapes, "blendShapes") }),
    ...(record.parameters === undefined
      ? {}
      : { parameters: normalizeNumericRecord(record.parameters, "parameters") }),
    ...(record.metadata === undefined
      ? {}
      : { metadata: normalizeMetadata(record.metadata) }),
  };
}

export function cloneMotionFrame(frame: MotionFrame): MotionFrame {
  return {
    timestamp: frame.timestamp,
    ...(frame.sequence === undefined ? {} : { sequence: frame.sequence }),
    ...(frame.bones === undefined
      ? {}
      : {
          bones: Object.fromEntries(
            Object.entries(frame.bones).map(([boneId, transform]) => [
              boneId,
              cloneBoneTransform(transform),
            ]),
          ),
        }),
    ...(frame.blendShapes === undefined
      ? {}
      : { blendShapes: { ...frame.blendShapes } }),
    ...(frame.parameters === undefined ? {} : { parameters: { ...frame.parameters } }),
    ...(frame.metadata === undefined ? {} : { metadata: { ...frame.metadata } }),
  };
}

function normalizeBones(value: unknown): Record<BoneId, BoneTransform> {
  const record = asRecord(value, "MotionFrame.bones");
  return Object.fromEntries(
    Object.entries(record).map(([boneId, value]) => [
      boneId,
      normalizeBoneTransform(value, `MotionFrame.bones.${boneId}`),
    ]),
  );
}

function normalizeBoneTransform(value: unknown, path: string): BoneTransform {
  const record = asRecord(value, path);
  const transform: BoneTransform = {};

  if (record.position !== undefined) {
    transform.position = normalizeVec3(record.position, `${path}.position`);
  }
  if (record.rotation !== undefined) {
    transform.rotation = normalizeQuaternion(record.rotation, `${path}.rotation`);
  }
  if (record.scale !== undefined) {
    transform.scale = normalizeVec3(record.scale, `${path}.scale`);
  }
  if (record.confidence !== undefined) {
    transform.confidence = readFiniteNumber(record.confidence, `${path}.confidence`);
  }

  return transform;
}

function normalizeVec3(value: unknown, path: string): Vec3 {
  const record = asRecord(value, path);
  return {
    x: readFiniteNumber(record.x, `${path}.x`),
    y: readFiniteNumber(record.y, `${path}.y`),
    z: readFiniteNumber(record.z, `${path}.z`),
  };
}

function normalizeQuaternion(value: unknown, path: string): Quaternion {
  const record = asRecord(value, path);
  return {
    x: readFiniteNumber(record.x, `${path}.x`),
    y: readFiniteNumber(record.y, `${path}.y`),
    z: readFiniteNumber(record.z, `${path}.z`),
    w: readFiniteNumber(record.w, `${path}.w`),
  };
}

function normalizeNumericRecord(value: unknown, path: string): Record<string, number> {
  const record = asRecord(value, `MotionFrame.${path}`);
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      readFiniteNumber(value, `MotionFrame.${path}.${key}`),
    ]),
  );
}

function normalizeMetadata(value: unknown): MotionMetadata {
  const record = asRecord(value, "MotionFrame.metadata");
  return { ...record };
}

function cloneBoneTransform(transform: BoneTransform): BoneTransform {
  return {
    ...(transform.position === undefined
      ? {}
      : { position: { ...transform.position } }),
    ...(transform.rotation === undefined
      ? {}
      : { rotation: { ...transform.rotation } }),
    ...(transform.scale === undefined ? {} : { scale: { ...transform.scale } }),
    ...(transform.confidence === undefined ? {} : { confidence: transform.confidence }),
  };
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}
