import { describe, expect, it } from "vitest";

import { MICRO_BEHAVIOR_STARTER_TEMPLATES } from "../constants/micro-behavior-params.js";
import { createCustomMicroBehaviorTemplate } from "./custom-micro-behaviors.js";
import {
  addKeyframeAtTime,
  addParamToKeyframe,
  definitionToDraft,
  draftFromStarterTemplate,
  draftToDefinition,
  findKeyframeIndexAtTime,
  parseJsonToDraft,
  removeParamFromKeyframe,
  sortDraftKeyframes,
  updateKeyframeTime,
} from "./micro-behavior-draft.js";

describe("micro-behavior-draft", () => {
  it("round-trips through definition", () => {
    const template = createCustomMicroBehaviorTemplate();
    const draft = definitionToDraft(template);
    expect(draftToDefinition(draft)).toEqual(template);
  });

  it("builds starter templates", () => {
    const starter = MICRO_BEHAVIOR_STARTER_TEMPLATES[0]!;
    const draft = draftFromStarterTemplate(starter, "look_up_custom");
    expect(draft.keyframes.length).toBeGreaterThan(1);
    expect(draftToDefinition(draft).id).toBe("look_up_custom");
  });

  it("sorts keyframes by time", () => {
    const draft = sortDraftKeyframes({
      id: "test",
      duration: 1,
      cooldown: 0,
      keyframes: [
        { t: 0.8, params: { lookY: 0.5 } },
        { t: 0, params: { lookY: 0.5 } },
      ],
    });
    expect(draft.keyframes.map((frame) => frame.t)).toEqual([0, 0.8]);
  });

  it("adds keyframes at timeline positions and per-keyframe params", () => {
    const base = definitionToDraft(createCustomMicroBehaviorTemplate());
    const withPoint = addKeyframeAtTime(base, 0.5);
    expect(withPoint.keyframes.some((frame) => Math.abs(frame.t - 0.5) < 0.001)).toBe(true);

    const index = findKeyframeIndexAtTime(withPoint, 0.5);
    expect(index).toBeGreaterThanOrEqual(0);
    const withParam = addParamToKeyframe(withPoint, index, "lookX");
    expect(withParam.keyframes[index]?.params.lookX).toBeDefined();
    expect(withParam.keyframes[0]?.params.lookX).toBeUndefined();

    const moved = updateKeyframeTime(withParam, index, 0.55);
    expect(findKeyframeIndexAtTime(moved, 0.55)).toBeGreaterThanOrEqual(0);

    const withoutParam = removeParamFromKeyframe(withParam, index, "lookX");
    expect(withoutParam.keyframes[index]?.params.lookX).toBeUndefined();
  });

  it("parses editor json into draft", () => {
    const template = createCustomMicroBehaviorTemplate();
    const parsed = parseJsonToDraft(JSON.stringify(template, null, 2));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.draft.id).toBe("my_custom");
    }
  });
});
