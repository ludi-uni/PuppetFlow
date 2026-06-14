import { describe, expect, it } from "vitest";
import {
  isExternalInputActive,
  sourcesDirty,
} from "./useInputSources";

describe("useInputSources helpers", () => {
  it("detects draft vs applied source changes", () => {
    const applied = {
      httpUrl: "http://localhost:3000/input",
      wsUrl: null,
      mqttBroker: null,
      mqttTopic: null,
    };
    const draft = { ...applied, wsUrl: "ws://localhost:8080/input" };

    expect(sourcesDirty(draft, applied)).toBe(true);
    expect(sourcesDirty(applied, applied)).toBe(false);
  });

  it("detects active external input connections", () => {
    expect(
      isExternalInputActive({
        httpUrl: null,
        wsUrl: "ws://localhost:8080/input",
        mqttBroker: null,
        mqttTopic: null,
      }),
    ).toBe(true);

    expect(
      isExternalInputActive({
        httpUrl: null,
        wsUrl: null,
        mqttBroker: "mqtt://localhost:1883",
        mqttTopic: "puppetflow/input",
      }),
    ).toBe(true);

    expect(
      isExternalInputActive({
        httpUrl: null,
        wsUrl: null,
        mqttBroker: "mqtt://localhost:1883",
        mqttTopic: null,
      }),
    ).toBe(false);
  });
});
