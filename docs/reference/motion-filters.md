# Motion Filter Pipeline

Filter は `MotionFrameFilter` の小さな interface で、source 前処理と mixer 後の
output 処理のどちらにも配置できます。

```ts
import {
  createDeadzoneFilter,
  createLowPassFilter,
  createMotionFramePipeline,
} from "@puppetflow/motion-pipeline";

const pipeline = createMotionFramePipeline({
  sourceFilters: {
    webcam: [
      createDeadzoneFilter({
        deadzone: 0.04,
        blendShapes: ["BlinkLeft", "BlinkRight"],
      }),
    ],
  },
  outputFilters: [
    createLowPassFilter({
      alpha: 0.35,
      bones: ["Head", "LeftHand", "RightHand"],
    }),
  ],
});
```

標準 filter は次の 3 種類です。

- `createDeadzoneFilter`: 数値 component の小さな揺れを `0` にします。
- `createClampFilter`: BlendShape と parameter を指定範囲へ制限します。
- `createLowPassFilter`: 数値 component と bone transform を前フレームから平滑化します。

各 filter は `bones`、`blendShapes`、`parameters` の mask を持てます。mask を省略した
domain は全 component が対象です。quaternion は符号反転による長い補間経路を避けて
normalized lerp されます。Pipeline の `reset()` は source stop/restart の境界で
filter state を消去します。

処理順は次のとおりです。

```text
MotionSource -> sourceFilters -> MotionMixer -> Retarget -> outputFilters -> Adapter
```

独自 filter は `id`、`apply(frame, deltaTime)`、`reset()` を実装すれば追加できます。
I/O やプロトコル状態を filter に持たせず、frame 変換だけを担当させてください。
