import { describe, expect, it, vi } from "vitest";
import {
  createMotionRuntimeRegistry,
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "./motion-runtime-registry.js";

describe("MotionRuntimeRegistry", () => {
  it("creates registered source, filter, and frame adapter products", () => {
    const source = {
      id: "source",
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const filter = {
      id: "filter",
      apply: vi.fn((frame: never) => frame),
      reset: vi.fn(),
    };
    const adapter = {
      id: "adapter",
      initialize: vi.fn(async () => {}),
      updateFrame: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const plugin: MotionRuntimePlugin = {
      id: "synthetic",
      register(registry) {
        registry.addSourceFactory({
          type: "synthetic",
          create: (config) => {
            expect(config).toEqual({ rate: 60 });
            return source;
          },
        });
        registry.addFilterFactory({ type: "double", create: () => filter });
        registry.addFrameAdapterFactory({ type: "capture", create: () => adapter });
      },
    };

    const registry = registerMotionRuntimePlugins([plugin]);
    expect(registry.createSource("synthetic", { rate: 60 })).toBe(source);
    expect(registry.createFilter("double", {})).toBe(filter);
    expect(registry.createFrameAdapter("capture", {})).toBe(adapter);
  });

  it("rejects empty, duplicate, and unknown capability types", () => {
    const registry = createMotionRuntimeRegistry();
    const createSource = () => ({
      id: "stub-source",
      start: async () => {},
      stop: async () => {},
    });
    expect(() => registry.addSourceFactory({ type: "", create: createSource })).toThrow(
      "non-empty",
    );
    registry.addSourceFactory({ type: "same", create: createSource });
    expect(() =>
      registry.addSourceFactory({ type: "same", create: createSource }),
    ).toThrow("already registered");
    expect(() => registry.createFilter("missing", {})).toThrow(
      "Unknown motion filter factory",
    );
  });

  it("allows one shared type ID in different capability namespaces", () => {
    const registry = createMotionRuntimeRegistry();
    registry.addSourceFactory({
      type: "vmc",
      create: () => ({ id: "vmc-in", start: async () => {}, stop: async () => {} }),
    });
    registry.addFrameAdapterFactory({
      type: "vmc",
      create: () => ({
        id: "vmc-out",
        initialize: async () => {},
        updateFrame: async () => {},
        dispose: async () => {},
      }),
    });
  });

  it("registers plugins in order and preserves factory errors", () => {
    const order: string[] = [];
    const failure = new Error("invalid filter config");
    const registry = registerMotionRuntimePlugins([
      { id: "first", register: () => order.push("first") },
      {
        id: "second",
        register(registry) {
          order.push("second");
          registry.addFilterFactory({
            type: "broken",
            create: () => {
              throw failure;
            },
          });
        },
      },
    ]);

    expect(order).toEqual(["first", "second"]);
    expect(() => registry.createFilter("broken", {})).toThrow(failure);
  });
});
