import type { BoneTransform } from "@puppetflow/core";

export type DecodedVmcEvent =
  | { kind: "root"; name: string; transform: BoneTransform }
  | { kind: "bone"; name: string; transform: BoneTransform }
  | { kind: "blend"; name: string; value: number }
  | { kind: "blend-apply" };

interface OscArgument {
  type: string;
  value: string | number;
}

interface DecodedOscMessage {
  address: string;
  arguments: OscArgument[];
}

export function decodeVmcPacket(packet: Uint8Array): DecodedVmcEvent[] {
  return decodeOscPacket(packet).flatMap(toVmcEvents);
}

function decodeOscPacket(packet: Uint8Array): DecodedOscMessage[] {
  if (isBundle(packet)) {
    return decodeBundle(packet);
  }
  return [decodeMessage(packet)];
}

function isBundle(packet: Uint8Array): boolean {
  return packet.length >= 8 && readString(packet, 0).value === "#bundle";
}

function decodeBundle(packet: Uint8Array): DecodedOscMessage[] {
  if (packet.length < 16) {
    throw new Error("OSC bundle is truncated");
  }

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const messages: DecodedOscMessage[] = [];
  let offset = 16;
  while (offset < packet.length) {
    if (offset + 4 > packet.length) {
      throw new Error("OSC bundle element size is truncated");
    }
    const size = view.getUint32(offset, false);
    offset += 4;
    if (size === 0 || offset + size > packet.length) {
      throw new Error("OSC bundle element is invalid");
    }
    messages.push(...decodeOscPacket(packet.subarray(offset, offset + size)));
    offset += size;
  }
  return messages;
}

function decodeMessage(packet: Uint8Array): DecodedOscMessage {
  const address = readString(packet, 0);
  const tags = readString(packet, address.nextOffset);
  if (!tags.value.startsWith(",")) {
    throw new Error("OSC type tag string must start with a comma");
  }

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const args: OscArgument[] = [];
  let offset = tags.nextOffset;
  for (const type of tags.value.slice(1)) {
    if (type === "s") {
      const decoded = readString(packet, offset);
      args.push({ type, value: decoded.value });
      offset = decoded.nextOffset;
      continue;
    }
    if (type === "f") {
      ensureAvailable(packet, offset, 4);
      args.push({ type, value: view.getFloat32(offset, false) });
      offset += 4;
      continue;
    }
    if (type === "i") {
      ensureAvailable(packet, offset, 4);
      args.push({ type, value: view.getInt32(offset, false) });
      offset += 4;
      continue;
    }
    throw new Error(`Unsupported OSC argument type: ${type}`);
  }

  return { address: address.value, arguments: args };
}

function toVmcEvents(message: DecodedOscMessage): DecodedVmcEvent[] {
  if (
    message.address === "/VMC/Ext/Bone/Pos" ||
    message.address === "/VMC/Ext/Root/Pos"
  ) {
    const values = message.arguments.map((argument) => argument.value);
    if (
      values.length < 8 ||
      typeof values[0] !== "string" ||
      values.slice(1, 8).some((value) => typeof value !== "number")
    ) {
      throw new Error(`${message.address} has an invalid argument shape`);
    }
    const numbers = values.slice(1, 8) as number[];
    if (numbers.some((value) => !Number.isFinite(value))) {
      throw new Error(message.address + " values must be finite");
    }
    const transform: BoneTransform = {
      position: { x: numbers[0]!, y: numbers[1]!, z: numbers[2]! },
      rotation: {
        x: numbers[3]!,
        y: numbers[4]!,
        z: numbers[5]!,
        w: numbers[6]!,
      },
    };
    return [
      message.address.endsWith("Root/Pos")
        ? { kind: "root", name: values[0], transform }
        : { kind: "bone", name: values[0], transform },
    ];
  }

  if (message.address === "/VMC/Ext/Blend/Val") {
    const [name, value] = message.arguments.map((argument) => argument.value);
    if (typeof name !== "string" || typeof value !== "number") {
      throw new Error("/VMC/Ext/Blend/Val has an invalid argument shape");
    }
    if (!Number.isFinite(value)) {
      throw new Error("/VMC/Ext/Blend/Val value must be finite");
    }
    return [{ kind: "blend", name, value }];
  }

  if (message.address === "/VMC/Ext/Blend/Apply") {
    return [{ kind: "blend-apply" }];
  }

  return [];
}

function readString(
  packet: Uint8Array,
  offset: number,
): { value: string; nextOffset: number } {
  if (offset >= packet.length) {
    throw new Error("OSC string is truncated");
  }
  let end = offset;
  while (end < packet.length && packet[end] !== 0) {
    end += 1;
  }
  if (end >= packet.length) {
    throw new Error("OSC string is not null terminated");
  }
  const value = new TextDecoder().decode(packet.subarray(offset, end));
  const nextOffset = Math.ceil((end + 1) / 4) * 4;
  if (nextOffset > packet.length) {
    throw new Error("OSC string padding is truncated");
  }
  return { value, nextOffset };
}

function ensureAvailable(packet: Uint8Array, offset: number, length: number): void {
  if (offset + length > packet.length) {
    throw new Error("OSC argument is truncated");
  }
}
