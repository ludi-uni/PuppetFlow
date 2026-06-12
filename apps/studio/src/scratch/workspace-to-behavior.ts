import type {
  AssignOp,
  BehaviorBlock,
  BehaviorIf,
  BehaviorStatement,
  CompareOp,
} from "@puppetflow/behavior";
import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type * as Blockly from "blockly/core";

function isCompareOp(value: string): value is CompareOp {
  return [">", ">=", "<", "<=", "==", "!="].includes(value);
}

function isMotionKey(value: string): value is MotionStateKey {
  return (MOTION_STATE_KEYS as readonly string[]).includes(value);
}

function isAssignOp(value: string): value is AssignOp {
  return value === "set" || value === "add";
}

function statementChain(first: Blockly.Block | null): BehaviorStatement[] {
  const statements: BehaviorStatement[] = [];
  let block = first;

  while (block) {
    statements.push(blockToStatement(block));
    block = block.getNextBlock();
  }

  return statements;
}

function blockToStatement(block: Blockly.Block): BehaviorStatement {
  switch (block.type) {
    case "pf_if": {
      const state = String(block.getFieldValue("STATE") ?? "interest");
      const op = String(block.getFieldValue("OP") ?? ">");
      const right = Number(block.getFieldValue("RIGHT") ?? 0);

      const ifNode: BehaviorIf = {
        type: "If",
        condition: {
          left: state,
          op: isCompareOp(op) ? op : ">",
          right,
        },
        then: statementChain(block.getInputTargetBlock("THEN")),
      };

      return ifNode;
    }
    case "pf_assign": {
      const key = String(block.getFieldValue("KEY") ?? "mouthX");
      const op = String(block.getFieldValue("OP") ?? "set");
      const value = Number(block.getFieldValue("VALUE") ?? 0);

      return {
        type: "Assign",
        key: isMotionKey(key) ? key : "mouthX",
        op: isAssignOp(op) ? op : "set",
        value,
      };
    }
    case "pf_builtin_attention":
      return { type: "Builtin", id: "attention" };
    case "pf_builtin_gaze":
      return { type: "Builtin", id: "gaze" };
    case "pf_builtin_blink":
      return { type: "Builtin", id: "blink" };
    case "pf_builtin_idle":
      return { type: "Builtin", id: "idle" };
    default:
      return { type: "Builtin", id: "gaze" };
  }
}

export function workspaceToBehavior(workspace: Blockly.Workspace): BehaviorBlock {
  const topBlocks = workspace.getTopBlocks(true);
  const statements: BehaviorStatement[] = [];

  for (const block of topBlocks) {
    statements.push(...statementChain(block));
  }

  return {
    type: "Block",
    statements,
  };
}

export function behaviorToPresetBehaviorJson(behavior: BehaviorBlock): string {
  return JSON.stringify(behavior, null, 2);
}

export function mergeBehaviorIntoPreset(
  presetJson: string,
  behavior: BehaviorBlock,
): string {
  const parsed = JSON.parse(presetJson) as Record<string, unknown>;
  parsed.behavior = behavior;
  return JSON.stringify(parsed, null, 2);
}
