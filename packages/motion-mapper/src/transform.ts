import type { ValueTransform } from "./types.js";

export function applyTransform(transform: ValueTransform, value: number): number {
  switch (transform) {
    case "centered":
      return value * 2 - 1;
    case "invert":
      return 1 - value;
    case "identity":
    default:
      return value;
  }
}
