import type { PuppetFlowRuntime } from "@puppetflow/runtime";
import { HttpSource } from "@puppetflow/source-http";
import { MqttSource } from "@puppetflow/source-mqtt";
import { WebSocketSource } from "@puppetflow/source-websocket";

import type { SourceLaunchConfig } from "./types.js";

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function attachSources(
  runtime: PuppetFlowRuntime,
  sources: SourceLaunchConfig,
): void {
  if (hasText(sources.httpUrl)) {
    runtime.attachSource(
      new HttpSource({ url: sources.httpUrl.trim(), intervalMs: 1000 }),
    );
  }

  if (hasText(sources.wsUrl)) {
    runtime.attachSource(new WebSocketSource({ url: sources.wsUrl.trim() }));
  }

  if (hasText(sources.mqttBroker) && hasText(sources.mqttTopic)) {
    runtime.attachSource(
      new MqttSource({
        brokerUrl: sources.mqttBroker.trim(),
        topic: sources.mqttTopic.trim(),
      }),
    );
  }
}
