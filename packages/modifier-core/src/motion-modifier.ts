import type { MotionState } from "@puppetflow/core";

export interface MotionModifier {
  readonly id: string;
  apply(current: MotionState, target: MotionState, deltaTime: number): MotionState;
}

export const DEFAULT_MODIFIER_ORDER = ["breath", "noise", "smoothing"] as const;

export type ModifierId = (typeof DEFAULT_MODIFIER_ORDER)[number];

export function applyModifierChain(
  current: MotionState,
  target: MotionState,
  modifiers: MotionModifier[],
  order: readonly string[],
  deltaTime: number,
): MotionState {
  const modifierMap = new Map(modifiers.map((modifier) => [modifier.id, modifier]));
  let result = { ...target };

  for (const id of order) {
    const modifier = modifierMap.get(id);
    if (!modifier) {
      continue;
    }

    result = modifier.apply(current, result, deltaTime);
    current = result;
  }

  return result;
}
