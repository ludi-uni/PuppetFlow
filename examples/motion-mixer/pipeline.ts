import type { MotionFrame } from "@puppetflow/core";
import {
  createLowPassFilter,
  createMotionFramePipeline,
} from "@puppetflow/motion-pipeline";

const pipeline = createMotionFramePipeline({
  layers: [
    {
      source: "body",
      priority: 100,
      bones: ["Hips", "Spine", "LeftHand", "RightHand"],
    },
    {
      source: "head",
      priority: 110,
      bones: ["Neck", "Head"],
    },
    {
      source: "expression",
      priority: 100,
      blendShapes: ["Smile", "BlinkLeft", "BlinkRight"],
    },
  ],
  retarget: {
    mapping: {
      Hips: "Pelvis",
      LeftHand: "Hand_L",
      RightHand: "Hand_R",
    },
    bones: {
      Hips: {
        scale: 1.05,
        positionOffset: { x: 0, y: 0.02, z: 0 },
      },
    },
  },
  outputFilters: [
    createLowPassFilter({
      alpha: 0.35,
      bones: ["Head", "Neck"],
    }),
  ],
});

const output = pipeline.process(
  [
    {
      sourceId: "body",
      frame: {
        timestamp: 1000,
        bones: {
          Hips: {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
          Spine: {
            rotation: { x: 0, y: 0.05, z: 0, w: 0.99 },
          },
          LeftHand: {
            position: { x: -0.4, y: 1.2, z: 0 },
          },
          RightHand: {
            position: { x: 0.4, y: 1.2, z: 0 },
          },
        },
      },
    },
    {
      sourceId: "head",
      frame: {
        timestamp: 1001,
        bones: {
          Neck: {
            rotation: { x: 0, y: 0.02, z: 0, w: 1 },
          },
          Head: {
            rotation: { x: 0.03, y: 0.1, z: 0, w: 0.99 },
          },
        },
      },
    },
    {
      sourceId: "expression",
      frame: {
        timestamp: 1002,
        blendShapes: {
          Smile: 0.8,
          BlinkLeft: 0.1,
          BlinkRight: 0.12,
        },
      },
    },
  ],
  1 / 60,
);

if (!output) {
  throw new Error("No motion frame was produced");
}

printMotionFrame(output);

function printMotionFrame(frame: MotionFrame): void {
  console.log(JSON.stringify(frame, null, 2));
}
