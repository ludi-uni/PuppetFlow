import { ChannelStore, StateStore, TimelineStore } from "@puppetflow/core";
import { MotionOverrideStore } from "@puppetflow/source-core";
import { describe, expect, it, vi } from "vitest";
import { createAvatarLipSyncSource } from "./avatar-lip-sync-source.js";

describe("Avatar lip-sync reconnect", () => {
  it("backs off repeated connection failures and stops retrying after dispose", async () => {
    let now = 0;
    const initialize = vi.fn(async () => {
      throw new Error("unavailable");
    });
    const source = createAvatarLipSyncSource(
      {
        initialize,
        poll: async () => undefined,
        apply: () => {},
        dispose: vi.fn(async () => {}),
      },
      { now: () => now },
    );
    const target = {
      state: new StateStore(),
      channels: new ChannelStore(),
      timeline: new TimelineStore(),
      motion: new MotionOverrideStore(),
    };

    await source.initialize();
    await settle();
    expect(initialize).toHaveBeenCalledTimes(1);

    now = 999;
    await source.update(target);
    expect(initialize).toHaveBeenCalledTimes(1);
    now = 1_000;
    await source.update(target);
    await settle();
    expect(initialize).toHaveBeenCalledTimes(2);

    now = 2_999;
    await source.update(target);
    expect(initialize).toHaveBeenCalledTimes(2);
    now = 3_000;
    await source.update(target);
    await settle();
    expect(initialize).toHaveBeenCalledTimes(3);

    await source.dispose();
    now = 60_000;
    await source.update(target);
    expect(initialize).toHaveBeenCalledTimes(3);
  });
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
