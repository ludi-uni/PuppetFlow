import { applyInputPayload } from "@puppetflow/source-core";
import type {
  PollingStateSource,
  SourceUpdateTarget,
  StateSourceUpdate,
} from "@puppetflow/source-core";
import mqtt, { type MqttClient } from "mqtt";

export interface MqttSourceConfig {
  brokerUrl: string;
  topic: string;
  fieldMapping?: Record<string, string>;
}

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface PendingMqttInitialization {
  client: MqttClient;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class MqttSource implements PollingStateSource {
  readonly id = "mqtt";
  readonly pollIntervalMs = 16;

  private readonly brokerUrl: string;
  private readonly topic: string;
  private readonly fieldMapping: Readonly<Record<string, string>>;
  private client: MqttClient | null = null;
  private pendingPayload: unknown | undefined;
  private pendingInitialization: PendingMqttInitialization | null = null;

  constructor(config: MqttSourceConfig) {
    this.brokerUrl = config.brokerUrl;
    this.topic = config.topic;
    this.fieldMapping = config.fieldMapping ?? {};
  }

  async initialize(): Promise<void> {
    this.client = mqtt.connect(this.brokerUrl);

    await new Promise<void>((resolve, reject) => {
      const client = this.client;
      if (!client) {
        reject(new Error("MQTT client not created"));
        return;
      }
      this.pendingInitialization = { client, resolve, reject };

      client.on("connect", () => {
        if (this.client !== client) {
          return;
        }

        client.subscribe(this.topic, (error) => {
          if (this.client !== client) {
            return;
          }

          if (error) {
            this.rejectInitialization(client, error);
            return;
          }

          this.resolveInitialization(client);
        });
      });

      client.on("message", (_topic, payload) => {
        if (this.client !== client) {
          return;
        }

        try {
          const parsed: unknown = JSON.parse(payload.toString());
          if (!isObjectPayload(parsed)) {
            return;
          }

          this.pendingPayload = parsed;
        } catch {
          // Ignore malformed payloads.
        }
      });

      client.on("error", (error) => {
        if (this.client !== client) {
          return;
        }

        this.rejectInitialization(client, error);
      });
    });
  }

  async update(target: SourceUpdateTarget): Promise<void> {
    const update = await this.poll(new AbortController().signal);
    if (!update) {
      return;
    }

    this.apply(update, target);
  }

  async poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined> {
    if (signal.aborted) {
      return undefined;
    }

    const payload = this.pendingPayload;
    this.pendingPayload = undefined;
    if (payload === undefined) {
      return undefined;
    }

    return { payload, fieldMapping: this.fieldMapping };
  }

  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void {
    applyInputPayload(target, update.payload, update.fieldMapping ?? this.fieldMapping);
  }

  async dispose(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.pendingPayload = undefined;
    this.resolveInitialization(client);

    await new Promise<void>((resolve) => {
      if (!client) {
        resolve();
        return;
      }

      client.end(false, {}, () => resolve());
    });
  }

  private resolveInitialization(client: MqttClient | null): void {
    const pending = this.pendingInitialization;
    if (!client || pending?.client !== client) {
      return;
    }

    this.pendingInitialization = null;
    pending.resolve();
  }

  private rejectInitialization(client: MqttClient, error: unknown): void {
    const pending = this.pendingInitialization;
    if (pending?.client !== client) {
      return;
    }

    this.pendingInitialization = null;
    pending.reject(error);
  }
}
