export interface MicroBehaviorParamDef {
  key: string;
  label: string;
  simpleLabel: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  hint?: string;
  simpleHint?: string;
}

export const MICRO_BEHAVIOR_PARAM_DEFS: MicroBehaviorParamDef[] = [
  {
    key: "lookX",
    label: "lookX（視線・左右）",
    simpleLabel: "視線・左右",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.5,
    hint: "0=右寄り / 0.5=正面 / 1=左寄り",
    simpleHint: "スライダー中央が正面です",
  },
  {
    key: "lookY",
    label: "lookY（視線・上下）",
    simpleLabel: "視線・上下",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.5,
    hint: "0=下 / 0.5=正面 / 1=上",
    simpleHint: "上を見せたいときは値を大きく",
  },
  {
    key: "eyeY",
    label: "eyeY（目・上下）",
    simpleLabel: "目の上下",
    min: -0.2,
    max: 0.6,
    step: 0.01,
    defaultValue: 0,
    hint: "lookY と同系。上向きは正の値",
  },
  {
    key: "eyeOpen",
    label: "eyeOpen（目の開き）",
    simpleLabel: "目の開き",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 1,
    hint: "0=閉じる / 1=開く",
    simpleHint: "まばたきは 0 に近づける",
  },
  {
    key: "headTilt",
    label: "headTilt（首の傾き）",
    simpleLabel: "首の傾き",
    min: -0.3,
    max: 0.3,
    step: 0.01,
    defaultValue: 0,
    hint: "首を左右に傾ける",
  },
  {
    key: "facePitch",
    label: "facePitch（うなずき）",
    simpleLabel: "うなずき",
    min: -0.2,
    max: 0.3,
    step: 0.01,
    defaultValue: 0,
    hint: "正=下向き（うなずき）",
    simpleHint: "小さなうなずきは 0.05〜0.15 程度",
  },
  {
    key: "faceYaw",
    label: "faceYaw（顔の向き）",
    simpleLabel: "顔の向き",
    min: -0.3,
    max: 0.3,
    step: 0.01,
    defaultValue: 0,
    hint: "headTilt と組み合わせて使う",
  },
];

export const MICRO_BEHAVIOR_PARAM_DEF_MAP = new Map(
  MICRO_BEHAVIOR_PARAM_DEFS.map((def) => [def.key, def]),
);

export function getMicroBehaviorParamDef(
  key: string,
): MicroBehaviorParamDef | undefined {
  return MICRO_BEHAVIOR_PARAM_DEF_MAP.get(key);
}

export interface MicroBehaviorStarterTemplate {
  id: string;
  label: string;
  simpleLabel: string;
  description: string;
  simpleDescription: string;
  duration: number;
  cooldown: number;
  keyframes: Array<{ t: number; params: Record<string, number> }>;
}

export const MICRO_BEHAVIOR_STARTER_TEMPLATES: MicroBehaviorStarterTemplate[] = [
  {
    id: "look_up_custom",
    label: "視線を上げる",
    simpleLabel: "上を見る",
    description: "lookY を上げてから戻す",
    simpleDescription: "ちょっと上を見る動き",
    duration: 1.2,
    cooldown: 5,
    keyframes: [
      { t: 0, params: { lookY: 0.5 } },
      { t: 0.25, params: { lookY: 0.72 } },
      { t: 0.85, params: { lookY: 0.72 } },
      { t: 1.2, params: { lookY: 0.5 } },
    ],
  },
  {
    id: "look_left_custom",
    label: "左を見る",
    simpleLabel: "左を見る",
    description: "lookX を左方向へ",
    simpleDescription: "視線を左へ",
    duration: 1,
    cooldown: 5,
    keyframes: [
      { t: 0, params: { lookX: 0.5 } },
      { t: 0.25, params: { lookX: 0.78 } },
      { t: 0.75, params: { lookX: 0.78 } },
      { t: 1, params: { lookX: 0.5 } },
    ],
  },
  {
    id: "small_nod_custom",
    label: "小さなうなずき",
    simpleLabel: "うなずき",
    description: "facePitch で短いうなずき",
    simpleDescription: "軽くうなずく",
    duration: 0.8,
    cooldown: 3,
    keyframes: [
      { t: 0, params: { facePitch: 0 } },
      { t: 0.15, params: { facePitch: 0.1 } },
      { t: 0.35, params: { facePitch: 0 } },
      { t: 0.55, params: { facePitch: 0.06 } },
      { t: 0.8, params: { facePitch: 0 } },
    ],
  },
  {
    id: "long_blink_custom",
    label: "長めのまばたき",
    simpleLabel: "まばたき",
    description: "eyeOpen を閉じて開く",
    simpleDescription: "ゆっくり目を閉じる",
    duration: 0.6,
    cooldown: 4,
    keyframes: [
      { t: 0, params: { eyeOpen: 1 } },
      { t: 0.15, params: { eyeOpen: 0 } },
      { t: 0.35, params: { eyeOpen: 0 } },
      { t: 0.6, params: { eyeOpen: 1 } },
    ],
  },
];
