import { describe, expect, it } from "vitest";
import { encodeBlendShapeMessage } from "./osc-encoder.js";

describe("encodeBlendShapeMessage", () => {
  it("encodes a VMC blend shape packet", () => {
    const packet = encodeBlendShapeMessage("ParamMouthSmile", 0.4);

    expect(packet.length % 4).toBe(0);
    expect(packet.length).toBeGreaterThan(0);
  });
});
