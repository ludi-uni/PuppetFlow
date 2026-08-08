import { describe, expect, it } from "vitest";
import { encodeBlendShapeMessage, encodeBonePoseMessage } from "./osc-encoder.js";

function readOscString(packet: Uint8Array, offset: number): [string, number] {
  const end = packet.indexOf(0, offset);
  if (end < 0) {
    throw new Error("OSC string terminator is missing");
  }
  const nextOffset = Math.ceil((end + 1) / 4) * 4;
  return [new TextDecoder().decode(packet.slice(offset, end)), nextOffset];
}

function readFloatArguments(packet: Uint8Array): number[] {
  let offset = 0;
  const [_address, afterAddress] = readOscString(packet, offset);
  offset = afterAddress;
  const [typeTag, afterTypeTag] = readOscString(packet, offset);
  expect(typeTag).toBe(",sfffffff");
  offset = afterTypeTag;
  const [_boneName, afterBoneName] = readOscString(packet, offset);
  offset = afterBoneName;

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  return Array.from({ length: 7 }, (_, index) => view.getFloat32(offset + index * 4, false));
}

describe("encodeBlendShapeMessage", () => {
  it("encodes a VMC blend shape packet", () => {
    const packet = encodeBlendShapeMessage("ParamMouthSmile", 0.4);

    expect(packet.length % 4).toBe(0);
    expect(packet.length).toBeGreaterThan(0);
  });
});

describe("encodeBonePoseMessage", () => {
  it("encodes VMC Bone/Pos position and quaternion in x,y,z,w order", () => {
    const packet = encodeBonePoseMessage("Head", {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
    });

    expect(packet).not.toBeNull();
    expect(new TextDecoder().decode(packet as Uint8Array)).toContain("/VMC/Ext/Bone/Pos");
    expect(readFloatArguments(packet as Uint8Array)).toEqual([
      1,
      2,
      3,
      expect.closeTo(0.1, 5),
      expect.closeTo(0.2, 5),
      expect.closeTo(0.3, 5),
      expect.closeTo(0.4, 5),
    ]);
  });

  it("omits a partial bone instead of synthesizing a transform", () => {
    expect(
      encodeBonePoseMessage("Head", {
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      }),
    ).toBeNull();
  });
});
