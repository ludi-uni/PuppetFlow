import { afterEach, describe, expect, it, vi } from "vitest";

const outputState = vi.hoisted(() => ({
  active: 0,
  blockNextInitialize: false,
  maxActive: 0,
  releaseInitialize: undefined as (() => void) | undefined,
  instances: [] as Array<{
    initialize: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateFrame: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@puppetflow/adapter-vmc", () => ({
  TauriOscAdapter: class FakeTauriOscAdapter {
    readonly id = "osc-vmc";
    readonly initialize = vi.fn(async () => {
      if (outputState.blockNextInitialize) {
        outputState.blockNextInitialize = false;
        await new Promise<void>((resolve) => {
          outputState.releaseInitialize = resolve;
        });
      }
      outputState.active += 1;
      outputState.maxActive = Math.max(outputState.maxActive, outputState.active);
    });
    readonly update = vi.fn(async () => {});
    readonly updateFrame = vi.fn(async () => {});
    readonly dispose = vi.fn(async () => {
      outputState.active -= 1;
    });

    constructor() {
      outputState.instances.push(this);
    }
  },
}));

import { cloneMapperConfig, DEFAULT_MAPPER_CONFIG } from "./mapper-config";
import { setMapperConfig, shutdownRuntime, switchPreset } from "./runtime";

describe("Studio Runtime output lifecycle", () => {
  afterEach(async () => {
    await shutdownRuntime();
    delete (globalThis as { isTauri?: boolean }).isTauri;
  });

  it("stops the old real Runtime output before a replacement starts", async () => {
    (globalThis as { isTauri?: boolean }).isTauri = true;
    const config = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);
    config.loggerEnabled = false;
    config.vmc.enabled = true;
    config.live2d.enabled = false;
    config.vrm.enabled = false;

    expect(await setMapperConfig(config)).toBeUndefined();
    expect(outputState.instances).toHaveLength(1);
    expect(outputState.instances[0]?.initialize).toHaveBeenCalledOnce();

    expect(await switchPreset("Happy")).toBeUndefined();
    expect(outputState.instances).toHaveLength(2);
    expect(outputState.instances[0]?.dispose).toHaveBeenCalledOnce();
    expect(outputState.instances[1]?.initialize).toHaveBeenCalledOnce();
    expect(outputState.maxActive).toBe(1);

    outputState.blockNextInitialize = true;
    const replacement = setMapperConfig(cloneMapperConfig(config));
    const replacementRejection = expect(replacement).rejects.toThrow(/shutting down/i);
    await vi.waitFor(() => {
      expect(outputState.instances).toHaveLength(3);
      expect(outputState.instances[2]?.initialize).toHaveBeenCalledOnce();
    });

    let shutdownSettled = false;
    const shutdown = shutdownRuntime().then(() => {
      shutdownSettled = true;
    });
    await Promise.resolve();
    expect(shutdownSettled).toBe(false);
    outputState.releaseInitialize?.();
    await shutdown;
    await replacementRejection;

    expect(outputState.instances[1]?.dispose).toHaveBeenCalledOnce();
    expect(outputState.instances[2]?.dispose).toHaveBeenCalledOnce();
    expect(outputState.maxActive).toBe(1);
    expect(outputState.active).toBe(0);
  });
});
