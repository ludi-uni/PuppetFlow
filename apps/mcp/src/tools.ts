import type { CallToolResult } from "@modelcontextprotocol/server";
import type { McpControlClient } from "./control.js";
import { BridgeError } from "./errors.js";
import { commandResult, errorResult, stateResult } from "./results.js";
import {
  actInputSchema,
  type BridgeInputSchema,
  bridgeInputSchema,
  clearExpressionInputSchema,
  emptyInputSchema,
  lookAtInputSchema,
  sequenceInputSchema,
  setExpressionInputSchema,
} from "./schemas.js";

export interface ToolConfig {
  description: string;
  inputSchema: BridgeInputSchema;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: false;
    openWorldHint: false;
  };
}
export type ToolHandler = (input: unknown) => CallToolResult | Promise<CallToolResult>;
export interface ToolRegistrar {
  registerTool(name: string, config: ToolConfig, handler: ToolHandler): unknown;
}

const LOOK_ACTIONS = {
  camera: "look_camera",
  left: "look_left",
  right: "look_right",
  up: "look_up",
  down: "look_down",
} as const;
const commandAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const stateAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function registerTools(server: ToolRegistrar, control: McpControlClient): void {
  server.registerTool(
    "act",
    {
      description: "Start one runtime-owned acting action.",
      inputSchema: bridgeInputSchema(actInputSchema),
      annotations: commandAnnotations,
    },
    (input) => {
      const parsed = actInputSchema.safeParse(input);
      return parsed.success
        ? invokeCommand(() => control.act(parsed.data), { action: parsed.data.action })
        : invalidInputResult();
    },
  );
  server.registerTool(
    "sequence",
    {
      description: "Submit one runtime-owned sequence of acting actions.",
      inputSchema: bridgeInputSchema(sequenceInputSchema),
      annotations: commandAnnotations,
    },
    (input) => {
      const parsed = sequenceInputSchema.safeParse(input);
      return parsed.success
        ? invokeCommand(() => control.sequence(parsed.data), {})
        : invalidInputResult();
    },
  );
  server.registerTool(
    "look_at",
    {
      description: "Delegate a named look target to the acting runtime.",
      inputSchema: bridgeInputSchema(lookAtInputSchema),
      annotations: commandAnnotations,
    },
    (input) => {
      const parsed = lookAtInputSchema.safeParse(input);
      if (!parsed.success) return invalidInputResult();
      const { target, ...params } = parsed.data;
      return invokeCommand(
        () => control.act({ action: LOOK_ACTIONS[target], ...params }),
        {
          target,
        },
      );
    },
  );
  server.registerTool(
    "interrupt",
    {
      description: "Interrupt the current runtime-owned acting command.",
      inputSchema: bridgeInputSchema(emptyInputSchema),
      annotations: commandAnnotations,
    },
    (input) =>
      emptyInputSchema.safeParse(input).success
        ? invokeCommand(() => control.interrupt(), {})
        : invalidInputResult(),
  );
  server.registerTool(
    "get_state",
    {
      description: "Read the compact current acting state.",
      inputSchema: bridgeInputSchema(emptyInputSchema),
      annotations: stateAnnotations,
    },
    async (input) => {
      if (!emptyInputSchema.safeParse(input).success) return invalidInputResult();
      try {
        return stateResult(await control.getState());
      } catch {
        return errorResult(
          new BridgeError("internal_error", "Acting runtime call failed."),
        );
      }
    },
  );
  server.registerTool(
    "set_expression",
    {
      description: "Set one runtime-owned expression.",
      inputSchema: bridgeInputSchema(setExpressionInputSchema),
      annotations: commandAnnotations,
    },
    (input) => {
      const parsed = setExpressionInputSchema.safeParse(input);
      if (!parsed.success) return invalidInputResult();
      const { expression, ...params } = parsed.data;
      return invokeCommand(() => control.setExpression({ expression, ...params }), {
        expression,
      });
    },
  );
  server.registerTool(
    "clear_expression",
    {
      description: "Clear the current runtime-owned expression.",
      inputSchema: bridgeInputSchema(clearExpressionInputSchema),
      annotations: commandAnnotations,
    },
    (input) => {
      const parsed = clearExpressionInputSchema.safeParse(input);
      return parsed.success
        ? invokeCommand(() => control.clearExpression(parsed.data), {})
        : invalidInputResult();
    },
  );
}

function invalidInputResult(): CallToolResult {
  return errorResult(
    new BridgeError("invalid_input", "Input must match the tool schema."),
  );
}

async function invokeCommand(
  invoke: () => Promise<Awaited<ReturnType<McpControlClient["act"]>>>,
  extra: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    return commandResult(await invoke(), extra);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "outcomeUnknown" in error &&
      error.outcomeUnknown === true
    ) {
      return errorResult(
        new BridgeError(
          "command_outcome_unknown",
          "Acting command may have executed before the connection failed.",
        ),
      );
    }
    return errorResult(
      new BridgeError("internal_error", "Acting runtime call failed."),
    );
  }
}
