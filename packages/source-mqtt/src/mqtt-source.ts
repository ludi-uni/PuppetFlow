import { applyInputPayload } from "@puppetflow/source-core";
import type { SourceUpdateTarget, StateSource } from "@puppetflow/source-core";
import mqtt, { type MqttClient } from "mqtt";

export interface MqttSourceConfig {
  brokerUrl: string;
  topic: string;
  fieldMapping?: Record<string, string>;
}

export class MqttSource implements StateSource {
  readonly id = "mqtt";

  private readonly brokerUrl: string;
  private readonly topic: string;
  private readonly fieldMapping: Record<string, string>;
  private client: MqttClient | null = null;
  private pendingPayload: unknown = null;

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

      client.on("connect", () => {
        client.subscribe(this.topic, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      client.on("message", (_topic, payload) => {
        try {
          const parsed: unknown = JSON.parse(payload.toString());
          if (typeof parsed !== "object" || parsed === null) {
            return;
          }

          this.pendingPayload = parsed;
        } catch {
          // Ignore malformed payloads.
        }
      });

      client.on("error", (error) => {
        reject(error);
      });
    });
  }

  async update(target: SourceUpdateTarget): Promise<void> {
    if (!this.pendingPayload) {
      return;
    }

    applyInputPayload(target, this.pendingPayload, this.fieldMapping);

    this.pendingPayload = null;
  }

  async dispose(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, () => resolve());
    });

    this.client = null;
  }
}
