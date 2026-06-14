import type { BehaviorExpression, BehaviorStatement } from "@puppetflow/behavior";
import { MOTION_STATE_KEYS } from "@puppetflow/core";
import * as Blockly from "blockly/core";

const STATE_OPTIONS = [
  ["interest", "interest"],
  ["energy", "energy"],
  ["stress", "stress"],
];

const MOTION_OPTIONS = MOTION_STATE_KEYS.map((key) => [key, key] as [string, string]);

function numberExpr(value: number): BehaviorExpression {
  return { type: "Number", value };
}

function stringExpr(value: string): BehaviorExpression {
  return { type: "String", value };
}

function statefulCall(
  callee: string,
  args: Record<string, string | number>,
): BehaviorExpression {
  return {
    type: "Call",
    callee,
    args: Object.entries(args).map(([name, value]) => ({
      name,
      value: typeof value === "number" ? numberExpr(value) : stringExpr(value),
    })),
  };
}

function scaleExpr(
  expression: BehaviorExpression,
  gain: number,
  offset = 0,
): BehaviorExpression {
  return {
    type: "Binary",
    op: "+",
    left: numberExpr(offset),
    right: {
      type: "Binary",
      op: "*",
      left: expression,
      right: numberExpr(gain),
    },
  };
}

function subtractFromOne(expression: BehaviorExpression): BehaviorExpression {
  return {
    type: "Binary",
    op: "-",
    left: numberExpr(1),
    right: expression,
  };
}

export function statefulBlockToStatements(block: Blockly.Block): BehaviorStatement[] {
  switch (block.type) {
    case "pf_stateful_smooth": {
      const target = String(block.getFieldValue("TARGET") ?? "bodyLean");
      const source = String(block.getFieldValue("SOURCE") ?? "interest");
      const speed = Number(block.getFieldValue("SPEED") ?? 2);
      return [
        {
          type: "ExprAssign",
          target,
          value: {
            type: "Call",
            callee: "smooth",
            args: [
              { name: "id", value: stringExpr(`scratch:smooth:${target}`) },
              { name: "speed", value: numberExpr(speed) },
              { name: "value", value: { type: "Identifier", name: source } },
            ],
          },
        },
      ];
    }
    case "pf_stateful_breath": {
      const target = String(block.getFieldValue("TARGET") ?? "bodyLean");
      const rate = Number(block.getFieldValue("RATE") ?? 0.25);
      const amplitude = Number(block.getFieldValue("AMPLITUDE") ?? 0.08);
      return [
        {
          type: "ExprAssign",
          target,
          value: scaleExpr(
            statefulCall("breath", {
              id: `scratch:breath:${target}`,
              rate,
            }),
            amplitude,
            0.5 - amplitude * 0.5,
          ),
        },
      ];
    }
    case "pf_stateful_wander_gaze": {
      const speed = Number(block.getFieldValue("SPEED") ?? 0.3);
      const amplitude = Number(block.getFieldValue("AMPLITUDE") ?? 0.15);
      return [
        {
          type: "ExprAssign",
          target: "lookX",
          value: scaleExpr(
            statefulCall("wander", { id: "scratch:wander:lookX", speed }),
            amplitude,
            0.5,
          ),
        },
        {
          type: "ExprAssign",
          target: "lookY",
          value: scaleExpr(
            statefulCall("wander", {
              id: "scratch:wander:lookY",
              speed: speed * 0.85,
            }),
            amplitude * 0.85,
            0.5,
          ),
        },
      ];
    }
    case "pf_stateful_blink": {
      const interval = Number(block.getFieldValue("INTERVAL") ?? 4);
      const strength = Number(block.getFieldValue("STRENGTH") ?? 0.15);
      return [
        {
          type: "ExprAssign",
          target: "eyeYaw",
          value: subtractFromOne(
            scaleExpr(
              statefulCall("blink", {
                id: "scratch:blink:eyes",
                averageInterval: interval,
              }),
              strength,
            ),
          ),
        },
      ];
    }
    default:
      return [];
  }
}

export function registerStatefulScratchBlocks(): void {
  Blockly.Blocks["pf_stateful_smooth"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("ゆっくり追従する")
        .appendField(new Blockly.FieldDropdown(MOTION_OPTIONS), "TARGET")
        .appendField("←")
        .appendField(new Blockly.FieldDropdown(STATE_OPTIONS), "SOURCE")
        .appendField("速さ")
        .appendField(new Blockly.FieldNumber(2, 0.1, 10, 0.1), "SPEED");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
      this.setTooltip("smooth() で State の変化を滑らかに Motion へ反映します。");
    },
  };

  Blockly.Blocks["pf_stateful_breath"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("呼吸する")
        .appendField(new Blockly.FieldDropdown(MOTION_OPTIONS), "TARGET")
        .appendField("速さ")
        .appendField(new Blockly.FieldNumber(0.25, 0.05, 1, 0.05), "RATE")
        .appendField("幅")
        .appendField(new Blockly.FieldNumber(0.08, 0.01, 0.3, 0.01), "AMPLITUDE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
      this.setTooltip("breath() で自然な呼吸サイクルを Motion に出力します。");
    },
  };

  Blockly.Blocks["pf_stateful_wander_gaze"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("ランダムに視線移動")
        .appendField("速さ")
        .appendField(new Blockly.FieldNumber(0.3, 0.05, 1, 0.05), "SPEED")
        .appendField("幅")
        .appendField(new Blockly.FieldNumber(0.15, 0.02, 0.35, 0.01), "AMPLITUDE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
      this.setTooltip("wander() で lookX / lookY をランダムに探索します。");
    },
  };

  Blockly.Blocks["pf_stateful_blink"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("一定間隔で瞬き")
        .appendField("間隔(秒)")
        .appendField(new Blockly.FieldNumber(4, 0.5, 15, 0.5), "INTERVAL")
        .appendField("強さ")
        .appendField(new Blockly.FieldNumber(0.15, 0.05, 1, 0.01), "STRENGTH");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
      this.setTooltip("blink() で eyeYaw（まぶた開き）に瞬きを反映します。");
    },
  };
}

export function statefulScratchToolbox() {
  return {
    kind: "category" as const,
    name: "Natural Motion",
    colour: "#D4A017",
    contents: [
      { kind: "block" as const, type: "pf_stateful_smooth" },
      { kind: "block" as const, type: "pf_stateful_breath" },
      { kind: "block" as const, type: "pf_stateful_wander_gaze" },
      { kind: "block" as const, type: "pf_stateful_blink" },
    ],
  };
}
