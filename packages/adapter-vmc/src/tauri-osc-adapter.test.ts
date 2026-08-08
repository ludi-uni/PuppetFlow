import { afterEach, describe, expect, it, vi } from "vitest";
import { VMC_PROFILE } from "@puppetflow/motion-mapper";
import { setTauriOscEnabled, TauriOscAdapter } from "./tauri-osc-adapter.js";

const invoke = vi.fn(async () => undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  isTauri: () => true,
}));

afterEach(() => {
  invoke.mockClear();
  setTauriOscEnabled(true);
});

describe("TauriOscAdapter.updateFrame", () => {
  it("invokes the native motion-frame Bundle command with complete bones", async () => {
    const adapter = new TauriOscAdapter({
      host: "127.0.0.1",
      port: 39539,
      profile: VMC_PROFILE,
      timestampMode: "frame-unix",
    });

    await adapter.updateFrame(
      {
        timestamp: 1_700_000_000_000,
        metadata: { clock: "unix" },
        bones: {
          Head: {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
          Partial: { rotation: { x: 0, y: 0, z: 0, w: 1 } },
        },
        blendShapes: { Smile: 0.5 },
        parameters: { mouthX: 0.4 },
      },
      1 / 60,
    );

    expect(invoke).toHaveBeenCalledWith("osc_send_motion_frame", {
      host: "127.0.0.1",
      port: 39539,
      bones: [
        {
          name: "Head",
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
      ],
      blend_shapes: {
        Smile: 0.5,
        ParamMouthForm: expect.closeTo(0.4, 5),
      },
      timestamp_mode: "frame-unix",
      timestamp_ms: 1_700_000_000_000,
    });
  });
});
