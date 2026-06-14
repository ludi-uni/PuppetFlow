# Stateful 関数・ノード

**Stateful** はフレーム跨ぎで内部状態を保持する関数群です。呼吸・慣性・探索・瞬きなど、時間と履歴に依存する動きを PFScript / Motion Graph / Extension Pack から共通 API で扱います。

パッケージ: `@puppetflow/stateful-core`

関連: [PFScript](pfscript.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [Motion Extension](motion-extension.md) / [実装計画](../implementation-plan-stateful.md)

---

## パイプライン上の位置

```text
PuppetFlowRuntime
  └ StatefulStore（ランタイム単位・loadPreset で reset）
       ├ Behavior / PFScript 式評価（evaluateCall）
       ├ Motion Graph（stateful ノード）
       └ Extension Pack（runStatefulNumber）
```

`SmoothingModifier`（Rendered 全体の低域通過）とは **別物** です。`smooth(id, value, speed)` は信号単位の指数平滑です。

---

## FrameContext

| フィールド      | 説明                         |
| --------------- | ---------------------------- |
| `deltaTime`     | 前フレームからの経過秒       |
| `frameNumber`   | 累積フレーム番号             |
| `elapsedTime`   | ランタイム開始からの経過秒   |

Runtime が毎 tick 生成し、Behavior / Graph / Extension に渡します。

---

## 状態のスコープ

- 状態は **`functionName` + `instanceId`** で分離されます（例: `oscillator` / `"body"`）。
- **Preset には保存しません**。`loadPreset()` / `stop()` で `StatefulStore.reset()`。
- 乱数系（`wander`, `randomHold`, `blink`, `earPhysics`）は `instanceId` から **決定論的** に生成します。

---

## 組み込み関数一覧

| 関数 | 出力レンジ | 主な config | 用途 |
| ---- | ---------- | ----------- | ---- |
| `oscillator` | **-1〜+1** | `frequency` | 周期振動（位相保持） |
| `smooth` | 入力に追従 | `speed` + 入力 `value` | 指数平滑 |
| `spring` | 入力に追従 | `stiffness`, `damping` + 入力 `target` | バネ追従 |
| `randomHold` | `min`〜`max` | `interval`, `min`, `max` | 一定間隔で値更新 |
| `blink` | 0〜1 | `averageInterval` | 瞬きパルス |
| `breath` | 0〜1 | `rate` | 呼吸サイクル |
| `wander` | おおよそ **-1〜+1** | `speed` | ランダム目標へ滑らか移動 |
| `cooldown` | **boolean** | `duration` | クールダウン窓（1 回だけ true） |
| `tailPhysics` | 0〜1 | `frequency`, `amplitude`, `stiffness`, `damping` | 尻尾スプリング振り |
| `earPhysics` | 0〜1 | `intensity`, `holdInterval`, `stiffness`, `damping` | 耳ぴくぴく（ランダム保持 + スプリング） |

`tailPhysics` / `earPhysics` は Runtime 登録時に Physics プラグイン経由で追加されます（`createRuntimeStatefulRegistry()`）。

### PFScript での呼び出し

```pfscript
bodyLean = oscillator(id = "body", frequency = 0.3) * 0.1 + 0.5
interestSmooth = smooth(id = "interest", value = interest, speed = 2)

if cooldown(id = "wave", duration = 3) then
    wave()
end
```

`oscillator` / `wander` は **-1〜+1** を返すため、MotionState 代入前にスケールしてください。

### Motion Graph ノード

Studio Graph Editor の **Stateful** ツールバーから配置できます。ノード `type` は関数名と同じ（`oscillator`, `smooth`, `spring` 等）。`data.id` でインスタンスを識別します。

---

## Extension Pack からの利用

`ExtensionContext` に `statefulStore`, `statefulRegistry`, `frame` が渡されます（Runtime 経由）。

```ts
import { runStatefulNumber } from "@puppetflow/stateful-core";

const wag = runStatefulNumber(ctx, "tailPhysics", "tailWag", {
  frequency: 2 + intensity,
  amplitude: intensity * 0.5,
});
```

ストア未注入時は `undefined` を返すため、従来の `Math.sin` 等への **フォールバック** を推奨します。

### M4 で stateful 化した Pack

| Pack | 利用関数 |
| ---- | -------- |
| `tailWag` | `tailPhysics` |
| `earTwitch` | `earPhysics` |
| `thinking` | `oscillator`（視線の微振動） |
| `lookAround` | `wander` + `oscillator` |

既存の `gaze` / `blink` **behaviorPlugins** は Runtime 注入時に stateful 関数へ委譲します（設定キーは従来どおり）。Scratch の **Natural Motion** カテゴリから同等の動きを behavior へ追加できます。

| Plugin / ブロック | 内部関数 |
| ----------------- | -------- |
| `gaze` plugin | `oscillator`（lookX / lookY、位相オフセット） |
| `blink` plugin | `blink` |
| Scratch「呼吸する」 | `breath` |
| Scratch「ゆっくり追従する」 | `smooth` |
| Scratch「ランダムに視線移動」 | `wander` |
| Scratch「一定間隔で瞬き」 | `blink` |

---

## プラグイン API

```ts
import {
  createStatefulPlugin,
  registerStatefulPlugins,
  type StatefulNodePlugin,
} from "@puppetflow/stateful-core";

const myPlugin = createStatefulPlugin("myPack", [myDefinition]);
registerStatefulPlugins(registry, [myPlugin]);
```

---

## 公式サンプル

| ファイル | 内容 |
| -------- | ---- |
| [stateful-breathing.pfscript](../../examples/pfscript/stateful-breathing.pfscript) | `breath` + `oscillator` |
| [stateful-spring-look.pfscript](../../examples/pfscript/stateful-spring-look.pfscript) | `spring` + `smooth` |
| [stateful-idle.pfscript](../../examples/pfscript/stateful-idle.pfscript) | 待機（blink / wander / cooldown） |

---

## デバッグ

Studio **エキスパートモード → Pipeline タブ** の「Stateful 状態」セクションで、各インスタンスの **関数名 / id / 現在値 / 内部 state JSON** をリアルタイム表示できます。
