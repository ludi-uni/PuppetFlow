/** Deterministic 1D noise in [0, 1) for PFScript `noise()`. */
export function pfscriptNoise(value: number): number {
  const scaled = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return scaled - Math.floor(scaled);
}

export type BuiltinFunction = (
  args: Array<number | string | boolean>,
) => number | string | boolean;

function requireNumber(value: number | string | boolean, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} requires a number`);
  }
  return value;
}

function requireCount(
  args: Array<number | string | boolean>,
  count: number,
  name: string,
): void {
  if (args.length !== count) {
    throw new Error(`${name}() expects ${count} argument(s)`);
  }
}

function argAt(
  args: Array<number | string | boolean>,
  index: number,
  name: string,
): number | string | boolean {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`${name}() missing argument at index ${index}`);
  }
  return value;
}

export const PFSCRIPT_BUILTIN_FUNCTIONS: Record<string, BuiltinFunction> = {
  abs: (args) => {
    requireCount(args, 1, "abs");
    return Math.abs(requireNumber(argAt(args, 0, "abs"), "abs"));
  },
  min: (args) => {
    requireCount(args, 2, "min");
    return Math.min(
      requireNumber(argAt(args, 0, "min"), "min"),
      requireNumber(argAt(args, 1, "min"), "min"),
    );
  },
  max: (args) => {
    requireCount(args, 2, "max");
    return Math.max(
      requireNumber(argAt(args, 0, "max"), "max"),
      requireNumber(argAt(args, 1, "max"), "max"),
    );
  },
  clamp: (args) => {
    requireCount(args, 3, "clamp");
    const value = requireNumber(argAt(args, 0, "clamp"), "clamp");
    const min = requireNumber(argAt(args, 1, "clamp"), "clamp");
    const max = requireNumber(argAt(args, 2, "clamp"), "clamp");
    return Math.min(max, Math.max(min, value));
  },
  floor: (args) => {
    requireCount(args, 1, "floor");
    return Math.floor(requireNumber(argAt(args, 0, "floor"), "floor"));
  },
  ceil: (args) => {
    requireCount(args, 1, "ceil");
    return Math.ceil(requireNumber(argAt(args, 0, "ceil"), "ceil"));
  },
  round: (args) => {
    requireCount(args, 1, "round");
    return Math.round(requireNumber(argAt(args, 0, "round"), "round"));
  },
  lerp: (args) => {
    requireCount(args, 3, "lerp");
    const from = requireNumber(argAt(args, 0, "lerp"), "lerp");
    const to = requireNumber(argAt(args, 1, "lerp"), "lerp");
    const t = requireNumber(argAt(args, 2, "lerp"), "lerp");
    return from + (to - from) * t;
  },
  sin: (args) => {
    requireCount(args, 1, "sin");
    return Math.sin(requireNumber(argAt(args, 0, "sin"), "sin"));
  },
  cos: (args) => {
    requireCount(args, 1, "cos");
    return Math.cos(requireNumber(argAt(args, 0, "cos"), "cos"));
  },
  tan: (args) => {
    requireCount(args, 1, "tan");
    return Math.tan(requireNumber(argAt(args, 0, "tan"), "tan"));
  },
  noise: (args) => {
    requireCount(args, 1, "noise");
    return pfscriptNoise(requireNumber(argAt(args, 0, "noise"), "noise"));
  },
};

export function callBuiltinFunction(
  name: string,
  args: Array<number | string | boolean>,
): number | string | boolean {
  const builtin = PFSCRIPT_BUILTIN_FUNCTIONS[name];
  if (!builtin) {
    throw new Error(`unknown function: ${name}()`);
  }
  return builtin(args);
}
