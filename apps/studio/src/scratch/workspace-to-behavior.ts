import type {
  AssignOp,
  BehaviorBlock,
  BehaviorIf,
  BehaviorStatement,
  CompareOp,
} from "@puppetflow/behavior";
import { MOTION_STATE_KEYS, type MotionStateKey } from "@puppetflow/core";
import type * as Blockly from "blockly/core";
import { statefulBlockToStatements } from "./stateful-blocks.js";

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
    statements.push(...blockToStatements(block));
    block = block.getNextBlock();
  }

  return statements;
}

function blockToStatements(block: Blockly.Block): BehaviorStatement[] {
  if (block.type.startsWith("pf_stateful_")) {
    const statefulStatements = statefulBlockToStatements(block);
    if (statefulStatements.length > 0) {
      return statefulStatements;
    }
  }
  return [blockToStatement(block)];
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
    default:
      if (block.type.startsWith("pf_motion_pack_")) {
        const packId = block.type.slice("pf_motion_pack_".length);
        return {
          type: "MotionPack",
          packId,
          config: { intensity: Number(block.getFieldValue("INTENSITY") ?? 0.8) },
        };
      }
      throw new Error(`Unsupported Scratch block type: ${block.type}`);
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
