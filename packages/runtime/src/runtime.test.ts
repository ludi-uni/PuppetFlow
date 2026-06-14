import type { Adapter } from "@puppetflow/adapter-core";
import type { BehaviorPlugin, MotionState, PluginInputStores } from "@puppetflow/core";
import { SmoothingModifier } from "@puppetflow/modifier";
import { loadPreset } from "@puppetflow/preset";
import { describe, expect, it, vi } from "vitest";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { StatefulStore } from "@puppetflow/stateful-core";
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

describe("PuppetFlowRuntime", () => {
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
    const store = (runtime as unknown as { statefulStore: StatefulStore }).statefulStore;

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

    await runtime.stop();
  });
});
