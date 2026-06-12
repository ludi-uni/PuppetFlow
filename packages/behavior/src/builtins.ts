import { clamp01, type MotionState, type MotionStateKey } from "@puppetflow/core";
import type { StateStore } from "@puppetflow/core";
import type { BehaviorBuiltin } from "./ast.js";

export interface BuiltinStateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

export interface BuiltinContext {
  state: StateStore;
  renderedMotion: MotionState;
  deltaTime: number;
  states: BuiltinStateStore;
  instanceKey: string;
}

function readNumberState(state: StateStore, key: string, fallback = 0.5): number {
  const value = state.get(key);
  return typeof value === "number" ? value : fallback;
}

function runGaze(
  ctx: BuiltinContext,
  config: Record<string, unknown>,
): Partial<MotionState> {
  const wanderAmplitude = Number(config.wanderAmplitude ?? 0.05);
  const speed = Number(config.speed ?? 0.35);
  const phase =
    (ctx.states.get<number>(`${ctx.instanceKey}:phase`) ?? 0) + speed * ctx.deltaTime;
  ctx.states.set(`${ctx.instanceKey}:phase`, phase);

  const lookX = 0.5 + Math.sin(phase) * wanderAmplitude;
  const lookY = 0.5 + Math.cos(phase * 0.7) * wanderAmplitude * 0.6;

  return {
    lookX: clamp01(lookX),
    lookY: clamp01(lookY),
  };
}

function runBlink(
  ctx: BuiltinContext,
  config: Record<string, unknown>,
): Partial<MotionState> {
  const minInterval = Number(config.minInterval ?? 3);
  const maxInterval = Number(config.maxInterval ?? 8);
  const closeDuration = Number(config.closeDuration ?? 0.12);
  const now = Date.now() / 1000;

  let nextBlinkAt = ctx.states.get<number>(`${ctx.instanceKey}:nextBlinkAt`);
  let blinkUntil = ctx.states.get<number>(`${ctx.instanceKey}:blinkUntil`) ?? 0;

  if (nextBlinkAt === undefined) {
    nextBlinkAt = now + minInterval + Math.random() * (maxInterval - minInterval);
    ctx.states.set(`${ctx.instanceKey}:nextBlinkAt`, nextBlinkAt);
  }

  if (now >= nextBlinkAt && blinkUntil === 0) {
    blinkUntil = now + closeDuration;
    ctx.states.set(`${ctx.instanceKey}:blinkUntil`, blinkUntil);
    const interval = minInterval + Math.random() * (maxInterval - minInterval);
    ctx.states.set(`${ctx.instanceKey}:nextBlinkAt`, now + interval);
  }

  if (blinkUntil > now) {
    const progress = 1 - (blinkUntil - now) / closeDuration;
    const closeAmount = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    return { facePitch: clamp01(0.5 - closeAmount * 0.15) };
  }

  ctx.states.set(`${ctx.instanceKey}:blinkUntil`, 0);
  return {};
}

function runIdle(
  ctx: BuiltinContext,
  config: Record<string, unknown>,
): Partial<MotionState> {
  const interestThreshold = Number(config.interestThreshold ?? 0.35);
  const wanderBoost = Number(config.wanderBoost ?? 0.12);
  const interest = readNumberState(ctx.state, "interest");

  if (interest >= interestThreshold) {
    ctx.states.set(`${ctx.instanceKey}:idleTime`, 0);
    return {};
  }

  const idleTime =
    (ctx.states.get<number>(`${ctx.instanceKey}:idleTime`) ?? 0) + ctx.deltaTime;
  ctx.states.set(`${ctx.instanceKey}:idleTime`, idleTime);

  const boost = Math.min(wanderBoost, idleTime * 0.01);
  const lookX = 0.5 + Math.sin(idleTime * 0.8) * boost;
  const lookY = 0.5 + Math.cos(idleTime * 0.5) * boost * 0.7;

  return {
    lookX: clamp01(lookX),
    lookY: clamp01(lookY),
  };
}

function runAttention(
  ctx: BuiltinContext,
  config: Record<string, unknown>,
): Partial<MotionState> {
  const leanGain = Number(config.leanGain ?? 0.2);
  const tiltGain = Number(config.tiltGain ?? 0.1);
  const interest = ctx.state.get("interest");

  if (typeof interest !== "number") {
    return {};
  }

  return {
    bodyLean: clamp01(interest * leanGain),
    headTilt: clamp01(0.5 + (interest - 0.5) * tiltGain),
  };
}

function runEmotion(
  ctx: BuiltinContext,
  config: Record<string, unknown>,
): Partial<MotionState> {
  const joySmileGain = Number(config.joySmileGain ?? 0.7);
  const sadnessBrowGain = Number(config.sadnessBrowGain ?? 0.5);
  const angerBrowGain = Number(config.angerBrowGain ?? 0.6);
  const output: Partial<MotionState> = {};

  const joy = ctx.state.get("joy");
  if (typeof joy === "number") {
    output.mouthX = clamp01(joy * joySmileGain);
  }

  const sadness = ctx.state.get("sadness");
  if (typeof sadness === "number") {
    output.facePitch = clamp01(0.5 - sadness * sadnessBrowGain * 0.2);
  }

  const anger = ctx.state.get("anger");
  if (typeof anger === "number") {
    output.facePitch = clamp01(0.5 - anger * angerBrowGain * 0.2);
  }

  return output;
}

export function executeBuiltin(
  node: BehaviorBuiltin,
  ctx: BuiltinContext,
): Partial<MotionState> {
  const config = node.config ?? {};

  switch (node.id) {
    case "gaze":
      return runGaze(ctx, config);
    case "blink":
      return runBlink(ctx, config);
    case "idle":
      return runIdle(ctx, config);
    case "attention":
      return runAttention(ctx, config);
    case "emotion":
      return runEmotion(ctx, config);
    default:
      return {};
  }
}

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
