import type {
  SourceUpdateTarget,
  StateSource,
  StateSourceUpdate,
} from "@puppetflow/source-core";

const LIP_SYNC_STALE_MS = 500;
const AVATAR_RECONNECT_MS = 1000;
const AVATAR_CONNECT_TIMEOUT_MS = 5000;
const AVATAR_LIP_SYNC_KEYS = [
  ["MouthA", "weightA"],
  ["MouthI", "weightI"],
  ["MouthU", "weightU"],
  ["MouthE", "weightE"],
  ["MouthO", "weightO"],
] as const;
const LIP_SYNC_STATE_KEYS = [
  ...AVATAR_LIP_SYNC_KEYS.map(([, key]) => key),
  "volume",
  "mouthOpen",
  "mouthY",
  "strength",
] as const;

export interface AvatarPollingSource {
  initialize(): Promise<void>;
  poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined>;
  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void;
  dispose(): Promise<void>;
}

export interface AvatarLipSyncSource extends StateSource {
  readonly id: "avatar-lip-sync";
}

export function createAvatarLipSyncSource(
  source: AvatarPollingSource,
  { now = () => performance.now() }: { now?: () => number } = {},
): AvatarLipSyncSource {
  let active = false;
  let connection:
    | {
        startedAt: number;
        connected: boolean;
        failed: boolean;
        controller: AbortController;
      }
    | undefined;
  let lastInputAt = 0;
  let lastLipSyncAt: number | undefined;
  let lastTarget: SourceUpdateTarget | undefined;

  function connect(): void {
    const attempt = {
      startedAt: now(),
      connected: false,
      failed: false,
      controller: new AbortController(),
    };
    connection = attempt;
    lastLipSyncAt = undefined;
    void Promise.resolve()
      .then(() => {
        if (active && connection === attempt) return source.initialize();
      })
      .then(
        () => {
          if (active && connection === attempt) {
            attempt.connected = true;
            lastInputAt = now();
          }
        },
        () => {
          if (connection === attempt) attempt.failed = true;
        },
      );
  }

  function clearLipSync(target: SourceUpdateTarget): void {
    for (const key of LIP_SYNC_STATE_KEYS) target.state.set(key, 0);
    target.state.set("phoneme", "");
    target.state.set("silenceFactor", 1);
  }

  function applyMouth(target: SourceUpdateTarget): void {
    target.motion.applyPayload({
      custom: Object.fromEntries(
        AVATAR_LIP_SYNC_KEYS.map(([mouth, key]) => [
          mouth,
          finiteStateNumber(target.state.get(key)),
        ]),
      ),
    });
  }

  return {
    id: "avatar-lip-sync",
    async initialize() {
      if (active) return;
      active = true;
      connect();
    },
    async update(target) {
      if (!active) return;
      lastTarget = target;
      const attempt = connection;
      if (!attempt) return;
      if (attempt.connected && !attempt.failed) {
        try {
          const update = await source.poll(attempt.controller.signal);
          if (!active || connection !== attempt) return;
          if (update) {
            source.apply(update, target);
            lastInputAt = now();
            const state =
              typeof update.payload === "object" &&
              update.payload !== null &&
              "state" in update.payload
                ? (update.payload as { state?: unknown }).state
                : undefined;
            const record = state ?? update.payload;
            if (
              record &&
              typeof record === "object" &&
              LIP_SYNC_STATE_KEYS.some((key) => {
                const value = (record as Record<string, unknown>)[key];
                return typeof value === "number" && Number.isFinite(value);
              })
            )
              lastLipSyncAt = now();
          }
        } catch {
          if (!active || connection !== attempt) return;
          attempt.failed = true;
        }
      }
      const time = now();
      if (
        attempt.failed ||
        lastLipSyncAt === undefined ||
        time - lastLipSyncAt >= LIP_SYNC_STALE_MS
      )
        clearLipSync(target);
      applyMouth(target);
      const retry =
        attempt.failed ||
        (attempt.connected
          ? time - lastInputAt >= AVATAR_RECONNECT_MS
          : time - attempt.startedAt >= AVATAR_CONNECT_TIMEOUT_MS);
      if (retry && time - attempt.startedAt >= AVATAR_RECONNECT_MS) {
        connection = undefined;
        attempt.controller.abort();
        await source.dispose();
        if (active) connect();
      }
    },
    async dispose() {
      active = false;
      connection?.controller.abort();
      connection = undefined;
      lastLipSyncAt = undefined;
      if (lastTarget) {
        clearLipSync(lastTarget);
        applyMouth(lastTarget);
        lastTarget = undefined;
      }
      await source.dispose();
    },
  };
}

function finiteStateNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
