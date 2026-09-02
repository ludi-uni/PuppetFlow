import { describe, expect, it } from "vitest";
import { VMC_PROFILE } from "@puppetflow/motion-mapper";
import { NodeOscAdapter, type OscTransport } from "./node-osc-adapter.js";

function createTransport() {
  const sent: Uint8Array[] = [];
  const transport: OscTransport = {
    send: async (packet) => {
      sent.push(packet);
    },
  };
  return { sent, transport };
}

function decode(packet: Uint8Array): string {
  return new TextDecoder().decode(packet);
}

function readOscString(packet: Uint8Array, offset: number): [string, number] {
  const end = packet.indexOf(0, offset);
  if (end < 0) {
    throw new Error("OSC string terminator is missing");
  }
  return [
    new TextDecoder().decode(packet.slice(offset, end)),
    Math.ceil((end + 1) / 4) * 4,
  ];
}

function readBundleAddresses(packet: Uint8Array): string[] {
  const [header] = readOscString(packet, 0);
  expect(header).toBe("#bundle");
  const addresses: string[] = [];
  let offset = 16;
  while (offset < packet.length) {
    const size = new DataView(packet.buffer, packet.byteOffset + offset, 4).getUint32(
      0,
    );
    offset += 4;
    const [address] = readOscString(packet.slice(offset, offset + size), 0);
    addresses.push(address);
    offset += size;
  }
  return addresses;
}

describe("NodeOscAdapter.updateFrame", () => {
  it("sends one Bundle for complete bones and blendshapes", async () => {
    const { sent, transport } = createTransport();
    const adapter = new NodeOscAdapter({ id: "test", profile: VMC_PROFILE, transport });

    await adapter.updateFrame(
      {
        timestamp: 0,
        bones: {
          Head: {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
        blendShapes: { Smile: 0.5 },
      },
      1 / 60,
    );

    expect(sent).toHaveLength(1);
    expect(decode(sent[0])).toContain("#bundle");
    expect(decode(sent[0])).toContain("/VMC/Ext/Bone/Pos");
    expect(decode(sent[0])).toContain("/VMC/Ext/Blend/Val");
    expect(readBundleAddresses(sent[0])).toEqual([
      "/VMC/Ext/Bone/Pos",
      "/VMC/Ext/Blend/Val",
      "/VMC/Ext/Blend/Apply",
    ]);
  });

  it("does not append Blend/Apply for bone-only frames", async () => {
    const { sent, transport } = createTransport();
    const adapter = new NodeOscAdapter({ id: "test", profile: VMC_PROFILE, transport });

    await adapter.updateFrame(
      {
        timestamp: 0,
        bones: {
          Head: {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      },
      1 / 60,
    );

    expect(readBundleAddresses(sent[0])).toEqual(["/VMC/Ext/Bone/Pos"]);
  });

  it("omits incomplete bones and maps canonical parameters through the profile", async () => {
    const { sent, transport } = createTransport();
    const adapter = new NodeOscAdapter({ id: "test", profile: VMC_PROFILE, transport });

    await adapter.updateFrame(
      {
        timestamp: 0,
        bones: { Head: { rotation: { x: 0, y: 0, z: 0, w: 1 } } },
        parameters: { mouthX: 0.4 },
      },
      1 / 60,
    );

    expect(sent).toHaveLength(1);
    const packetText = decode(sent[0]);
    expect(packetText).not.toContain("/VMC/Ext/Bone/Pos");
    expect(packetText).toContain("ParamMouthForm");
  });

  it("throttles frame output using the configured monotonic clock", async () => {
    const { sent, transport } = createTransport();
    let now = 0;
    const adapter = new NodeOscAdapter({
      id: "test",
      profile: VMC_PROFILE,
      transport,
      outputRateHz: 10,
      now: () => now,
    });
    const frame = { timestamp: 0, blendShapes: { Smile: 0.5 } };

    await adapter.updateFrame(frame, 0.05);
    now = 50;
    await adapter.updateFrame(frame, 0.05);
    now = 100;
    await adapter.updateFrame(frame, 0.05);

    expect(sent).toHaveLength(2);
  });

  it("uses frame-unix only for frames explicitly marked as Unix time", async () => {
    const { sent, transport } = createTransport();
    const adapter = new NodeOscAdapter({
      id: "test",
      profile: VMC_PROFILE,
      transport,
      timestampMode: "frame-unix",
      now: () => 1_800_000_000_000,
    });

    await adapter.updateFrame(
      { timestamp: 1_700_000_000_000, blendShapes: { Smile: 0.5 } },
      0,
    );
    const fallbackBundle = sent[0];
    await adapter.updateFrame(
      {
        timestamp: 1_700_000_000_000,
        metadata: { clock: "unix" },
        blendShapes: { Smile: 0.5 },
      },
      0,
    );

    expect(
      new DataView(fallbackBundle.buffer, fallbackBundle.byteOffset).getUint32(8),
    ).not.toBe(0xe8fe6f80);
    expect(new DataView(sent[1].buffer, sent[1].byteOffset).getUint32(8)).toBe(
      0xe8fe6f80,
    );
  });
});

describe("NodeOscAdapter.update", () => {
  it("sends Blend/Apply last after mapped Blend/Val packets", async () => {
    const { sent, transport } = createTransport();
    const adapter = new NodeOscAdapter({ id: "test", profile: VMC_PROFILE, transport });

    await adapter.update(
      {
        mouthX: 0.4,
        custom: {},
      },
      1 / 60,
    );

    const addresses = sent.map((packet) => readOscString(packet, 0)[0]);
    expect(addresses.at(-1)).toBe("/VMC/Ext/Blend/Apply");
    expect(addresses.slice(0, -1)).toSatisfy(
      (values: string[]) =>
        values.length > 0 && values.every((value) => value === "/VMC/Ext/Blend/Val"),
    );
  });
});
