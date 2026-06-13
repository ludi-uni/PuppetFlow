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
  ],
};
