import { getPresetJson } from "@puppetflow/behavior-packs";
import type { MotionFrameAdapter, StateSource } from "@puppetflow/runtime";
import { describe, expect, it, vi } from "vitest";

import { createPuppetFlowHost } from "./node.js";

const ACTING = {
  profile: {
    id: "host-test",
    bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
  },
  expressionProfile: {
    id: "host-expression",
    expressions: { happy: { blendShape: "Happy" } },
  },
  autoIdle: false,
};

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve = () => {};
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function output(id: string): MotionFrameAdapter {
  return {
    id,
    initialize: vi.fn(async () => {}),
    updateFrame: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  };
}

describe("createPuppetFlowHost", () => {
  it("shares one Runtime lifecycle across concurrent starts and makes control unavailable after dispose", async () => {
    const frameOutput = output("host-output");
    const host = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: false,
      motionAdapters: [frameOutput],
    });

    await Promise.all([host.start(), host.start()]);
    expect(frameOutput.initialize).toHaveBeenCalledTimes(1);
    expect(frameOutput.updateFrame).toHaveBeenCalledTimes(1);

    await Promise.all([host.dispose(), host.dispose()]);
    expect(frameOutput.dispose).toHaveBeenCalledTimes(1);
    expect(() => host.control.act("wave")).toThrow(/not running/i);
    await expect(host.start()).rejects.toThrow(/disposed/i);
  });

  it("keeps a second Host running after the first Host is disposed", async () => {
    const firstOutput = output("first-output");
    const secondOutput = output("second-output");
    const first = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: false,
      motionAdapters: [firstOutput],
    });
    const second = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: false,
      motionAdapters: [secondOutput],
    });

    await Promise.all([first.start(), second.start()]);
    await first.dispose();

    expect(firstOutput.dispose).toHaveBeenCalledTimes(1);
    expect(secondOutput.dispose).not.toHaveBeenCalled();
    expect(second.control.act("wave").accepted).toBe(true);

    await second.dispose();
    expect(secondOutput.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes only its initialized output and pending source during dispose", async () => {
    const initialization = deferred();
    const initializeEntered = deferred();
    const source: StateSource = {
      id: "pending-source",
      initialize: async () => {
        initializeEntered.resolve();
        await initialization.promise;
      },
      update: async () => {},
      dispose: vi.fn(async () => {
        initialization.resolve();
      }),
    };
    const frameOutput = output("pending-output");
    const host = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: false,
      sources: [source],
      motionAdapters: [frameOutput],
    });
    const start = host.start();

    await initializeEntered.promise;
    await Promise.all([host.dispose(), start]);

    expect(frameOutput.initialize).toHaveBeenCalledTimes(1);
    expect(frameOutput.dispose).toHaveBeenCalledTimes(1);
    expect(source.dispose).toHaveBeenCalledTimes(1);
    await expect(host.start()).rejects.toThrow(/disposed/i);
  });

  it("rejects required output initialization failure and releases initialized outputs", async () => {
    const failure = new Error("output unavailable");
    const initialized = output("initialized-output");
    const failed: MotionFrameAdapter = {
      ...output("failed-output"),
      initialize: vi.fn(async () => {
        throw failure;
      }),
    };
    const host = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: false,
      motionAdapters: [initialized, failed, initialized],
    });

    await expect(host.start()).rejects.toBe(failure);
    expect(initialized.dispose).toHaveBeenCalledTimes(1);
    expect(failed.dispose).toHaveBeenCalledTimes(1);
    expect(initialized.updateFrame).not.toHaveBeenCalled();
    expect(() => host.control.get_state()).toThrow(/not running/i);

    const frameCalls = initialized.updateFrame.mock.calls.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    expect(initialized.updateFrame).toHaveBeenCalledTimes(frameCalls);
  });

  it("rejects VMC output initialization failure and releases its transport", async () => {
    const failure = new Error("vmc unavailable");
    const close = vi.fn(async () => {});
    const host = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting: ACTING,
      vmc: {
        transport: {
          initialize: async () => {
            throw failure;
          },
          send: async () => {},
          close,
        },
      },
    });

    await expect(host.start()).rejects.toBe(failure);
    expect(close).toHaveBeenCalledTimes(1);
    expect(() => host.control.get_state()).toThrow(/not running/i);
  });
});
