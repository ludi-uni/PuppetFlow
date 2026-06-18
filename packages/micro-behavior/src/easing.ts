/** Ease-in-out cubic — linear interpolation is intentionally not exposed. */

export function easeInOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function interpolateEaseInOut(from: number, to: number, t: number): number {
  return from + (to - from) * easeInOutCubic(t);
}
