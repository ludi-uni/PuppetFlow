import { getPresetJson } from "@puppetflow/behavior-packs";
import type { ControlSnapshot } from "@puppetflow/control-client";
import { describe, expect, it } from "vitest";
import { createPuppetFlowHost } from "./puppetflow-host.js";
import { createSharedHostService } from "./control-http-server.js";

const acting = {
  profile: {
    id: "shared-host-test",
    bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
  },
  expressionProfile: {
    id: "shared-host-expression",
    expressions: { happy: { blendShape: "Happy" } },
  },
  autoIdle: false,
};
const port = 18988;

describe("shared Host HTTP service", () => {
  it("binds one loopback listener before its Host, then exposes canonical Control without changing DTOs", async () => {
    const host = createPuppetFlowHost({
      presetJson: getPresetJson("Idle"),
      acting,
      vmc: false,
    });
    const service = createSharedHostService({
      host,
      token: "test-token",
      port,
      origins: ["http://studio.test"],
    });
    await service.start();
    const headers = {
      Authorization: "Bearer test-token",
      Origin: "http://studio.test",
    };
    const connection = await fetch(`${service.url}/v1/connection`, { headers }).then(
      (r) => r.json(),
    );
    expect(connection).toMatchObject({
      protocolVersion: 1,
      hostInstanceId: service.hostInstanceId,
      ready: true,
    });
    const preflight = await fetch(`${service.url}/v1/act`, {
      method: "OPTIONS",
      headers: { Origin: "http://studio.test" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "http://studio.test",
    );
    const result = await fetch(`${service.url}/v1/set-expression`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-PuppetFlow-Host-Instance": service.hostInstanceId,
      },
      body: JSON.stringify({
        expression: "happy",
        intensity: 0.7,
        duration: 1,
        fadeIn: 0.1,
        fadeOut: 0.2,
      }),
    }).then((r) => r.json());
    expect(result).toMatchObject({
      accepted: true,
      state: {
        expression: {
          activeExpression: {
            expression: "happy",
            intensity: 0.7,
            duration: 1,
            fadeIn: 0.1,
            fadeOut: 0.2,
          },
        },
      },
    });
    const snapshot = (await fetch(`${service.url}/v1/state`, { headers }).then((r) =>
      r.json(),
    )) as ControlSnapshot;
    expect(snapshot.state.expression.activeExpression?.expression).toBe("happy");
    await expect(
      fetch(`${service.url}/v1/state`, { headers: { Authorization: "Bearer wrong" } }),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      fetch(`${service.url}/v1/act`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-PuppetFlow-Host-Instance": "stale",
        },
        body: "{}",
      }),
    ).resolves.toMatchObject({ status: 409 });
    await service.close();
  });
});
