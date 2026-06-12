import { LoggerAdapter } from "@puppetflow/adapter-logger";
import { createLive2dAdapter } from "@puppetflow/adapter-live2d";
import { NodeVmcAdapter } from "@puppetflow/adapter-vmc/node";
import { createVrmAdapter } from "@puppetflow/adapter-vrm";
import { WebSocketAdapter } from "@puppetflow/adapter-websocket";
import { VMC_PROFILE } from "@puppetflow/motion-mapper";
import { getPresetJson } from "@puppetflow/behavior-packs";
import { loadPreset } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const runtime = new PuppetFlowRuntime()
  .loadPreset(loadPreset(getPresetJson("Curious")))
  .attachAdapter(new NodeVmcAdapter({ profile: VMC_PROFILE }))
  .attachAdapter(createLive2dAdapter())
  .attachAdapter(createVrmAdapter())
  .attachAdapter(new WebSocketAdapter({ port: 3939 }))
  .attachAdapter(new LoggerAdapter({ label: "Ecosystem", throttleMs: 3000 }));

runtime.state.set("interest", 0.8);
runtime.state.set("energy", 0.6);
await runtime.start();

console.log("PuppetFlow ecosystem demo running.");
console.log("- Motion Mapper converts MotionState per model target");
console.log("- VMC OSC -> 127.0.0.1:39539");
console.log("- WebSocket viewer -> ws://127.0.0.1:3939");
console.log("- Open viewer: pnpm dev:viewer");
console.log("Press Ctrl+C to exit.");

let interest = 0.8;
setInterval(() => {
  interest = interest >= 1 ? 0.2 : interest + 0.1;
  runtime.state.set("interest", interest);
}, 2000);

process.on("SIGINT", async () => {
  await runtime.stop();
  process.exit(0);
});
