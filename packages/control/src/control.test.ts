import { readFileSync } from "node:fs";

import {
  ACTING_ACTION_NAMES,
  ActingEngine,
  PuppetFlowRuntime,
  type ActingRuntimeApi,
  type ActingState,
} from "@puppetflow/runtime";
import { describe, expect, it, vi } from "vitest";

import { createPuppetFlowControl } from "./index.js";

function actingState(): ActingState {
  return {
    activeAction: {
      action: "wave",
      side: "right",
      intensity: 0.7,
      speed: 1.2,
      duration: 1,
      blendDuration: 0.18,
    },
    activeActionId: 4,
    sequenceId: 2,
    elapsed: 0.25,
    remaining: 0.75,
    queueLength: 1,
    blendRemaining: 0.1,
    expression: {
      activeExpression: {
        expression: "happy",
        intensity: 0.6,
        duration: 2,
        fadeIn: 0.15,
        fadeOut: 0.2,
      },
      activeExpressionId: 3,
      elapsed: 0.25,
      remaining: 1.75,
      fadeRemaining: 0,
    },
  };
}

function accepted(state: ActingState = actingState()) {
  return { accepted: true, state };
}

function fakeRuntime(api: ActingRuntimeApi | null) {
  return {
    getActingApi: () => api,
    getActingCapabilities: () =>
      api === null
        ? null
        : { actions: ["wave", "look_right"], expressions: ["neutral", "happy"] },
  };
}

function fakeApi(state: ActingState = actingState()): ActingRuntimeApi {
  return {
    act: vi.fn(() => accepted(state)),
    sequence: vi.fn(() => accepted(state)),
    interrupt: vi.fn(() => accepted(state)),
    get_state: vi.fn(() => state),
    set_expression: vi.fn(() => accepted(state)),
    clear_expression: vi.fn(() => accepted(state)),
    get_expression_state: vi.fn(() => state.expression ?? EMPTY_EXPRESSION_STATE),
  };
}

const EMPTY_EXPRESSION_STATE = {
  elapsed: 0,
  remaining: 0,
  fadeRemaining: 0,
};

describe("PuppetFlowControl", () => {
  it("maps one semantic act request to the existing Acting API", () => {
    const api = fakeApi();
    const control = createPuppetFlowControl(fakeRuntime(api));

    const result = control.act({
      action: " wave ",
      side: "right",
      intensity: 0.7,
      speed: 1.2,
    });

    expect(api.act).toHaveBeenCalledWith("wave", {
      side: "right",
      intensity: 0.7,
      speed: 1.2,
    });
    expect(result.accepted).toBe(true);
    expect(result.state.acting.activeAction).toEqual({
      action: "wave",
      side: "right",
      intensity: 0.7,
      speed: 1.2,
    });
  });

  it("maps a semantic sequence in order without adding fields", () => {
    const api = fakeApi();
    const control = createPuppetFlowControl(fakeRuntime(api));

    control.sequence({
      actions: [
        { action: "look_right", intensity: 0.4 },
        { action: "small_wave", side: "left", speed: 1.5 },
      ],
    });

    expect(api.sequence).toHaveBeenCalledWith([
      { action: "look_right", intensity: 0.4 },
      { action: "small_wave", side: "left", speed: 1.5 },
    ]);
  });

  it("maps expression set and clear requests to the existing Expression API", () => {
    const api = fakeApi();
    const control = createPuppetFlowControl(fakeRuntime(api));

    control.setExpression({
      expression: " happy ",
      intensity: 0.6,
      duration: 2,
      fadeIn: 0.15,
      fadeOut: 0.2,
    });
    control.clearExpression({ fadeOut: 0.3 });

    expect(api.set_expression).toHaveBeenCalledWith("happy", {
      intensity: 0.6,
      duration: 2,
      fadeIn: 0.15,
      fadeOut: 0.2,
    });
    expect(api.clear_expression).toHaveBeenCalledWith({ fadeOut: 0.3 });
  });

  it("returns detached semantic state snapshots", () => {
    const internalState = actingState();
    const control = createPuppetFlowControl(fakeRuntime(fakeApi(internalState)));

    const first = control.getState();
    first.acting.activeAction!.action = "changed";
    first.expression.activeExpression!.expression = "changed";

    const second = control.getState();
    expect(second.acting.activeAction?.action).toBe("wave");
    expect(second.expression.activeExpression?.expression).toBe("happy");
    expect(internalState.activeAction?.action).toBe("wave");
    expect(internalState.expression?.activeExpression?.expression).toBe("happy");
  });

  it("derives capabilities from the attached primitive registry and expression profile", () => {
    const runtime = new PuppetFlowRuntime().attachActingEngine(
      new ActingEngine({
        profile: {
          id: "control-capabilities",
          bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
        },
        expressionProfile: {
          id: "control-expression-capabilities",
          expressions: {
            happy: { blendShape: "Happy" },
            surprised: { blendShape: "Surprised" },
          },
        },
      }),
    );

    expect(createPuppetFlowControl(runtime).getCapabilities()).toEqual({
      acting: {
        actions: [...ACTING_ACTION_NAMES],
        sequence: true,
        interrupt: true,
      },
      expressions: {
        names: ["neutral", "happy", "surprised"],
        clear: true,
      },
    });
  });

  it("returns safe failures when the Runtime has no Acting API", () => {
    const control = createPuppetFlowControl(fakeRuntime(null));
    const expectedState = {
      acting: {
        elapsed: 0,
        remaining: 0,
        queuedActions: 0,
        blendRemaining: 0,
      },
      expression: EMPTY_EXPRESSION_STATE,
    };

    expect(control.act({ action: "wave" })).toEqual({
      accepted: false,
      reason: "PuppetFlow acting is unavailable",
      state: expectedState,
    });
    expect(control.interrupt()).toEqual({
      accepted: false,
      reason: "PuppetFlow acting is unavailable",
      state: expectedState,
    });
    expect(control.getState()).toEqual(expectedState);
    expect(control.getCapabilities()).toEqual({
      acting: { actions: [], sequence: false, interrupt: false },
      expressions: { names: [], clear: false },
    });
  });

  it("has no production dependency on transports or VMC", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const productionSources = ["control.ts", "types.ts", "index.ts"].map((name) =>
      readFileSync(new URL(name, import.meta.url), "utf8"),
    );
    const imports = productionSources.flatMap((source) =>
      [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]),
    );

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual([
      "@puppetflow/runtime",
    ]);
    expect(
      imports.every(
        (specifier) =>
          specifier?.startsWith(".") || specifier === "@puppetflow/runtime",
      ),
    ).toBe(true);
    expect(imports.join("\n")).not.toMatch(
      /modelcontextprotocol|fastify|express|stdio|socket|fetch|adapter-vmc/i,
    );
  });
});
