import { describe, expect, it } from "vitest";

import type { BoneTransform } from "@puppetflow/core";
import {
  encodeBlendShapeMessage,
  encodeBonePoseMessage,
  encodeOscBundle,
} from "../../adapter-vmc/src/index.js";

import { decodeVmcPacket } from "./osc-decoder.js";

const HEAD: BoneTransform = {
  position: { x: 0, y: 1.6, z: 0.1 },
  rotation: { x: 0, y: 0.25, z: 0, w: 1 },
};

describe("decodeVmcPacket", () => {
  it("decodes a VMC Bone/Pos message", () => {
    const message = encodeBonePoseMessage("Head", HEAD)!;

    const [decoded] = decodeVmcPacket(message);

    expect(decoded).toMatchObject({ kind: "bone", name: "Head" });
    if (decoded?.kind !== "bone") {
      throw new Error("expected a decoded bone");
    }
    expect(decoded.transform.position?.y).toBeCloseTo(1.6);
    expect(decoded.transform.position?.z).toBeCloseTo(0.1);
    expect(decoded.transform.rotation).toEqual(HEAD.rotation);
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects non-finite transform values (%s)",
    (value) => {
      for (const address of ["/VMC/Ext/Bone/Pos", "/VMC/Ext/Root/Pos"]) {
        const packet = encodeBonePoseMessage("Head", HEAD)!;
        packet.set(new TextEncoder().encode(address), 0);
        new DataView(packet.buffer, packet.byteOffset, packet.byteLength).setFloat32(
          packet.byteLength - 4,
          value,
          false,
        );
        expect(() => decodeVmcPacket(packet)).toThrow(/finite/);
      }
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    "rejects non-finite blend values (%s)",
    (value) => {
      const packet = encodeBlendShapeMessage("Joy", 0);
      new DataView(packet.buffer, packet.byteOffset, packet.byteLength).setFloat32(
        packet.byteLength - 4,
        value,
        false,
      );
      expect(() => decodeVmcPacket(packet)).toThrow(/finite/);
    },
  );

  it("decodes all supported messages from an OSC bundle", () => {
    const head = encodeBonePoseMessage("Head", HEAD)!;
    const hips = encodeBonePoseMessage("Hips", {
      position: { x: 0, y: 0.9, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    })!;

    expect(decodeVmcPacket(encodeOscBundle([head, hips]))).toHaveLength(2);
  });

  it("ignores unrelated OSC messages without crashing", () => {
    const unrelated = new Uint8Array([47, 102, 111, 111, 0, 0, 0, 0, 44, 0, 0, 0]);

    expect(decodeVmcPacket(unrelated)).toEqual([]);
  });
});
