import type { MotionMixerInspection } from "@puppetflow/motion-pipeline";

export interface MotionSourceInspectorSnapshot {
  id: string;
  connected: boolean;
  stale: boolean;
  inputRateHz: number;
  lastFrameAt?: number;
  lastFrameTimestamp?: number;
  ageMs?: number;
}

export interface MotionOutputInspectorSnapshot {
  id: string;
  connected: boolean;
  outputRateHz: number;
  lastOutputAt?: number;
  error?: string;
}

export interface MotionInspectorSnapshot {
  timestamp: number;
  running: boolean;
  sources: MotionSourceInspectorSnapshot[];
  mixer: MotionMixerInspection | undefined;
  outputs: MotionOutputInspectorSnapshot[];
}

export function calculateRateHz(
  eventTimes: readonly number[],
  currentTime: number,
  windowMs = 1000,
): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(windowMs) || windowMs <= 0) {
    return 0;
  }

  const cutoff = currentTime - windowMs;
  const count = eventTimes.filter(
    (eventTime) =>
      Number.isFinite(eventTime) && eventTime > cutoff && eventTime <= currentTime,
  ).length;
  return (count * 1000) / windowMs;
}

export function cloneMotionMixerInspection(
  inspection: MotionMixerInspection | undefined,
): MotionMixerInspection | undefined {
  if (!inspection) {
    return undefined;
  }

  return {
    bones: cloneOwnershipMap(inspection.bones),
    blendShapes: cloneOwnershipMap(inspection.blendShapes),
    parameters: cloneOwnershipMap(inspection.parameters),
  };
}

function cloneOwnershipMap(
  ownersByChannel: MotionMixerInspection["bones"],
): MotionMixerInspection["bones"] {
  return Object.fromEntries(
    Object.entries(ownersByChannel).map(([channel, owners]) => [
      channel,
      owners.map((owner) => ({ ...owner })),
    ]),
  );
}
