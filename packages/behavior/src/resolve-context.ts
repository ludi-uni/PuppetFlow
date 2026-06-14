import type { TimelineEvent } from "@puppetflow/core";
import type { BehaviorExecutionContext } from "./context.js";

function phonemeFromTimelineEvent(event: TimelineEvent): string | undefined {
  if (event.type !== "phoneme") {
    return undefined;
  }
  if (typeof event.value !== "object" || event.value === null) {
    return undefined;
  }
  const phoneme = (event.value as { phoneme?: unknown }).phoneme;
  return typeof phoneme === "string" ? phoneme : undefined;
}

export function resolveCurrentPhoneme(ctx: BehaviorExecutionContext): string {
  if (ctx.currentPhoneme !== undefined) {
    return ctx.currentPhoneme;
  }

  for (const key of ["phoneme", "currentPhoneme"] as const) {
    const channelValue = ctx.channels.get(key);
    if (typeof channelValue === "string") {
      return channelValue;
    }
  }

  for (const event of ctx.activeTimelineEvents ?? []) {
    const phoneme = phonemeFromTimelineEvent(event);
    if (phoneme) {
      return phoneme;
    }
  }

  return "";
}

export function resolveNumericIdentifier(
  name: string,
  ctx: BehaviorExecutionContext,
): number {
  if (name === "time") {
    return ctx.time ?? 0;
  }

  if (name === "deltaTime") {
    return ctx.deltaTime;
  }

  const channelValue = ctx.channels.get(name);
  if (channelValue !== undefined) {
    if (typeof channelValue === "number") {
      return channelValue;
    }
    if (typeof channelValue === "boolean") {
      return channelValue ? 1 : 0;
    }
    const parsed = Number(channelValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const stateValue = ctx.state.get(name);
  if (typeof stateValue === "number") {
    return stateValue;
  }
  if (typeof stateValue === "boolean") {
    return stateValue ? 1 : 0;
  }

  return 0;
}

export function resolveStringIdentifier(
  name: string,
  ctx: BehaviorExecutionContext,
): string {
  if (name === "currentPhoneme") {
    return resolveCurrentPhoneme(ctx);
  }

  const channelValue = ctx.channels.get(name);
  if (channelValue !== undefined) {
    return String(channelValue);
  }

  const stateValue = ctx.state.get(name);
  if (stateValue !== undefined) {
    return String(stateValue);
  }

  return "";
}

export function resolveActiveTimelineEventIds(
  events: readonly TimelineEvent[] | undefined,
): string[] {
  if (!events) {
    return [];
  }
  return events.map((event) => event.type);
}
