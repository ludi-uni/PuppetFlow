import type {
  MicroBehaviorDefinition,
  MicroBehaviorKeyframe,
} from "@puppetflow/micro-behavior";
import { parseBehaviorDefinitionInput } from "@puppetflow/micro-behavior";

import {
  getMicroBehaviorParamDef,
  MICRO_BEHAVIOR_PARAM_DEFS,
  type MicroBehaviorStarterTemplate,
} from "../constants/micro-behavior-params";
import { parseCustomMicroBehaviorEditorJson } from "./custom-micro-behaviors";

export interface MicroBehaviorDraft {
  id: string;
  duration: number;
  cooldown: number;
  keyframes: MicroBehaviorKeyframe[];
}

export function createEmptyDraft(id = "my_custom"): MicroBehaviorDraft {
  return {
    id,
    duration: 1,
    cooldown: 3,
    keyframes: [
      { t: 0, params: { lookY: 0.5 } },
      { t: 0.4, params: { lookY: 0.25 } },
      { t: 1, params: { lookY: 0.5 } },
    ],
  };
}

export function definitionToDraft(
  definition: MicroBehaviorDefinition,
): MicroBehaviorDraft {
  return {
    id: definition.id,
    duration: definition.duration,
    cooldown: definition.cooldown,
    keyframes: definition.keyframes.map((frame) => ({
      t: frame.t,
      params: { ...frame.params },
    })),
  };
}

export function draftFromStarterTemplate(
  template: MicroBehaviorStarterTemplate,
  id: string,
): MicroBehaviorDraft {
  return {
    id,
    duration: template.duration,
    cooldown: template.cooldown,
    keyframes: template.keyframes.map((frame) => ({
      t: frame.t,
      params: { ...frame.params },
    })),
  };
}

export function sortDraftKeyframes(draft: MicroBehaviorDraft): MicroBehaviorDraft {
  return {
    ...draft,
    keyframes: [...draft.keyframes].sort((a, b) => a.t - b.t),
  };
}

export function collectDraftParamKeys(draft: MicroBehaviorDraft): string[] {
  const keys = new Set<string>();
  for (const frame of draft.keyframes) {
    for (const key of Object.keys(frame.params)) {
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => {
    const indexA = MICRO_BEHAVIOR_PARAM_DEFS.findIndex((def) => def.key === a);
    const indexB = MICRO_BEHAVIOR_PARAM_DEFS.findIndex((def) => def.key === b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }
    return indexA - indexB;
  });
}

export function draftToDefinition(draft: MicroBehaviorDraft): MicroBehaviorDefinition {
  const normalized = sortDraftKeyframes(draft);
  return parseBehaviorDefinitionInput(normalized.id, {
    duration: normalized.duration,
    cooldown: normalized.cooldown,
    keyframes: normalized.keyframes,
  });
}

export function parseJsonToDraft(
  json: string,
): { ok: true; draft: MicroBehaviorDraft } | { ok: false; error: string } {
  const parsed = parseCustomMicroBehaviorEditorJson(json);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, draft: definitionToDraft(parsed.definition) };
}

export function formatDraftValue(value: number): string {
  return value.toFixed(2);
}

export function clampParamValue(key: string, value: number): number {
  const def = getMicroBehaviorParamDef(key);
  if (!def) {
    return value;
  }
  return Math.min(def.max, Math.max(def.min, value));
}

export function defaultParamValue(key: string): number {
  return getMicroBehaviorParamDef(key)?.defaultValue ?? 0;
}

export function addKeyframe(draft: MicroBehaviorDraft): MicroBehaviorDraft {
  const keys = collectDraftParamKeys(draft);
  const last = draft.keyframes[draft.keyframes.length - 1];
  const params: Record<string, number> = {};
  for (const key of keys) {
    params[key] = last?.params[key] ?? defaultParamValue(key);
  }
  const nextTime = Math.min(
    draft.duration,
    Number(((last?.t ?? 0) + draft.duration * 0.25).toFixed(2)),
  );
  return sortDraftKeyframes({
    ...draft,
    keyframes: [...draft.keyframes, { t: nextTime, params }],
  });
}

