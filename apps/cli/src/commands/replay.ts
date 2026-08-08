import { NodeVmcAdapter } from "@puppetflow/adapter-vmc/node";
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { ReplaySource } from "@puppetflow/motion-recording";

export interface ReplayCliOptions {
  input: string;
  speed?: number;
  loop?: boolean;
  startOffsetMs?: number;
  vmcHost?: string;
  vmcPort?: number;
}

export function validateReplayOptions(options: ReplayCliOptions): ReplayCliOptions {
  if (!options.input.trim()) {
    throw new Error("Replay input path is required.");
  }
  if (
    options.speed !== undefined &&
    (!Number.isFinite(options.speed) || options.speed <= 0)
  ) {
    throw new Error("Replay speed must be a positive number.");
  }
  if (
    options.startOffsetMs !== undefined &&
    (!Number.isFinite(options.startOffsetMs) || options.startOffsetMs < 0)
  ) {
    throw new Error("Replay start offset must be non-negative.");
  }
  if (
    options.vmcPort !== undefined &&
    (!Number.isInteger(options.vmcPort) ||
      options.vmcPort < 1 ||
      options.vmcPort > 65535)
  ) {
    throw new Error("Replay VMC port must be between 1 and 65535.");
  }
  return options;
}

export async function replayCommand(options: ReplayCliOptions): Promise<void> {
  const validated = validateReplayOptions(options);
  const runtime = new PuppetFlowRuntime();
  const source = new ReplaySource(validated.input, {
    speed: validated.speed,
    loop: validated.loop,
    startOffsetMs: validated.startOffsetMs,
  });
  const adapter = new NodeVmcAdapter({
    host: validated.vmcHost,
    port: validated.vmcPort,
  });
  runtime.attachMotionSource(source).attachMotionAdapter(adapter);

  await runtime.start();
  const signalWaiter = waitForSignal();
  try {
    await Promise.race([source.waitUntilFinished(), signalWaiter.promise]);
  } finally {
    signalWaiter.cancel();
    await runtime.stop();
  }
}

function waitForSignal(): { promise: Promise<void>; cancel: () => void } {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGBREAK"];
  let resolvePromise: (() => void) | undefined;
  const onSignal = () => {
    cleanup();
    resolvePromise?.();
  };
  const cleanup = () => {
    for (const signal of signals) {
      process.off(signal, onSignal);
    }
  };
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
    for (const signal of signals) {
      process.once(signal, onSignal);
    }
  });
  return { promise, cancel: cleanup };
}
