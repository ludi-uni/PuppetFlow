import type { Adapter, MotionFrameAdapter } from "@puppetflow/adapter-core";
import type {
  BehaviorPlugin,
  MotionFrame,
  MotionState,
  PluginInputStores,
} from "@puppetflow/core";
import { SmoothingModifier } from "@puppetflow/modifier";
import { loadPreset } from "@puppetflow/preset";
import { describe, expect, it, vi } from "vitest";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { StatefulStore } from "@puppetflow/stateful-core";
import type { MotionSource } from "@puppetflow/source-core";
import type { MotionFrameGraphDocument } from "@puppetflow/motion-graph";
import type { MotionFrameInput, MotionLayerPolicy } from "@puppetflow/motion-pipeline";
import { PuppetFlowRuntime } from "./runtime.js";

class TestPlugin implements BehaviorPlugin {
  readonly id = "test";

  constructor(private readonly output: Partial<MotionState>) {}

  process(_input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    return this.output;
  }
}

function createTestAdapter(update: Adapter["update"]): Adapter {
  return {
    id: "test-adapter",
    initialize: vi.fn(async () => {}),
    update,
    dispose: vi.fn(async () => {}),
  };
}

function createMotionSource(id: string, timestamp: number): MotionSource {
  return {
    id,
    start: vi.fn(async (emit) =>
      emit({ timestamp, parameters: { source: timestamp } }),
    ),
    stop: vi.fn(async () => {}),
  };
}

const motionFrameGraph: MotionFrameGraphDocument = {
  version: 1,
  initialState: "idle",
  states: [
    {
      id: "idle",
      sources: { idle: { enabled: true }, tracker: { enabled: false } },
    },
    {
      id: "tracking",
      sources: {
        idle: { enabled: false },
        tracker: { enabled: true, priority: 200 },
      },
    },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
  ],
};

