import * as Blockly from "blockly/core";
import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";

export function registerExtensionScratchBlocks(): void {
  const registry = getBundledMotionRegistry();

  for (const pack of registry.packs.values()) {
    const blockType = pack.scratchBlockType ?? `pf_motion_pack_${pack.id}`;

    if (Blockly.Blocks[blockType]) {
      continue;
    }

    Blockly.Blocks[blockType] = {
      init(this: Blockly.Block) {
        this.appendDummyInput()
          .appendField(pack.label)
          .appendField("強さ")
          .appendField(new Blockly.FieldNumber(0.8, 0, 1, 0.05), "INTENSITY");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(290);
        this.setTooltip(pack.description ?? pack.label);
      },
    };
  }
}

export function extensionScratchToolbox() {
  const registry = getBundledMotionRegistry();
  const blocks = [...registry.packs.values()]
    .filter((pack) => pack.scratchBlockType || pack.id)
    .map((pack) => ({
      kind: "block" as const,
      type: pack.scratchBlockType ?? `pf_motion_pack_${pack.id}`,
    }));

  if (blocks.length === 0) {
    return null;
  }

  return {
    kind: "category" as const,
    name: "Motion Packs",
    colour: "#A65C81",
    contents: blocks,
  };
}
