import { getPresetJson } from "@puppetflow/behavior-packs";
import type { MotionFrame } from "@puppetflow/core";
import type { StateSource } from "@puppetflow/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

const vmc = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown>>,
  frames: [] as MotionFrame[],
  update: vi.fn(),
  initialize: vi.fn(async () => {}),
  dispose: vi.fn(async () => {}),
}));

vi.mock("@puppetflow/adapter-vmc/node", () => ({
  NodeVmcAdapter: class FakeNodeVmcAdapter {
    readonly id = "vmc-node";
    constructor(config: Record<string, unknown>) {
      vmc.configs.push(config);
    }
    initialize = vmc.initialize;
    update = vmc.update;
    updateFrame = vi.fn(async (frame: MotionFrame) => vmc.frames.push(frame));
    dispose = vmc.dispose;
  },
}));

import { createPuppetFlowHost } from "./puppetflow-host.js";

describe("PuppetFlowHost launchConfig VMC composition", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends one composed frame path with Expression priority and retained mouth input", async () => {
    const mouth: StateSource = {
      id: "mouth-fixture",
      initialize: async () => {},
      update: async (target) =>
        target.motion.applyPayload({ mouthX: 0.25, custom: { mouthA: 0.7 } }),
      dispose: async () => {},
    };
    const host = createPuppetFlowHost({
      launchConfig: {
        presetJson: getPresetJson("Idle"),
        adapters: {
          vmc: {
            enabled: true,
            params: { mouthX: "Warai" },
            custom: { mouthA: { param: "MouthA" } },
            outputRateHz: 20,
            timestampMode: "send-time",
          },
          logger: { enabled: false },
        },
      },
      acting: {
        profile: {
          id: "vmc-host-test",
          bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
        },
        expressionProfile: {
          id: "vmc-expression-test",
          expressions: { happy: { blendShape: "Warai" } },
        },
        autoIdle: false,
      },
      sources: [mouth],
    });

    await host.start();
    expect(vmc.configs).toHaveLength(1);
    expect(vmc.configs[0]).toMatchObject({
      timestampMode: "send-time",
    });
    expect(vmc.configs[0]?.outputRateHz).toBeUndefined();
    expect(vmc.update).not.toHaveBeenCalled();

    host.control.setExpression({ expression: "happy", intensity: 1, fadeIn: 0 });
    await vi.waitFor(() =>
      expect(vmc.frames.at(-1)?.blendShapes).toMatchObject({
        Warai: 1,
        MouthA: 0.7,
      }),
    );
    host.control.act({ action: "wave", duration: 2 });
    host.control.interrupt();
    expect(host.control.getState().expression.activeExpression?.expression).toBe(
      "happy",
    );

    const beforeClear = vmc.frames.length;
    host.control.clearExpression({ fadeOut: 0 });
    await vi.waitFor(() =>
      expect(
        vmc.frames.slice(beforeClear).some((frame) => frame.blendShapes?.Warai === 0),
      ).toBe(true),
    );
    await vi.waitFor(() =>
      expect(vmc.frames.at(-1)?.blendShapes).toMatchObject({
        Warai: 0.25,
        MouthA: 0.7,
      }),
    );
    await host.dispose();
    expect(vmc.dispose).toHaveBeenCalledOnce();
  });

  it("retains the VMC output rate validation at the composed boundary", () => {
    expect(() =>
      createPuppetFlowHost({
        presetJson: getPresetJson("Idle"),
        vmc: { outputRateHz: 0 },
        acting: {
          profile: {
            id: "invalid-rate",
            bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
          },
        },
      }),
    ).toThrow(/positive finite/i);
  });
});
