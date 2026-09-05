import { describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ControlResult, PuppetFlowControlState } from "@puppetflow/control";
import type { McpControlClient } from "./control.js";
import {
  registerTools,
  type ToolConfig,
  type ToolHandler,
  type ToolRegistrar,
} from "./tools.js";

const idleState: PuppetFlowControlState = {
  acting: {
    elapsed: 0,
    remaining: 0,
    queuedActions: 0,
    blendRemaining: 0,
  },
  expression: { elapsed: 0, remaining: 0, fadeRemaining: 0 },
};

class RecordingControl implements McpControlClient {
  readonly calls: unknown[][] = [];
  nextResult: ControlResult = { accepted: true, state: idleState };
  nextState = idleState;
  error: unknown;
  act(request: unknown): Promise<ControlResult> {
    return this.record("act", request);
  }
  sequence(request: unknown): Promise<ControlResult> {
    return this.record("sequence", request);
  }
  interrupt(): Promise<ControlResult> {
    return this.record("interrupt");
  }
  setExpression(request: unknown): Promise<ControlResult> {
    return this.record("setExpression", request);
  }
  clearExpression(request: unknown): Promise<ControlResult> {
    return this.record("clearExpression", request);
  }
  async getState(): Promise<PuppetFlowControlState> {
    this.calls.push(["getState"]);
    if (this.error) throw this.error;
    return this.nextState;
  }
  async getCapabilities() {
    return {
      acting: { actions: [], sequence: true, interrupt: true },
      expressions: { names: [], clear: true },
    };
  }
  close(): void {}
  private async record(name: string, value?: unknown): Promise<ControlResult> {
    this.calls.push(value === undefined ? [name] : [name, value]);
    if (this.error) throw this.error;
    return this.nextResult;
  }
}

class RecordingRegistrar implements ToolRegistrar {
  readonly names: string[] = [];
  readonly handlers = new Map<string, ToolHandler>();
  readonly configs = new Map<string, ToolConfig>();

  registerTool(name: string, config: ToolConfig, handler: ToolHandler): void {
    this.names.push(name);
    this.configs.set(name, config);
    this.handlers.set(name, handler);
  }
}

describe("PuppetFlow MCP tools", () => {
  it("preserves the seven-tool external contract", () => {
    const registrar = new RecordingRegistrar();
    registerTools(registrar, new RecordingControl());

    expect(registrar.names).toEqual([
      "act",
      "sequence",
      "look_at",
      "interrupt",
      "get_state",
      "set_expression",
      "clear_expression",
    ]);
    expect(
      registrar.configs.get("act")?.inputSchema["~standard"].jsonSchema.input({
        target: "draft-2020-12",
      }).additionalProperties,
    ).toBe(false);
  });

  it("forwards canonical DTO fields and preserves normalized result shapes", async () => {
    const registrar = new RecordingRegistrar();
    const control = new RecordingControl();
    control.nextResult = {
      accepted: true,
      state: {
        acting: {
          activeAction: { action: "wave", side: "right", intensity: 0.7 },
          activeActionId: 7,
          elapsed: 0.2,
          remaining: 1,
          queuedActions: 1,
          blendRemaining: 0.1,
        },
        expression: {
          activeExpression: { expression: "happy", intensity: 0.75 },
          activeExpressionId: 8,
          elapsed: 0.3,
          remaining: Number.POSITIVE_INFINITY,
          fadeRemaining: 0,
        },
      },
    };
    registerTools(registrar, control);

    const result = await call(registrar, "act", {
      action: "wave",
      side: "right",
      intensity: 0.7,
      duration: 1.2,
      speed: 1,
      blendDuration: 0.1,
    });
    expect(control.calls).toEqual([
      [
        "act",
        {
          action: "wave",
          side: "right",
          intensity: 0.7,
          duration: 1.2,
          speed: 1,
          blendDuration: 0.1,
        },
      ],
    ]);
    expect(payload(result)).toMatchObject({
      accepted: true,
      action_id: 7,
      sequence_id: null,
      state: {
        busy: true,
        current_action: "wave",
        queued_actions: 1,
        expression: { current_expression: "happy", remaining: null },
      },
    });

    await call(registrar, "sequence", {
      actions: [{ action: "head_tilt", duration: 0.5 }],
    });
    await call(registrar, "look_at", { target: "right", intensity: 0.6 });
    await call(registrar, "set_expression", {
      expression: " happy ",
      intensity: 0.75,
      duration: 2.5,
      fadeIn: 0.15,
      fadeOut: 0.25,
    });
    await call(registrar, "clear_expression", { fadeOut: 0.4 });
    await call(registrar, "interrupt", {});
    expect(control.calls.slice(1)).toEqual([
      ["sequence", { actions: [{ action: "head_tilt", duration: 0.5 }] }],
      ["act", { action: "look_right", intensity: 0.6 }],
      [
        "setExpression",
        {
          expression: "happy",
          intensity: 0.75,
          duration: 2.5,
          fadeIn: 0.15,
          fadeOut: 0.25,
        },
      ],
      ["clearExpression", { fadeOut: 0.4 }],
      ["interrupt"],
    ]);
  });

  it("keeps invalid, rejected, unknown-outcome, and internal errors distinct", async () => {
    const registrar = new RecordingRegistrar();
    const control = new RecordingControl();
    registerTools(registrar, control);
    expect(
      errorCode(await call(registrar, "act", { action: "wave", extra: true })),
    ).toBe("invalid_input");
    expect(control.calls).toEqual([]);

    control.nextResult = {
      accepted: false,
      reason: "RangeError: Unknown action D:\\private\\token.txt token=example",
      state: idleState,
    };
    const rejected = await call(registrar, "act", { action: "unsupported" });
    expect(errorCode(rejected)).toBe("command_rejected");
    expect(JSON.stringify(payload(rejected))).not.toMatch(/private|example|RangeError/);

    control.error = Object.assign(new Error("timeout"), { outcomeUnknown: true });
    expect(errorCode(await call(registrar, "act", { action: "wave" }))).toBe(
      "command_outcome_unknown",
    );
    control.error = new Error("private failure");
    expect(errorCode(await call(registrar, "get_state", {}))).toBe("internal_error");
  });
});

async function call(
  registrar: RecordingRegistrar,
  name: string,
  input: unknown,
): Promise<CallToolResult> {
  const handler = registrar.handlers.get(name);
  expect(handler).toBeDefined();
  return await handler!(input);
}

function payload(result: CallToolResult): Record<string, unknown> {
  const content = result.content[0];
  expect(content?.type).toBe("text");
  const parsed = JSON.parse(content?.type === "text" ? content.text : "{}") as Record<
    string,
    unknown
  >;
  expect(result.structuredContent).toEqual(parsed);
  return parsed;
}

function errorCode(result: CallToolResult): string {
  return (payload(result).error as { code: string }).code;
}
