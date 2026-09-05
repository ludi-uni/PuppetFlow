import {
  quaternionFromEuler,
  type ActingBoneProfile,
  type ActingExpressionProfile,
} from "@puppetflow/runtime";
const RELAXED_UPPER_ARM_ANGLE_RADIANS = (Math.PI * 5) / 12;
export const DEFAULT_ACTING_BONE_PROFILE: ActingBoneProfile = {
  id: "default-vrm-humanoid",
  bones: [
    { name: "Hips", position: { x: -4.16676547e-14, y: 0.8669316, z: 0.04389208 } },
    { name: "Spine", position: { x: -9.18101044e-15, y: 0.147577465, z: -0.03021568 } },
    {
      name: "Chest",
      position: { x: -6.179522e-15, y: 0.112452745, z: -0.00230586529 },
    },
    {
      name: "Neck",
      position: { x: -5.47329651e-15, y: 0.131847978, z: -0.00230610371 },
    },
    { name: "Head", position: { x: -4.943623e-15, y: 0.0983578, z: -0.0045081377 } },
    {
      name: "LeftShoulder",
      position: { x: -0.02662831, y: 0.140198708, z: -0.0274006128 },
    },
    {
      name: "LeftUpperArm",
      position: { x: -0.0820496753, y: 0.0113123655, z: 0.0255604982 },
      neutralRotation: quaternionFromEuler({
        x: 0,
        y: 0,
        z: RELAXED_UPPER_ARM_ANGLE_RADIANS,
      }),
    },
    {
      name: "LeftLowerArm",
      position: { x: -0.237792939, y: -0.00679159164, z: 0.000662565231 },
    },
    {
      name: "RightShoulder",
      position: { x: 0.02662831, y: 0.140198708, z: -0.0274006128 },
    },
    {
      name: "RightUpperArm",
      position: { x: 0.0820496455, y: 0.0113123655, z: 0.0255606174 },
      neutralRotation: quaternionFromEuler({
        x: 0,
        y: 0,
        z: -RELAXED_UPPER_ARM_ANGLE_RADIANS,
      }),
    },
    {
      name: "RightLowerArm",
      position: { x: 0.237793088, y: -0.00679159164, z: 0.000662922859 },
    },
  ],
};
export const DEFAULT_EXPRESSION_PROFILE: ActingExpressionProfile = {
  id: "default-vrm-expression",
  expressions: {
    happy: { blendShape: "Warai" },
    sad: { blendShape: "Sorrow" },
    angry: { blendShape: "Angry" },
    relaxed: { blendShape: "Fun" },
    surprised: { blendShape: "Hirameki" },
  },
};
