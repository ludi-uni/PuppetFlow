function encodeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(`${value}\0`);
  const padding = (4 - (bytes.length % 4)) % 4;
  const padded = new Uint8Array(bytes.length + padding);
  padded.set(bytes);
  return padded;
}

function encodeFloat(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, false);
  return new Uint8Array(buffer);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

export function encodeBlendShapeMessage(blendName: string, value: number): Uint8Array {
  return concatChunks([
    encodeString("/VMC/Ext/Blend/Val"),
    encodeString(",sf"),
    encodeString(blendName),
    encodeFloat(value),
  ]);
}
