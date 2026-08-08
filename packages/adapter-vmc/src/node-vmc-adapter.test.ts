import { describe, expect, it } from "vitest";
import { VMC_PROFILE } from "@puppetflow/motion-mapper";
import { NodeVmcAdapter } from "./node-vmc-adapter.js";
import type { OscTransport } from "./node-osc-adapter.js";

describe("NodeVmcAdapter frame capability", () => {
  it("delegates canonical frames through the injected transport", async () => {
    const sent: Uint8Array[] = [];
    const transport: OscTransport = {
      send: async (packet) => {
        sent.push(packet);
      },
    };
    const adapter = new NodeVmcAdapter({ profile: VMC_PROFILE, transport });

    await adapter.updateFrame({ timestamp: 0, blendShapes: { Smile: 0.25 } }, 1 / 60);

    expect(adapter.id).toBe("vmc-node");
    expect(sent).toHaveLength(1);
  });
});
