import type { MotionSource } from "@puppetflow/source-core";
import { MotionFrameRecorder } from "@puppetflow/motion-recording";
import { MotionStateFrameSource } from "@puppetflow/source-core";
import { buildRuntime } from "@puppetflow/runtime-launcher/node";
import { resolveRunLaunchConfig } from "../config/resolve-run-config.js";
import type { RunCliOptions } from "../config/run-config.js";

export interface RecordCliOptions extends RunCliOptions {
  output: string;
  durationMs?: number;
}

export function validateRecordOptions(options: RecordCliOptions): RecordCliOptions {
  if (!options.output.trim()) {
    throw new Error("Record output path is required.");
  }
  if (
    options.durationMs !== undefined &&
    (!Number.isInteger(options.durationMs) || options.durationMs < 0)
  ) {
    throw new Error("Record duration must be a non-negative integer.");
  }
  return options;
}

export async function recordCommand(options: RecordCliOptions): Promise<void> {
  const validated = validateRecordOptions(options);
  const launchConfig = await resolveRunLaunchConfig({
    ...validated,
    vmcDisabled: true,
    loggerDisabled: true,
    websocketDisabled: true,
    behaviorDisabled: true,
  });
  const runtime = buildRuntime(launchConfig);
  const recorder = new MotionFrameRecorder(validated.output, {
    metadata: { sourceType: "motion-state", command: "pf record" },
  });
  await recorder.start();

  let recordingQueue = Promise.resolve();
  const stateSource = new MotionStateFrameSource(() => runtime.getRenderedMotion(), {
    id: "record",
  });
  const source: MotionSource = {
    id: stateSource.id,
    async start(emit) {
      await stateSource.start((frame) => {
        emit(frame);
        recordingQueue = recordingQueue.then(() => recorder.record(frame));
      });
    },
    stop: () => stateSource.stop(),
  };
  runtime.attachMotionSource(source);

  try {
    await runtime.start();
    await waitForStopSignal(validated.durationMs);
  } finally {
    await runtime.stop();
    await recordingQueue;
    await recorder.stop();
  }
}

function waitForStopSignal(durationMs: number | undefined): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGBREAK"];
    const onSignal = () => finish();
    const finish = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      for (const signal of signals) {
        process.off(signal, onSignal);
      }
      resolve();
    };

    for (const signal of signals) {
      process.once(signal, onSignal);
    }
    if (durationMs !== undefined) {
      timer = setTimeout(finish, durationMs);
    }
  });
}
