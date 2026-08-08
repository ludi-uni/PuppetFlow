import { createWriteStream, createReadStream, type WriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { normalizeMotionFrame, type MotionFrame } from "@puppetflow/core";

export interface MotionRecordingHeader {
  type: "header";
  format: "puppetflow-motion";
  version: 1;
  timeUnit: "ms";
  metadata: Record<string, unknown>;
}

export interface MotionFrameRecorderOptions {
  metadata?: Record<string, unknown>;
}

export class MotionFrameRecorder {
  private readonly path: string;
  private readonly metadata: Record<string, unknown>;
  private stream: WriteStream | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(path: string, options: MotionFrameRecorderOptions = {}) {
    this.path = path;
    this.metadata = { ...(options.metadata ?? {}) };
  }

  async start(): Promise<void> {
    if (this.stream) {
      throw new Error("MotionFrameRecorder is already started");
    }

    const stream = createWriteStream(this.path, { encoding: "utf8" });
    this.stream = stream;
    await waitForStreamOpen(stream);
    await this.enqueue({
      type: "header",
      format: "puppetflow-motion",
      version: 1,
      timeUnit: "ms",
      metadata: this.metadata,
    });
  }

  record(frame: MotionFrame): Promise<void> {
    if (!this.stream) {
      return Promise.reject(new Error("MotionFrameRecorder is not started"));
    }
    return this.enqueue({ type: "frame", frame: normalizeMotionFrame(frame) });
  }

  async stop(): Promise<void> {
    const stream = this.stream;
    if (!stream) {
      return;
    }

    await this.writeQueue;
    this.stream = null;
    await finishStream(stream);
  }

  private enqueue(
    record: MotionRecordingHeader | { type: "frame"; frame: MotionFrame },
  ): Promise<void> {
    const line = `${JSON.stringify(record)}\n`;
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.stream) {
        throw new Error("MotionFrameRecorder is not started");
      }
      await writeChunk(this.stream, line);
    });
    return this.writeQueue;
  }
}

export async function* readMotionRecording(
  path: string,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<MotionFrame> {
  const stream = createReadStream(path, { encoding: "utf8", signal: options.signal });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  let headerSeen = false;
  let lineNumber = 0;

  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) {
        continue;
      }

      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON at line ${lineNumber}`, { cause: error });
      }

      if (!headerSeen) {
        validateHeader(record, lineNumber);
        headerSeen = true;
        continue;
      }

      if (!isRecord(record) || typeof record.type !== "string") {
        throw new Error(`Invalid recording record at line ${lineNumber}`);
      }
      if (record.type !== "frame") {
        continue;
      }

      try {
        yield normalizeMotionFrame(record.frame);
      } catch (error) {
        throw new Error(`Invalid motion frame at line ${lineNumber}`, { cause: error });
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }

  if (!headerSeen) {
    throw new Error("Motion recording header is missing");
  }
}

function validateHeader(
  value: unknown,
  lineNumber: number,
): asserts value is MotionRecordingHeader {
  if (
    !isRecord(value) ||
    value.type !== "header" ||
    value.format !== "puppetflow-motion" ||
    value.version !== 1 ||
    value.timeUnit !== "ms" ||
    !isRecord(value.metadata)
  ) {
    throw new Error(`Invalid motion recording header at line ${lineNumber}`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function waitForStreamOpen(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      stream.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      stream.off("open", onOpen);
      reject(error);
    };
    stream.once("open", onOpen);
    stream.once("error", onError);
  });
}

async function writeChunk(stream: WriteStream, chunk: string): Promise<void> {
  if (stream.write(chunk)) {
    return;
  }
  await once(stream, "drain");
}

async function finishStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onFinish = () => {
      stream.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      stream.off("finish", onFinish);
      reject(error);
    };
    stream.once("finish", onFinish);
    stream.once("error", onError);
    stream.end();
  });
}
