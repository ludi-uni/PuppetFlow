import { createMotionFrameGraphController } from "@puppetflow/motion-graph";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";

const document = {
  version: 1,
  initialState: "idle",
  states: [
    { id: "idle", sources: { idle: { enabled: true, priority: 10 } } },
    { id: "tracking", sources: { tracker: { enabled: true, priority: 100 } } },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
  ],
} as const;

let clock = 1000;
const graph = createMotionFrameGraphController(document, { now: () => clock });

const pipeline = createMotionFramePipeline({
  layers: [
    { source: "idle", priority: 10 },
    { source: "tracker", priority: 100 },
  ],
});

const inputs = {
  idle: [{ sourceId: "idle", frame: { timestamp: 1000, parameters: { blend: 0.2 } } }],
  tracking: [
    { sourceId: "idle", frame: { timestamp: 1000, parameters: { blend: 0.2 } } },
    { sourceId: "tracker", frame: { timestamp: 1050, parameters: { blend: 0.95 } } },
  ],
};

const idle = graph.evaluate({ sources: {} });
console.log("idle", pipeline.process(inputs.idle, 1 / 60, idle.policy));

graph.setSignal("tracking", true);
clock += 1000;
const tracking = graph.evaluate({
  sources: { tracker: { connected: true, stale: false } },
});
console.log("tracking", pipeline.process(inputs.tracking, 1 / 60, tracking.policy));
