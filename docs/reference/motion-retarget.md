# Motion Retarget

`applyRetarget()` は入力 skeleton と出力 skeleton の差を、明示的な profile で吸収
します。profile は `MotionFrame` そのものと分離されているため、同じ入力 recording
を複数の avatar に適用できます。

```ts
import { applyRetarget } from "@puppetflow/motion-pipeline";

const result = applyRetarget(frame, {
  mapping: {
    Hips: "Pelvis",
    LeftUpperArm: "Arm_L",
  },
  bones: {
    LeftUpperArm: {
      rotationOffset: { x: 0, y: 0, z: 0, w: 1 },
      positionOffset: { x: 0, y: 0.02, z: 0 },
      scale: 1.05,
    },
  },
});
```

- `mapping` がない骨は同じ bone id のまま保持されます。
- `rotationOffset` は入力 rotation の前に quaternion として適用されます。
- `positionOffset` は scale 適用後の position に加算されます。
- `scale` は position にだけ適用され、未指定時は `1` です。
- partial transform、confidence、未知の骨は失われません。

同じ target bone に複数の入力が写像される場合は、存在する component をマージします。
自動キャリブレーションや avatar-specific の姿勢推定はまだ行わず、読み書き可能な
profile をアプリケーション側で管理します。
