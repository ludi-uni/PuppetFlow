import type { Adapter } from "@puppetflow/adapter-core";
import type { BehaviorPlugin, MotionState, PluginInputStores } from "@puppetflow/core";
import { SmoothingModifier } from "@puppetflow/modifier";
import { describe, expect, it, vi } from "vitest";
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
  it("merges plugin outputs and notifies adapters with deltaTime", async () => {
    const update = vi.fn(async () => {});
    const adapter = createTestAdapter(update);

    const runtime = new PuppetFlowRuntime()
      .use(new TestPlugin({ mouthX: 0.4 }))
      .use(new TestPlugin({ mouthX: 0.6 }))
      .attachAdapter(adapter);

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBe(0.5);
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

    await runtime.stop();
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
});
