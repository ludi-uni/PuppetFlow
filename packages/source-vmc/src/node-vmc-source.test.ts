import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";

import { encodeBonePoseMessage } from "../../adapter-vmc/src/index.js";

import { NodeVmcSource } from "./node-vmc-source.js";

describe("NodeVmcSource", () => {
  it("receives UDP VMC and accumulates partial bone packets", async () => {
    const source = new NodeVmcSource({ port: 0, profile: "generic-vmc" });
    const frames: Parameters<Parameters<typeof source.start>[0]>[0][] = [];
    await source.start((frame) => frames.push(frame));
    const address = source.address();
    const sender = createSocket("udp4");

    try {
      sender.send(
        encodeBonePoseMessage("Head", {
          position: { x: 0, y: 1.6, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        })!,
        address.port,
        address.address,
      );
      sender.send(
        encodeBonePoseMessage("Hips", {
          position: { x: 0, y: 0.9, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        })!,
        address.port,
        address.address,
      );

      await waitFor(() =>
        frames.some((frame) => Object.keys(frame.bones ?? {}).length === 2),
      );
      expect(frames.at(-1)?.bones).toEqual(
        expect.objectContaining({ Head: expect.any(Object), Hips: expect.any(Object) }),
      );
    } finally {
      sender.close();
      await source.stop();
    }
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error("timed out waiting for VMC frame");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
