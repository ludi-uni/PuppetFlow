import { PuppetFlowRuntime, type ActingState } from "@puppetflow/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloneMapperConfig, DEFAULT_MAPPER_CONFIG } from "./mapper-config";
import {
  act,
  attachMapperOutputs,
  clearExpression,
  ensureRuntime,
  getActingCapabilities,
  getActingState,
  getRuntime,
  interrupt,
  restartRuntime,
  sequence,
  setExpression,
  shutdownRuntime,
  subscribeActing,
  type StudioActingSnapshot,
} from "./runtime";

describe("attachMapperOutputs", () => {
  it("registers only the VMC Tauri adapter for motion-frame output", () => {
    const mapperConfig = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);
    mapperConfig.vmc.enabled = true;
    mapperConfig.live2d.enabled = true;
    mapperConfig.vrm.enabled = true;
    const runtime = new PuppetFlowRuntime();

    attachMapperOutputs(runtime, mapperConfig, true);

    expect(runtime.getAdapters().map((adapter) => adapter.id)).toEqual([
      "osc-vmc",
      "osc-live2d",
      "osc-vrm",
    ]);
    expect(runtime.getMotionFrameAdapters().map((adapter) => adapter.id)).toEqual([
      "osc-vmc",
    ]);
    expect(runtime.getMotionFrameAdapters()[0]).toBe(runtime.getAdapters()[0]);
  });
});

describe("Studio acting control connection", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await shutdownRuntime();
  });

  it("routes canonical commands to one real Runtime and rebinds canonical snapshots", async () => {
    const runtimeCallbacks: Array<(state: ActingState) => void> = [];
    const runtimeUnsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const originalSubscribe = PuppetFlowRuntime.prototype.onActingUpdate;
    vi.spyOn(PuppetFlowRuntime.prototype, "onActingUpdate").mockImplementation(
      function (this: PuppetFlowRuntime, listener) {
        runtimeCallbacks.push(listener);
        const unsubscribe = vi.fn(originalSubscribe.call(this, listener));
        runtimeUnsubscribes.push(unsubscribe);
        return unsubscribe;
      },
    );

    const runtime = await ensureRuntime();
    expect(await ensureRuntime()).toBe(runtime);
    expect(getActingCapabilities()).toMatchObject({
      acting: { actions: expect.arrayContaining(["wave"]), sequence: true },
      expressions: { names: expect.arrayContaining(["happy"]), clear: true },
    });

    const snapshots: StudioActingSnapshot[] = [];
    const unsubscribe = subscribeActing((snapshot) => snapshots.push(snapshot));
    const action = act({
      action: " wave ",
      side: "right",
      intensity: 0.6,
      speed: 1.2,
      duration: 2,
      blendDuration: 0.25,
    });

    expect(action.accepted).toBe(true);
    expect(runtime.getActingState().activeAction).toMatchObject({
      action: "wave",
      side: "right",
      intensity: 0.6,
      speed: 1.2,
      duration: 2,
      blendDuration: 0.25,
    });
    expect(getActingState()).toEqual(action.state);
    expect(getActingState()).not.toBe(action.state);
    expect(
      sequence({
        actions: [
          { action: "look_left", duration: 0.5 },
          { action: "look_right", duration: 0.5 },
        ],
      }).accepted,
    ).toBe(true);
    expect(interrupt().accepted).toBe(true);
    expect(
      setExpression({
        expression: " happy ",
        intensity: 0.5,
        duration: 1.5,
        fadeIn: 0.1,
        fadeOut: 0.2,
      }),
    ).toMatchObject({
      accepted: true,
      state: {
        expression: {
          activeExpression: {
            expression: "happy",
            intensity: 0.5,
            duration: 1.5,
            fadeIn: 0.1,
            fadeOut: 0.2,
          },
        },
      },
    });
    expect(clearExpression({ fadeOut: 0 }).accepted).toBe(true);

    const oldCallback = runtimeCallbacks[0];
    const restarting = restartRuntime();
    expect(act({ action: "wave" })).toMatchObject({
      accepted: false,
      reason: "PuppetFlow acting is unavailable",
    });
    const replacement = await restarting;
    expect(replacement).not.toBe(runtime);
    expect(runtimeUnsubscribes[0]).toHaveBeenCalledOnce();
    expect(snapshots.some((snapshot) => !snapshot.ready)).toBe(true);
    expect(snapshots.at(-1)?.ready).toBe(true);

    oldCallback?.({
      activeAction: { action: "nod" },
      elapsed: 1,
      remaining: 1,
      queueLength: 0,
      blendRemaining: 0,
    });
    expect(snapshots.at(-1)?.state.acting.activeAction?.action).not.toBe("nod");

    let resolveStartup: (() => void) | undefined;
    const pendingStartup = new Promise<void>((resolve) => {
      resolveStartup = resolve;
    });
    vi.spyOn(PuppetFlowRuntime.prototype, "start").mockReturnValueOnce(pendingStartup);
    const interruptedRestart = restartRuntime();
    const restartRejection =
      expect(interruptedRestart).rejects.toThrow(/shutting down/i);
    await vi.waitFor(() => expect(() => getRuntime()).toThrow(/not ready/i));

    await shutdownRuntime();
    expect(runtimeUnsubscribes.at(-1)).toHaveBeenCalledOnce();
    expect(() => act({ action: "wave" })).toThrow(/not ready/i);
    resolveStartup?.();
    await restartRejection;

    unsubscribe();
    const countAfterUnsubscribe = snapshots.length;
    runtimeCallbacks.at(-1)?.({
      activeAction: { action: "wave" },
      elapsed: 1,
      remaining: 1,
      queueLength: 0,
      blendRemaining: 0,
    });
    expect(snapshots).toHaveLength(countAfterUnsubscribe);
  });
});
