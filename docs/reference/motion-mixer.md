# Motion Mixer

`@puppetflow/motion-pipeline` の `createMotionMixer()` は、複数の
`MotionSource` が生成した `MotionFrame` を component 単位で合成します。

```ts
import { createMotionMixer } from "@puppetflow/motion-pipeline";

const mixer = createMotionMixer([
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
    source: "idle",
    priority: 10,
    weight: 0.25,
  },
]);
```

`priority` が高い layer が、その layer の mask に含まれる骨・BlendShape・parameter
を担当します。最高 priority が同じ場合は `weight` で合成します。rotation は Euler
角ではなく、quaternion の hemisphere correction 付き normalized lerp で合成されます。

未登録 source は `priority: 0, weight: 1` として扱われます。source に該当する
frame がない場合や mask 外の component は、他の入力から引き継がれます。入力の
attachment 順は合成結果の source 選択を変えないよう、priority と component mask を
明示してください。

Runtime に接続する場合は、Mixer 単体ではなく Pipeline を attach します。

```ts
runtime.attachMotionPipeline(
  createMotionFramePipeline({
    mixer: createMotionMixer(layers),
  }),
);
```

この層は純粋な frame 処理なので、UDP や VMC の検証は行いません。出力 adapter の
責務は、合成済み `MotionFrame` を各プロトコルへ配送することです。
