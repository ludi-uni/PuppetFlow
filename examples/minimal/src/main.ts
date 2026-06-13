import { NodeVmcAdapter } from "@puppetflow/adapter-vmc/node";
import defaultMapping from "@puppetflow/adapter-vmc/mappings/default.json";
import { getPresetJson } from "@puppetflow/behavior-packs";
import { loadPreset } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const runtime = new PuppetFlowRuntime()
  .loadPreset(loadPreset(getPresetJson("Curious")))
  .attachAdapter(
    new NodeVmcAdapter({
      mapping: defaultMapping,
    }),
  );

runtime.state.set("interest", 0.8);
await runtime.start();

console.log("Motion:", runtime.getRenderedMotion());
console.log("Sending VMC packets to 127.0.0.1:39539. Press Ctrl+C to exit.");

setTimeout(async () => {
  await runtime.stop();
  process.exit(0);
}, 1000);
