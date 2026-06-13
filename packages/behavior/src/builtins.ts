import { clamp01, type MotionState, type MotionStateKey } from "@puppetflow/core";

export function applyAssign(
  output: Partial<MotionState>,
  key: MotionStateKey,
  op: "set" | "add",
  value: number,
): Partial<MotionState> {
  const current = output[key] ?? 0;
  const next = op === "add" ? current + value : value;
  return { ...output, [key]: clamp01(next) };
}