export function removeKeyframe(
  draft: MicroBehaviorDraft,
  index: number,
): MicroBehaviorDraft {
  if (draft.keyframes.length <= 1) {
    return draft;
  }
  return {
    ...draft,
    keyframes: draft.keyframes.filter((_, frameIndex) => frameIndex !== index),
  };
}

export function addKeyframeAtTime(
  draft: MicroBehaviorDraft,
  t: number,
): MicroBehaviorDraft {
  const clampedT = Math.max(0, Math.min(draft.duration, Number(t.toFixed(2))));
  const existingIndex = draft.keyframes.findIndex(
    (frame) => Math.abs(frame.t - clampedT) < 0.02,
  );
  if (existingIndex >= 0) {
    return draft;
  }

  const sorted = [...draft.keyframes].sort((a, b) => a.t - b.t);
  let nearest = sorted[0];
  for (const frame of sorted) {
    if (frame.t <= clampedT) {
      nearest = frame;
    } else {
      break;
    }
  }

  const params =
    nearest && Object.keys(nearest.params).length > 0
      ? { ...nearest.params }
      : { lookY: defaultParamValue("lookY") };

  return sortDraftKeyframes({
    ...draft,
    keyframes: [...draft.keyframes, { t: clampedT, params }],
  });
}

export function findKeyframeIndexAtTime(draft: MicroBehaviorDraft, t: number): number {
  return draft.keyframes.findIndex((frame) => Math.abs(frame.t - t) < 0.02);
}

export function addParamToKeyframe(
  draft: MicroBehaviorDraft,
  index: number,
  paramKey: string,
): MicroBehaviorDraft {
  const frame = draft.keyframes[index];
  if (!frame || paramKey in frame.params) {
    return draft;
  }

  return {
    ...draft,
    keyframes: draft.keyframes.map((entry, frameIndex) =>
      frameIndex === index
        ? {
            ...entry,
            params: { ...entry.params, [paramKey]: defaultParamValue(paramKey) },
          }
        : entry,
    ),
  };
}

export function removeParamFromKeyframe(
  draft: MicroBehaviorDraft,
  index: number,
  paramKey: string,
): MicroBehaviorDraft {
  const frame = draft.keyframes[index];
  if (!frame) {
    return draft;
  }

  return {
    ...draft,
    keyframes: draft.keyframes.map((entry, frameIndex) => {
      if (frameIndex !== index) {
        return entry;
      }
      const nextParams = { ...entry.params };
      delete nextParams[paramKey];
      return { ...entry, params: nextParams };
    }),
  };
}

export function updateKeyframeTime(
  draft: MicroBehaviorDraft,
  index: number,
  t: number,
): MicroBehaviorDraft {
  const clampedT = Math.max(0, Math.min(draft.duration, Number(t.toFixed(2))));
  const next = sortDraftKeyframes({
    ...draft,
    keyframes: draft.keyframes.map((frame, frameIndex) =>
      frameIndex === index ? { ...frame, t: clampedT } : frame,
    ),
  });
  return next;
}

export function collectKeyframeParamKeys(
  frame: MicroBehaviorKeyframe | undefined,
): string[] {
  if (!frame) {
    return [];
  }
  return Object.keys(frame.params).sort((a, b) => {
    const indexA = MICRO_BEHAVIOR_PARAM_DEFS.findIndex((def) => def.key === a);
    const indexB = MICRO_BEHAVIOR_PARAM_DEFS.findIndex((def) => def.key === b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }
    return indexA - indexB;
  });
}

export function addParamToDraft(
  draft: MicroBehaviorDraft,
  paramKey: string,
): MicroBehaviorDraft {
  if (collectDraftParamKeys(draft).includes(paramKey)) {
    return draft;
  }
  const defaultValue = defaultParamValue(paramKey);
  return {
    ...draft,
    keyframes: draft.keyframes.map((frame) => ({
      ...frame,
      params: { ...frame.params, [paramKey]: defaultValue },
    })),
  };
}

export function removeParamFromDraft(
  draft: MicroBehaviorDraft,
  paramKey: string,
): MicroBehaviorDraft {
  return {
    ...draft,
    keyframes: draft.keyframes.map((frame) => {
      const nextParams = { ...frame.params };
      delete nextParams[paramKey];
      return { ...frame, params: nextParams };
    }),
  };
}

export function validateDraft(draft: MicroBehaviorDraft): string | null {
  try {
    draftToDefinition(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
