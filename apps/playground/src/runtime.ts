import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { TauriVmcAdapter } from "@puppetflow/adapter-vmc";
import type { MotionState, StateValue } from "@puppetflow/core";
import { loadPreset } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { HttpSource } from "@puppetflow/source-http";
import curiousPreset from "@puppetflow/behavior-packs/presets/Curious.pfpreset?raw";
import focusedPreset from "@puppetflow/behavior-packs/presets/Focused.pfpreset?raw";
import happyPreset from "@puppetflow/behavior-packs/presets/Happy.pfpreset?raw";
import idlePreset from "@puppetflow/behavior-packs/presets/Idle.pfpreset?raw";
import sleepyPreset from "@puppetflow/behavior-packs/presets/Sleepy.pfpreset?raw";
import thinkingPreset from "@puppetflow/behavior-packs/presets/Thinking.pfpreset?raw";

const PRESETS = {
  Curious: curiousPreset,
  Happy: happyPreset,
  Idle: idlePreset,
  Thinking: thinkingPreset,
  Sleepy: sleepyPreset,
  Focused: focusedPreset,
} as const;

export type PresetName = keyof typeof PRESETS;

class StaleRuntimeStartup extends Error {
  override readonly name = "StaleRuntimeStartup";
}

let runtime: PuppetFlowRuntime | null = null;
let startupGeneration = 0;
let startupPromise: Promise<PuppetFlowRuntime> | null = null;
let currentPreset: PresetName = "Curious";
let httpSourceUrl: string | null = null;

const motionListenerSet = new Set<(motion: MotionState) => void>();
const motionListenerUnsubs = new Map<(motion: MotionState) => void, () => void>();

const pipelineListenerSet = new Set<
  (update: { target: MotionState; rendered: MotionState }) => void
>();
const pipelineListenerUnsubs = new Map<
  (update: { target: MotionState; rendered: MotionState }) => void,
  () => void
>();

export function getRuntime(): PuppetFlowRuntime {
  if (!runtime) {
    throw new Error("Runtime is not ready yet. Call ensureRuntime() first.");
  }

  return runtime;
}

function buildRuntime(presetName: PresetName): PuppetFlowRuntime {
  const loaded = loadPreset(PRESETS[presetName]);
  const instance = new PuppetFlowRuntime()
    .loadPreset(loaded)
    .attachAdapter(new TauriVmcAdapter())
    .attachAdapter(new LoggerAdapter({ label: "Playground", throttleMs: 3000 }));

  if (httpSourceUrl) {
    instance.attachSource(
      new HttpSource({
        url: httpSourceUrl,
        intervalMs: 1000,
      }),
    );
  }

  return instance;
}

function bindMotionListeners(instance: PuppetFlowRuntime): void {
  for (const unsub of motionListenerUnsubs.values()) {
    unsub();
  }
  motionListenerUnsubs.clear();

  for (const listener of motionListenerSet) {
    motionListenerUnsubs.set(listener, instance.onMotionUpdate(listener));
  }
}

function bindPipelineListeners(instance: PuppetFlowRuntime): void {
  for (const unsub of pipelineListenerUnsubs.values()) {
    unsub();
  }
  pipelineListenerUnsubs.clear();

  for (const listener of pipelineListenerSet) {
    pipelineListenerUnsubs.set(listener, instance.onMotionPipelineUpdate(listener));
  }
}

function restoreState(
  instance: PuppetFlowRuntime,
  savedState: Record<string, StateValue>,
): void {
  for (const [key, value] of Object.entries(savedState)) {
    instance.state.set(key, value);
  }
}

async function createAndStartRuntime(generation: number): Promise<PuppetFlowRuntime> {
  const instance = buildRuntime(currentPreset);
  await instance.start();

  if (generation !== startupGeneration) {
    await instance.stop();
    throw new StaleRuntimeStartup();
  }

  runtime = instance;
  bindMotionListeners(instance);
  bindPipelineListeners(instance);
  return instance;
}

async function restartRuntime(): Promise<PuppetFlowRuntime> {
  startupGeneration++;

  let savedState: Record<string, StateValue> = {};
  if (runtime) {
    savedState = runtime.state.getAll();
    await runtime.stop();
    runtime = null;
  }

  startupPromise = null;
  const instance = await ensureRuntime();
  restoreState(instance, savedState);
  return instance;
}

export async function ensureRuntime(): Promise<PuppetFlowRuntime> {
  if (runtime) {
    return runtime;
  }

  const generation = startupGeneration;

  if (!startupPromise) {
    startupPromise = createAndStartRuntime(generation).finally(() => {
      startupPromise = null;
    });
  }

  try {
    return await startupPromise;
  } catch (error) {
    if (error instanceof StaleRuntimeStartup) {
      return ensureRuntime();
    }

    throw error;
  }
}

export async function switchPreset(presetName: PresetName): Promise<PuppetFlowRuntime> {
  currentPreset = presetName;
  return restartRuntime();
}

export function getCurrentPreset(): PresetName {
  return currentPreset;
}

export async function configureHttpSource(
  url: string,
  enabled: boolean,
): Promise<void> {
  httpSourceUrl = enabled && url.trim().length > 0 ? url.trim() : null;
  await restartRuntime();
}

export function getHttpSourceUrl(): string | null {
  return httpSourceUrl;
}

export function subscribeMotion(listener: (motion: MotionState) => void): () => void {
  motionListenerSet.add(listener);

  if (runtime) {
    motionListenerUnsubs.set(listener, runtime.onMotionUpdate(listener));
  } else {
    void ensureRuntime().then(() => {
      if (motionListenerSet.has(listener) && runtime) {
        motionListenerUnsubs.set(listener, runtime.onMotionUpdate(listener));
      }
    });
  }

  return () => {
    motionListenerSet.delete(listener);
    motionListenerUnsubs.get(listener)?.();
    motionListenerUnsubs.delete(listener);
  };
}

export function subscribeMotionPipeline(
  listener: (update: { target: MotionState; rendered: MotionState }) => void,
): () => void {
  pipelineListenerSet.add(listener);

  if (runtime) {
    pipelineListenerUnsubs.set(listener, runtime.onMotionPipelineUpdate(listener));
  } else {
    void ensureRuntime().then(() => {
      if (pipelineListenerSet.has(listener) && runtime) {
        pipelineListenerUnsubs.set(listener, runtime.onMotionPipelineUpdate(listener));
      }
    });
  }

  return () => {
    pipelineListenerSet.delete(listener);
    pipelineListenerUnsubs.get(listener)?.();
    pipelineListenerUnsubs.delete(listener);
  };
}
