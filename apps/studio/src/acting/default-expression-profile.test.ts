import { describe, expect, it } from "vitest";
import { DEFAULT_EXPRESSION_PROFILE } from "./default-expression-profile";

describe("DEFAULT_EXPRESSION_PROFILE", () => {
  it("maps semantic Studio expressions to the verified VRM calibration", () => {
    expect(DEFAULT_EXPRESSION_PROFILE).toEqual({
      id: "default-vrm-expression",
      expressions: {
        happy: { blendShape: "Warai" },
        sad: { blendShape: "Sorrow" },
        angry: { blendShape: "Angry" },
        relaxed: { blendShape: "Fun" },
        surprised: { blendShape: "Hirameki" },
      },
    });
  });
});
