import { describe, expect, it } from "vitest";
import { normalizeMotionFrame } from "@puppetflow/core";

import { applyVmcEvents, createVmcFrameState } from "./normalize.js";
import { resolveVmcInputProfile } from "./profiles.js";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 } as const;

describe("VMC input normalization", () => {
  it("retains prior bones when later packets omit them", () => {
    const state = createVmcFrameState();
    const profile = resolveVmcInputProfile("generic-vmc");
    applyVmcEvents(
      state,
      [
        {
          kind: "bone",
          name: "Head",
          transform: { rotation: IDENTITY },
        },
      ],
      profile,
      1,
    );

    const frame = applyVmcEvents(
      state,
      [
        {
          kind: "bone",
          name: "Hips",
          transform: { position: { x: 0, y: 0.9, z: 0 } },
        },
      ],
      profile,
      2,
    );

    expect(frame?.bones).toEqual({
      Head: { rotation: IDENTITY },
      Hips: { position: { x: 0, y: 0.9, z: 0 } },
    });
  });

  it.each(["bone", "blend"] as const)(
    "does not retain invalid %s events or lose earlier state",
    (kind) => {
      for (const value of [NaN, Infinity, -Infinity]) {
        const state = createVmcFrameState();
        const profile = resolveVmcInputProfile("generic-vmc");
        applyVmcEvents(
          state,
          [{ kind: "bone", name: "Hips", transform: { rotation: IDENTITY } }],
          profile,
          1,
        );
        const before = structuredClone(state);
        const invalid =
          kind === "bone"
            ? {
                kind: "bone" as const,
                name: "LeftToes",
                transform: { position: { x: value, y: 0, z: 0 } },
              }
            : { kind: "blend" as const, name: "Joy", value };

        expect(() =>
          applyVmcEvents(
            state,
            [
              { kind: "bone", name: "Head", transform: { rotation: IDENTITY } },
              invalid,
            ],
            profile,
            2,
          ),
        ).toThrow(/finite/);
        expect(state).toEqual(before);

        const recovered = applyVmcEvents(
          state,
          [{ kind: "bone", name: "Head", transform: { rotation: IDENTITY } }],
          profile,
          3,
        )!;
        expect(() => normalizeMotionFrame(recovered)).not.toThrow();
        expect(recovered.bones).toEqual({
          Hips: { rotation: IDENTITY },
          Head: { rotation: IDENTITY },
        });
        expect(recovered.blendShapes).toEqual({});
      }
    },
  );

  it("does not retain a transform that overflows after position scaling", () => {
    const state = createVmcFrameState();
    expect(() =>
      applyVmcEvents(
        state,
        [
          {
            kind: "root",
            name: "root",
            transform: {
              position: { x: Number.MAX_VALUE, y: 0, z: 0 },
              rotation: IDENTITY,
            },
          },
        ],
        resolveVmcInputProfile("generic-vmc", { positionScale: 2 }),
        1,
      ),
    ).toThrow(/finite/);
    expect(state).toEqual(createVmcFrameState());
    const recovered = applyVmcEvents(
      state,
      [{ kind: "bone", name: "Head", transform: { rotation: IDENTITY } }],
      resolveVmcInputProfile("generic-vmc"),
      2,
    )!;
    expect(() => normalizeMotionFrame(recovered)).not.toThrow();
  });

  it("applies scale and existing retarget overrides after the preset", () => {
    const profile = resolveVmcInputProfile("custom", {
      positionScale: 2,
      retarget: {
        mapping: { Hips: "Pelvis" },
        bones: { Hips: { positionOffset: { x: 1, y: 0, z: 0 } } },
      },
    });

    const frame = applyVmcEvents(
      createVmcFrameState(),
      [
        {
          kind: "bone",
          name: "Hips",
          transform: { position: { x: 0.25, y: 0.5, z: 0 } },
        },
      ],
      profile,
      1,
    );

    expect(frame?.bones).toEqual({
      Pelvis: { position: { x: 1.5, y: 1, z: 0 } },
    });
  });

  it("does not crash when optional bones and positions are missing", () => {
    const frame = applyVmcEvents(
      createVmcFrameState(),
      [{ kind: "bone", name: "Head", transform: { rotation: IDENTITY } }],
      resolveVmcInputProfile("mocopi-compatible"),
      1,
    );

    expect(frame?.bones).toEqual({ Head: { rotation: IDENTITY } });
  });

  it("keeps mocopi-like root motion and ignores anchored SlimeVR root", () => {
    const event = {
      kind: "root" as const,
      name: "root",
      transform: { position: { x: 0.1, y: 0, z: 0 }, rotation: IDENTITY },
    };

    expect(
      applyVmcEvents(
        createVmcFrameState(),
        [event],
        resolveVmcInputProfile("slimevr-compatible"),
        1,
      ),
    ).toBeUndefined();
    expect(
      applyVmcEvents(
        createVmcFrameState(),
        [event],
        resolveVmcInputProfile("mocopi-compatible"),
        1,
      )?.bones?.Root,
    ).toEqual(event.transform);
  });
});
