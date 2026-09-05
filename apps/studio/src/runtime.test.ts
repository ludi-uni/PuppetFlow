import type { MicroBehaviorDefinition } from "@puppetflow/micro-behavior";
import { PuppetFlowRuntime, type ActingState } from "@puppetflow/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  act,
  applyStudioRuntimeInputs,
  clearExpression,
  ensureRuntime,
  getActingCapabilities,
  getActingState,
  interrupt,
  pushTimelinePhoneme,
  requestMicroBehavior,
  restartRuntime,
  sequence,
  setCustomMicroBehaviorDefinitions,
  setExpression,
  shutdownRuntime,
  subscribeActing,
  subscribeMotionPipeline,
  testCustomMicroBehavior,
  type MotionPipelineUpdate,
  type StudioActingSnapshot,
} from "./runtime";

type RuntimePipelineUpdate = Parameters<
  Parameters<PuppetFlowRuntime["onMotionPipelineUpdate"]>[0]
>[0];

describe("Studio runtime facade", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await shutdownRuntime();
  });

  it("encapsulates one real Runtime across input, observation, restart, and shutdown", async () => {
    const actingCallbacks: Array<(state: ActingState) => void> = [];
    const actingUnsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const pipelineCallbacks: Array<(update: RuntimePipelineUpdate) => void> = [];
    const rawPipelineUpdates: RuntimePipelineUpdate[] = [];
    const pipelineUnsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const startSpy = vi.spyOn(PuppetFlowRuntime.prototype, "start");
    const originalActingSubscribe = PuppetFlowRuntime.prototype.onActingUpdate;
    const originalPipelineSubscribe =
      PuppetFlowRuntime.prototype.onMotionPipelineUpdate;

    vi.spyOn(PuppetFlowRuntime.prototype, "onActingUpdate").mockImplementation(
      function (this: PuppetFlowRuntime, listener) {
        actingCallbacks.push(listener);
        const unsubscribe = vi.fn(originalActingSubscribe.call(this, listener));
        actingUnsubscribes.push(unsubscribe);
        return unsubscribe;
      },
    );
    vi.spyOn(PuppetFlowRuntime.prototype, "onMotionPipelineUpdate").mockImplementation(
      function (this: PuppetFlowRuntime, listener) {
        pipelineCallbacks.push(listener);
        const unsubscribe = vi.fn(
          originalPipelineSubscribe.call(this, (update) => {
            rawPipelineUpdates.push(update);
            listener(update);
          }),
        );
        pipelineUnsubscribes.push(unsubscribe);
        return unsubscribe;
      },
    );

    const actingSnapshots: StudioActingSnapshot[] = [];
    const motionSnapshots: MotionPipelineUpdate[] = [];
    const unsubscribeActing = subscribeActing((snapshot) =>
      actingSnapshots.push(snapshot),
    );
    const unsubscribeMotion = subscribeMotionPipeline((snapshot) =>
      motionSnapshots.push(snapshot),
    );

    expect(await Promise.all([ensureRuntime(), ensureRuntime()])).toEqual([
      undefined,
      undefined,
    ]);
    expect(startSpy).toHaveBeenCalledOnce();
    expect(getActingCapabilities()).toMatchObject({
      acting: { actions: expect.arrayContaining(["wave"]), sequence: true },
      expressions: { names: expect.arrayContaining(["happy"]), clear: true },
    });

    const afterStartMotionSnapshots: MotionPipelineUpdate[] = [];
    const unsubscribeAfterStartMotion = subscribeMotionPipeline((snapshot) =>
      afterStartMotionSnapshots.push(snapshot),
    );
    expect(afterStartMotionSnapshots.at(-1)?.ready).toBe(true);

    const action = act({
      action: " wave ",
      side: "right",
      intensity: 0.6,
      speed: 1.2,
      duration: 2,
      blendDuration: 0.25,
    });
    expect(action.accepted).toBe(true);
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
          activeExpression: { expression: "happy", intensity: 0.5 },
        },
      },
    });
    expect(clearExpression({ fadeOut: 0 }).accepted).toBe(true);

    expect(
      applyStudioRuntimeInputs({
        state: { interest: 0.8 },
        channels: { volume: 0.7, phoneme: "A", emotion: "happy" },
      }),
    ).toBe(true);
    expect(pushTimelinePhoneme("A", 150)).not.toBeNull();
    const customDefinition: MicroBehaviorDefinition = {
      id: "studio_test",
      duration: 0.5,
      cooldown: 0,
      keyframes: [{ t: 0, params: { lookY: 0.5 } }],
    };
    expect(setCustomMicroBehaviorDefinitions([customDefinition])).toBe(true);
    expect(requestMicroBehavior(customDefinition.id)).toBe(true);
    expect(testCustomMicroBehavior({ ...customDefinition, id: "studio_one_off" })).toBe(
      true,
    );

    await vi.waitFor(() => {
      expect(motionSnapshots.at(-1)).toMatchObject({
        ready: true,
        channels: { volume: 0.7, phoneme: "A", emotion: "happy" },
        stateSnapshot: { interest: 0.8 },
      });
      expect(
        motionSnapshots
          .at(-1)
          ?.activeTimelineEvents.some((event) => event.type === "phoneme"),
      ).toBe(true);
    });
    const detachedTimeline = motionSnapshots
      .at(-1)
      ?.activeTimelineEvents.find((event) => event.type === "phoneme");
    const rawTimeline = rawPipelineUpdates
      .at(-1)
      ?.activeTimelineEvents.find((event) => event.type === "phoneme");
    expect(detachedTimeline?.value).not.toBe(rawTimeline?.value);
    (detachedTimeline?.value as { phoneme: string }).phoneme = "changed";
    expect((rawTimeline?.value as { phoneme: string }).phoneme).toBe("A");

    const detachedStateful = motionSnapshots
      .at(-1)
      ?.statefulSnapshot.find((entry) => typeof entry.state === "object");
    const rawStateful = rawPipelineUpdates
      .at(-1)
      ?.statefulSnapshot.find(
        (entry) =>
          entry.functionName === detachedStateful?.functionName &&
          entry.instanceId === detachedStateful.instanceId,
      );
    expect(detachedStateful?.state).toBeDefined();
    expect(detachedStateful?.state).not.toBe(rawStateful?.state);
    const stateKey = Object.keys(detachedStateful?.state ?? {})[0];
    expect(stateKey).toBeDefined();
    (detachedStateful?.state as Record<string, unknown>)[stateKey!] = "changed";
    expect((rawStateful?.state as Record<string, unknown>)[stateKey!]).not.toBe(
      "changed",
    );

    const oldActingCallback = actingCallbacks[0];
    const oldPipelineCallback = pipelineCallbacks[0];
    const oldPipelineUpdate = rawPipelineUpdates[0];
    const restarting = restartRuntime();
    const ensuringDuringRestart = ensureRuntime();
    expect(act({ action: "wave" })).toMatchObject({
      accepted: false,
      reason: "PuppetFlow acting is unavailable",
    });
    expect(await Promise.all([restarting, ensuringDuringRestart])).toEqual([
      undefined,
      undefined,
    ]);
    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(actingUnsubscribes[0]).toHaveBeenCalledOnce();
    expect(pipelineUnsubscribes[0]).toHaveBeenCalledOnce();
    expect(pipelineUnsubscribes[1]).toHaveBeenCalledOnce();
    expect(actingSnapshots.some((snapshot) => !snapshot.ready)).toBe(true);
    expect(actingSnapshots.at(-1)?.ready).toBe(true);
    expect(motionSnapshots.some((snapshot) => !snapshot.ready)).toBe(true);
    expect(motionSnapshots.at(-1)?.ready).toBe(true);

    oldActingCallback?.({
      activeAction: { action: "nod" },
      elapsed: 1,
      remaining: 1,
      queueLength: 0,
      blendRemaining: 0,
    });
    expect(actingSnapshots.at(-1)?.state.acting.activeAction?.action).not.toBe("nod");
    const motionCount = motionSnapshots.length;
    if (oldPipelineUpdate) oldPipelineCallback?.(oldPipelineUpdate);
    expect(motionSnapshots).toHaveLength(motionCount);
    await vi.waitFor(() => {
      expect(motionSnapshots.at(-1)).toMatchObject({
        ready: true,
        stateSnapshot: { interest: 0.8 },
      });
    });

    let resolveStartup: (() => void) | undefined;
    const pendingStartup = new Promise<void>((resolve) => {
      resolveStartup = resolve;
    });
    startSpy.mockReturnValueOnce(pendingStartup);
    const beforeInterruptedRestart = motionSnapshots.length;
    const interruptedRestart = restartRuntime();
    const restartRejection =
      expect(interruptedRestart).rejects.toThrow(/shutting down/i);
    await vi.waitFor(() =>
      expect(
        motionSnapshots
          .slice(beforeInterruptedRestart)
          .some((snapshot) => !snapshot.ready),
      ).toBe(true),
    );

    let shutdownSettled = false;
    const shutdown = shutdownRuntime().then(() => {
      shutdownSettled = true;
    });
    await Promise.resolve();
    expect(shutdownSettled).toBe(false);
    expect(actingUnsubscribes.at(-1)).toHaveBeenCalledOnce();
    expect(pipelineUnsubscribes.at(-1)).toHaveBeenCalledOnce();
    expect(() => act({ action: "wave" })).toThrow(/not ready/i);
    resolveStartup?.();
    await shutdown;
    await restartRejection;

    unsubscribeActing();
    unsubscribeMotion();
    unsubscribeAfterStartMotion();
    const actingCount = actingSnapshots.length;
    const finalMotionCount = motionSnapshots.length;
    actingCallbacks.at(-1)?.({
      activeAction: { action: "wave" },
      elapsed: 1,
      remaining: 1,
      queueLength: 0,
      blendRemaining: 0,
    });
    if (rawPipelineUpdates.at(-1)) {
      pipelineCallbacks.at(-1)?.(rawPipelineUpdates.at(-1)!);
    }
    expect(actingSnapshots).toHaveLength(actingCount);
    expect(motionSnapshots).toHaveLength(finalMotionCount);
  });
});
