import {
  clamp01,
  createEmptyMotionState,
  mergeMotionState,
  MOTION_STATE_KEYS,
  type BehaviorPlugin,
  type MotionState,
  type MotionStateKey,
  type PluginInputStores,
} from "@puppetflow/core";

export interface RuleConfig {
  input: string;
  output: MotionStateKey;
  gain: number;
}

const MOTION_STATE_KEY_SET = new Set<string>(MOTION_STATE_KEYS);

export function isMotionStateKey(value: string): value is MotionStateKey {
  return MOTION_STATE_KEY_SET.has(value);
}

export class RulePlugin implements BehaviorPlugin {
  readonly id = "rule";

  private readonly rules: RuleConfig[];

  constructor(rules: RuleConfig[]) {
    this.rules = rules;
  }

  process(input: PluginInputStores, _motion: MotionState): Partial<MotionState> {
    const partials: Partial<MotionState>[] = [];

    for (const rule of this.rules) {
      const inputValue = input.state.get(rule.input);
      if (typeof inputValue !== "number") {
        continue;
      }

      partials.push({ [rule.output]: clamp01(inputValue * rule.gain) });
    }

    if (partials.length === 0) {
      return {};
    }

    return mergeMotionState(createEmptyMotionState(), partials);
  }
}

export function createRulePlugin(rules: RuleConfig[]): RulePlugin {
  return new RulePlugin(rules);
}
