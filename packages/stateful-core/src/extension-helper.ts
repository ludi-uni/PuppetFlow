import type { FrameContext, StatefulRegistry } from "./types.js";
import type { StatefulStore } from "./store.js";

export interface StatefulExtensionContext {
  deltaTime: number;
  time: number;
  frame?: FrameContext;
  statefulStore?: StatefulStore;
  statefulRegistry?: StatefulRegistry;
}

export function extensionFrame(ctx: StatefulExtensionContext): FrameContext {
  return (
    ctx.frame ?? {
      deltaTime: ctx.deltaTime,
      frameNumber: 0,
      elapsedTime: ctx.time,
    }
  );
}

export function runStatefulNumber(
  ctx: StatefulExtensionContext,
  functionName: string,
  instanceId: string,
  config: Record<string, number | string> = {},
  input = 0,
): number | undefined {
  if (!ctx.statefulStore || !ctx.statefulRegistry) {
    return undefined;
  }

  const result = ctx.statefulStore.evaluate(
    functionName,
    instanceId,
    config,
    input,
    extensionFrame(ctx),
    ctx.statefulRegistry,
  );

  return typeof result === "boolean" ? (result ? 1 : 0) : result;
}