describe("PuppetFlowRuntime", () => {
  it("evaluates the graph policy for inspect and process and resets on stop", async () => {
    const inspect = vi.fn(
      (_inputs: readonly MotionFrameInput[], _policy?: MotionLayerPolicy) => ({
        bones: {},
        blendShapes: {},
        parameters: {},
      }),
    );
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({ process, inspect, reset: vi.fn() })
      .attachMotionFrameGraph(motionFrameGraph)
      .setMotionGraphSignal("tracking", true);

    await runtime.start();

    expect(process).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      expect.objectContaining({ tracker: { enabled: true, priority: 200 } }),
    );
    expect(inspect).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ tracker: { enabled: true, priority: 200 } }),
    );
    expect((inspect.mock.calls[0] as unknown[])[1]).toBe(
      (process.mock.calls[0] as unknown[])[2],
    );
    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("tracking");

    await runtime.stop();

    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
    await runtime.start();
    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
    await runtime.stop();
  });

  it("keeps the legacy two-argument pipeline call when no graph is attached", async () => {
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionPipeline({ process, reset: vi.fn() });

    await runtime.start();

    expect(process.mock.calls[0] as unknown[]).toHaveLength(2);
    await runtime.stop();
  });

  it("filters disabled sources on the raw adapter path", async () => {
    const updateFrame = vi.fn(async (_frame: MotionFrame) => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("idle", 0))
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionAdapter({
        id: "frame-output",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .attachMotionFrameGraph(motionFrameGraph);

    await runtime.start();

    expect(updateFrame.mock.calls.map(([frame]) => frame.timestamp)).toEqual([0]);
    await runtime.stop();
  });

  it("evaluates source connected and stale health after fail-safe updates", async () => {
    const graph: MotionFrameGraphDocument = {
      version: 1,
      initialState: "connected",
      states: [
        { id: "connected", sources: { tracker: { enabled: true } } },
        { id: "stale", sources: { tracker: { enabled: false } } },
      ],
      transitions: [
        {
          from: "connected",
          to: "stale",
          when: { type: "source", sourceId: "tracker", field: "stale", equals: true },
        },
      ],
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({
        process: vi.fn((inputs) => inputs[0]?.frame),
        reset: vi.fn(),
      })
      .configureMotionFailSafe({ timeoutMs: 0, action: "hold-last-frame" })
      .attachMotionFrameGraph(graph);

    await runtime.start();

    expect(runtime.getMotionFrameGraphState()?.stateId).toBe("stale");
    await runtime.stop();
  });

  it("rejects graph signals before attachment and invalid graph documents", () => {
    const runtime = new PuppetFlowRuntime();

    expect(() => runtime.setMotionGraphSignal("tracking", true)).toThrow(
      "No MotionFrameGraph is attached",
    );
    expect(() =>
      runtime.attachMotionFrameGraph({ ...motionFrameGraph, initialState: "missing" }),
    ).toThrow("MotionFrameGraph.initialState is unknown: missing");
  });

  it("fails open when graph evaluation throws and still dispatches frames", async () => {
    const process = vi.fn(
      (
        inputs: readonly MotionFrameInput[],
        _deltaTime?: number,
        _policy?: MotionLayerPolicy,
      ) => inputs[0]?.frame,
    );
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(createMotionSource("tracker", 1))
      .attachMotionPipeline({ process, reset: vi.fn() })
      .attachMotionFrameGraph(motionFrameGraph);
    const controller = (
      runtime as unknown as {
        motionFrameGraph: { evaluate: () => never };
      }
    ).motionFrameGraph;
    controller.evaluate = vi.fn(() => {
      throw new Error("graph evaluation failed");
    });

    await runtime.start();

    expect(process).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      undefined,
    );
    await runtime.stop();
  });

  it("processes latest source frames through an attached motion pipeline", async () => {
    const sourceA: MotionSource = {
      id: "source-a",
      start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { a: 1 } })),
      stop: vi.fn(async () => {}),
    };
    const sourceB: MotionSource = {
      id: "source-b",
      start: vi.fn(async (emit) => emit({ timestamp: 2, parameters: { b: 1 } })),
      stop: vi.fn(async () => {}),
    };
    const processed = { timestamp: 3, parameters: { mixed: 1 } };
    const pipeline = {
      process: vi.fn(() => processed),
      reset: vi.fn(),
    };
    const updateFrame = vi.fn(async () => {});
    const adapter: MotionFrameAdapter = {
      id: "frame-adapter",
      initialize: vi.fn(async () => {}),
      updateFrame,
      dispose: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(sourceA)
      .attachMotionSource(sourceB)
      .attachMotionPipeline(pipeline)
      .attachMotionAdapter(adapter);

    await runtime.start();

    expect(pipeline.process).toHaveBeenCalledWith(
      [
        { sourceId: "source-a", frame: expect.objectContaining({ timestamp: 1 }) },
        { sourceId: "source-b", frame: expect.objectContaining({ timestamp: 2 }) },
      ],
      expect.any(Number),
    );
    expect(updateFrame).toHaveBeenCalledWith(processed, expect.any(Number));

    await runtime.stop();
    expect(pipeline.reset).toHaveBeenCalledTimes(1);
  });

  it("isolates pipeline failures from legacy adapters", async () => {
    const legacyUpdate = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionPipeline({
        process: vi.fn(() => {
          throw new Error("pipeline failed");
        }),
        reset: vi.fn(),
      })
      .attachAdapter(createTestAdapter(legacyUpdate));

    await runtime.start();
    expect(legacyUpdate).toHaveBeenCalled();
    await runtime.stop();
  });

  it("omits stale source frames when fail-safe disables the source", async () => {
    const process = vi.fn(() => ({ timestamp: 1, parameters: { value: 1 } }));
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionPipeline({ process, reset: vi.fn() })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "disable-source",
      });

    await runtime.start();

    expect(process).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it("holds the latest frame when fail-safe marks a source stale", async () => {
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "hold-last-frame",
      });

    await runtime.start();

    expect(updateFrame).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { value: 1 } }),
      expect.any(Number),
    );
    await runtime.stop();
  });

  it("blends stale source frames to neutral immediately when configured", async () => {
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "stale-source",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 0,
        action: "blend-to-neutral",
        transitionMs: 0,
      });

    await runtime.start();

    expect(updateFrame).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { value: 0 } }),
      expect.any(Number),
    );
    await runtime.stop();
  });

  it("does not reuse a stopped source frame on the next start", async () => {
    let startCount = 0;
    const updateFrame = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "one-shot-source",
        start: vi.fn(async (emit) => {
          startCount += 1;
          if (startCount === 1) {
            emit({ timestamp: 1, parameters: { value: 1 } });
          }
        }),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "frame-adapter",
        initialize: vi.fn(async () => {}),
        updateFrame,
        dispose: vi.fn(async () => {}),
      })
      .configureMotionFailSafe({
        timeoutMs: 1000,
        action: "hold-last-frame",
      });

    await runtime.start();
    await runtime.stop();
    updateFrame.mockClear();
    await runtime.start();

    expect(updateFrame).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it("exposes source, mixer, and output inspector telemetry", async () => {
    const frameUpdate = vi.fn(async () => {});
    const legacyUpdate = vi.fn(async () => {});
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "tracking",
        start: vi.fn(async (emit) =>
          emit({ timestamp: 42, parameters: { lean: 0.5 } }),
        ),
        stop: vi.fn(async () => {}),
      })
      .attachMotionPipeline({
        process: vi.fn(() => ({ timestamp: 42, parameters: { lean: 0.5 } })),
        inspect: vi.fn(() => ({
          bones: {
            Head: [{ sourceId: "tracking", priority: 100, weight: 1 }],
          },
          blendShapes: {},
          parameters: {},
        })),
        reset: vi.fn(),
      })
      .attachMotionAdapter({
        id: "frame-output",
        initialize: vi.fn(async () => {}),
        updateFrame: frameUpdate,
        dispose: vi.fn(async () => {}),
      })
      .attachAdapter(createTestAdapter(legacyUpdate));

    await runtime.start();

    const snapshot = runtime.getMotionInspectorSnapshot();
    expect(snapshot.running).toBe(true);
    expect(snapshot.sources).toEqual([
      expect.objectContaining({
        id: "tracking",
        connected: true,
        stale: false,
        lastFrameTimestamp: 42,
      }),
    ]);
    expect(snapshot.sources[0]?.inputRateHz).toBeGreaterThan(0);
    expect(snapshot.mixer?.bones.Head).toEqual([
      { sourceId: "tracking", priority: 100, weight: 1 },
    ]);
    expect(snapshot.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "frame-output", connected: true }),
        expect.objectContaining({ id: "test-adapter", connected: true }),
      ]),
    );
    expect(
      snapshot.outputs.find((output) => output.id === "frame-output")?.outputRateHz,
    ).toBeGreaterThan(0);
    expect(
      snapshot.outputs.find((output) => output.id === "test-adapter")?.outputRateHz,
    ).toBeGreaterThan(0);

    await runtime.stop();

    const stopped = runtime.getMotionInspectorSnapshot();
    expect(stopped.running).toBe(false);
    expect(stopped.sources[0]).toMatchObject({
      id: "tracking",
      connected: false,
      stale: false,
      inputRateHz: 0,
    });
    expect(stopped.sources[0]?.lastFrameAt).toBeUndefined();
    expect(stopped.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frame-output",
          connected: false,
          outputRateHz: 0,
        }),
        expect.objectContaining({
          id: "test-adapter",
          connected: false,
          outputRateHz: 0,
        }),
      ]),
    );
  });

  it("records output adapter failures in the inspector", async () => {
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource({
        id: "tracking",
        start: vi.fn(async (emit) => emit({ timestamp: 1, parameters: { value: 1 } })),
        stop: vi.fn(async () => {}),
      })
      .attachMotionAdapter({
        id: "broken-output",
        initialize: vi.fn(async () => {}),
        updateFrame: vi.fn(async () => {
          throw new Error("output unavailable");
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();

    expect(runtime.getMotionInspectorSnapshot().outputs).toEqual([
      expect.objectContaining({
        id: "broken-output",
        connected: false,
        error: "output unavailable",
      }),
    ]);
    await runtime.stop();
  });

  it("starts motion sources and delivers latest frames in source attachment order", async () => {
    const frameA: MotionFrame = { timestamp: 1, blendShapes: { A: 0.1 } };
    const frameB: MotionFrame = { timestamp: 2, bones: { Head: {} } };
    const sourceA: MotionSource = {
      id: "source-a",
      start: vi.fn(async (emit) => emit(frameA)),
      stop: vi.fn(async () => {}),
    };
    const sourceB: MotionSource = {
      id: "source-b",
      start: vi.fn(async (emit) => emit(frameB)),
      stop: vi.fn(async () => {}),
    };
    const updateFrame = vi.fn(async (_frame: MotionFrame, _deltaTime: number) => {});
    const adapter: MotionFrameAdapter = {
      id: "frame-adapter",
      initialize: vi.fn(async () => {}),
      updateFrame,
      dispose: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachMotionSource(sourceA)
      .attachMotionSource(sourceB)
      .attachMotionAdapter(adapter);

    await runtime.start();

    expect(sourceA.start).toHaveBeenCalledTimes(1);
    expect(sourceB.start).toHaveBeenCalledTimes(1);
    expect(updateFrame.mock.calls.map(([frame]) => frame.timestamp)).toEqual([1, 2]);
    expect(runtime.getMotionSources()).toEqual([sourceA, sourceB]);
    expect(runtime.getMotionFrameAdapters()).toEqual([adapter]);

    await runtime.stop();

    expect(sourceA.stop).toHaveBeenCalledTimes(1);
    expect(sourceB.stop).toHaveBeenCalledTimes(1);
    expect(
      (runtime as unknown as { latestMotionFrames: Map<string, MotionFrame> })
        .latestMotionFrames.size,
    ).toBe(0);
  });

  it("initializes and disposes one object once when it is both legacy and frame-capable", async () => {
    const adapter: Adapter & MotionFrameAdapter = {
      id: "dual-adapter",
      initialize: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
      updateFrame: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const source: MotionSource = {
      id: "source",
      start: vi.fn(async (emit) => emit({ timestamp: 0, blendShapes: { Smile: 0.4 } })),
      stop: vi.fn(async () => {}),
    };
    const runtime = new PuppetFlowRuntime()
      .attachAdapter(adapter)
      .attachMotionAdapter(adapter)
      .attachMotionSource(source);

    await runtime.start();
    await runtime.stop();

    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(adapter.update).toHaveBeenCalled();
    expect(adapter.updateFrame).toHaveBeenCalled();
  });

  it("adds plugin outputs and notifies adapters with deltaTime", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.4 }))
      .use(new TestPlugin({ mouthX: 0.6 }))
      .attachAdapter(adapter);

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBe(1);
    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.any(Object), expect.any(Number));

    await runtime.stop();
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("stops adapter updates after stop is requested", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime().attachAdapter(adapter);
    await runtime.start();

    expect(update.mock.calls.length).toBeGreaterThan(0);

    await runtime.stop();

    const callsAtStop = update.mock.calls.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(update.mock.calls.length).toBe(callsAtStop);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("waits for in-flight tick before disposing adapters", async () => {
    let blockUpdates = false;
    let releaseBlockedUpdate: (() => void) | undefined;

    const update = vi.fn(async () => {
      if (!blockUpdates) {
        return;
      }
      await new Promise<void>((resolve) => {
        releaseBlockedUpdate = resolve;
      });
    });
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachAdapter(adapter);

    await runtime.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(update).toHaveBeenCalled();

    blockUpdates = true;
    runtime.state.set("trigger", 1);

    await vi.waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(1));

    const stopPromise = runtime.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(adapter.dispose).not.toHaveBeenCalled();

    releaseBlockedUpdate!();
    await stopPromise;
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("applies motion modifiers between target and rendered motion", async () => {
    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 1 }))
      .useModifier(new SmoothingModifier({ factor: 0.5 }));

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBe(1);
    expect(runtime.getRenderedMotion().mouthX).toBe(0.5);

    await runtime.stop();
  });

  it("supports multiple adapters simultaneously", async () => {
    const vmcUpdate = vi.fn(async () => {});
    const loggerUpdate = vi.fn(async () => {});

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.3 }))
      .attachAdapter({ ...createTestAdapter(vmcUpdate), id: "vmc" })
      .attachAdapter({ ...createTestAdapter(loggerUpdate), id: "logger" });

    await runtime.start();

    expect(vmcUpdate).toHaveBeenCalled();
    expect(loggerUpdate).toHaveBeenCalled();

    await runtime.stop();
  });

  it("exposes state through runtime.state", () => {
    const runtime = new PuppetFlowRuntime();
    runtime.state.set("interest", 0.8);

    expect(runtime.state.get("interest")).toBe(0.8);
  });

  it("exposes channels and timeline APIs", async () => {
    const runtime = new PuppetFlowRuntime();
    runtime.channels.set("volume", 0.7);
    runtime.timeline.push({
      startMs: 0,
      endMs: 100,
      type: "phoneme",
      value: { phoneme: "A" },
    });

    await runtime.start();
    expect(runtime.channels.get("volume")).toBe(0.7);
    expect(runtime.getActiveTimelineEvents().length).toBeGreaterThanOrEqual(0);
    await runtime.stop();
  });

  it("exposes per-plugin outputs in the motion pipeline", async () => {
    const listener = vi.fn();
    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.2 }))
      .use(new TestPlugin({ mouthX: 0.6 }));

    runtime.onMotionPipelineUpdate(listener);
    await runtime.start();

    const lastCall = listener.mock.calls.at(-1)?.[0];
    const testOutputs = lastCall?.pluginOutputs.filter(
      (snapshot) => snapshot.pluginId === "test",
    );
    expect(testOutputs).toHaveLength(2);
    expect(testOutputs?.[0]?.output.mouthX).toBe(0.2);
    expect(testOutputs?.[1]?.output.mouthX).toBe(0.6);
    expect(
      lastCall?.pluginOutputs.some((snapshot) => snapshot.pluginId === "behavior"),
    ).toBe(true);
    expect(
      lastCall?.pluginOutputs.some((snapshot) => snapshot.pluginId === "graph"),
    ).toBe(true);
    expect(lastCall?.statefulSnapshot).toEqual([]);

    await runtime.stop();
  });

  it("clears stateful store when stopped", async () => {
    const runtime = new PuppetFlowRuntime().use(new GazePlugin());
    const store = (runtime as unknown as { statefulStore: StatefulStore })
      .statefulStore;

    await runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(store.snapshot().length).toBeGreaterThan(0);

    await runtime.stop();
    expect(store.snapshot()).toEqual([]);
  });

  it("does not run overlapping ticks while a source update is in flight", async () => {
    let activeUpdates = 0;
    let maxActiveUpdates = 0;

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachSource({
        id: "slow-source",
        initialize: vi.fn(async () => {}),
        update: vi.fn(async () => {
          activeUpdates += 1;
          maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 30);
          });
          activeUpdates -= 1;
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 80);
    });
    await runtime.stop();

    expect(maxActiveUpdates).toBe(1);
  });

  it("does not invoke adapters after stop completes", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.5 }))
      .attachAdapter(adapter);

    await runtime.start();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });

    update.mockClear();
    await runtime.stop();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });

    expect(update).not.toHaveBeenCalled();
  });

  it("applies motion overrides from sources after the pipeline", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.1 }))
      .attachAdapter(adapter)
      .attachSource({
        id: "motion-source",
        initialize: vi.fn(async () => {}),
        update: vi.fn(async (target) => {
          target.motion.applyPayload({ mouthX: 0.9, lookX: 0.2 });
        }),
        dispose: vi.fn(async () => {}),
      });

    await runtime.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const lastMotion = update.mock.calls.at(-1)?.[0] as MotionState | undefined;
    expect(lastMotion?.mouthX).toBe(0.9);
    expect(lastMotion?.lookX).toBe(0.2);

    await runtime.stop();
  });

  it("applies extension packs from preset extensions", async () => {
    const runtime = new PuppetFlowRuntime().loadPreset(
      loadPreset(
        JSON.stringify({
          name: "Thinking",
          version: 3,
          behavior: { type: "Block", statements: [] },
          graph: { nodes: [], edges: [] },
          extensions: {
            packs: [{ id: "thinking", config: { intensity: 0.8 } }],
          },
        }),
      ),
    );

    await runtime.start();

    expect(runtime.getRenderedMotion().lookX).not.toBe(0.5);
    const pipeline = runtime.getPluginOutputs();
    expect(pipeline.some((entry) => entry.pluginId === "extensions")).toBe(true);

    await runtime.stop();
  });

  it("executes PFScript preset behavior with channels and conditional packs", async () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "PfScriptRuntime",
        version: 3,
        behaviorPfScript: `
smile = interest * 0.4
if interest > 0.7 then
    thinking(intensity = 0.8)
end
`,
        graph: { nodes: [], edges: [] },
      }),
    );

    const runtime = new PuppetFlowRuntime().loadPreset(loaded);
    runtime.state.set("interest", 0.5);
    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBeCloseTo(0.2, 2);
    const lowInterestLookX = runtime.getRenderedMotion().lookX;

    runtime.state.set("interest", 1);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(runtime.getTargetMotion().mouthX).toBeCloseTo(0.4, 2);
    expect(runtime.getRenderedMotion().lookX).not.toBeCloseTo(lowInterestLookX, 2);

    await runtime.stop();
  });

  it("resolves currentPhoneme from phoneme channel for PFScript lip-sync", async () => {
    const loaded = loadPreset(
      JSON.stringify({
        name: "LipSync",
        version: 3,
        behaviorPfScript: `
if currentPhoneme == "A" then
    MouthA = 1
end
`,
        graph: { nodes: [], edges: [] },
      }),
    );

    const runtime = new PuppetFlowRuntime().loadPreset(loaded);
    runtime.channels.set("phoneme", "A");
    await runtime.start();

    expect(runtime.getTargetMotion().custom?.MouthA).toBeCloseTo(1, 2);
    expect(runtime.getRenderedMotion().custom?.MouthA).toBeCloseTo(1, 2);

    await runtime.stop();
  });
});
