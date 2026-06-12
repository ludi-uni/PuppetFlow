import { MOTION_STATE_KEYS } from "@puppetflow/core";
import * as Blockly from "blockly/core";

const STATE_OPTIONS = [
  ["interest", "interest"],
  ["energy", "energy"],
  ["stress", "stress"],
];

const OP_OPTIONS = [
  [">", ">"],
  [">=", ">="],
  ["<", "<"],
  ["<=", "<="],
  ["==", "=="],
  ["!=", "!="],
];

const MOTION_OPTIONS = MOTION_STATE_KEYS.map((key) => [key, key] as [string, string]);

const ASSIGN_OP_OPTIONS = [
  ["=", "set"],
  ["+=", "add"],
];

export function registerScratchBlocks(): void {
  Blockly.Blocks["pf_if"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("もし")
        .appendField(new Blockly.FieldDropdown(STATE_OPTIONS), "STATE")
        .appendField(new Blockly.FieldDropdown(OP_OPTIONS), "OP")
        .appendField(new Blockly.FieldNumber(0.7, 0, 1, 0.01), "RIGHT");
      this.appendStatementInput("THEN").appendField("なら");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip("条件が真のときだけ中のブロックを実行します。");
    },
  };

  Blockly.Blocks["pf_assign"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("Motion")
        .appendField(new Blockly.FieldDropdown(MOTION_OPTIONS), "KEY")
        .appendField(new Blockly.FieldDropdown(ASSIGN_OP_OPTIONS), "OP")
        .appendField(new Blockly.FieldNumber(0.2, 0, 1, 0.01), "VALUE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("Motion パラメータに値を代入します。");
    },
  };

  Blockly.Blocks["pf_builtin_attention"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("注目（attention）");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
    },
  };

  Blockly.Blocks["pf_builtin_gaze"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("視線ゆらぎ（gaze）");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
    },
  };

  Blockly.Blocks["pf_builtin_blink"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("瞬き（blink）");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
    },
  };

  Blockly.Blocks["pf_builtin_idle"] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("待機（idle）");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(45);
    },
  };
}

export const SCRATCH_TOOLBOX = {
  kind: "categoryToolbox" as const,
  contents: [
    {
      kind: "category",
      name: "Logic",
      colour: "#5C81A6",
      contents: [{ kind: "block", type: "pf_if" }],
    },
    {
      kind: "category",
      name: "Motion",
      colour: "#5CA65C",
      contents: [{ kind: "block", type: "pf_assign" }],
    },
    {
      kind: "category",
      name: "Builtins",
      colour: "#A65C81",
      contents: [
        { kind: "block", type: "pf_builtin_attention" },
        { kind: "block", type: "pf_builtin_gaze" },
        { kind: "block", type: "pf_builtin_blink" },
        { kind: "block", type: "pf_builtin_idle" },
      ],
    },
  ],
};
