# プリセット

振る舞いを `.pfpreset` JSON で共有する仕組みです。**ランタイムは version 3 のみ** 受け付けます。

## ファイル形式（v3）

```json
{
  "name": "Curious",
  "version": 3,
  "behaviorPlugins": [
    { "id": "attention", "config": { "leanGain": 0.25, "tiltGain": 0.2 } },
    { "id": "gaze", "config": { "wanderAmplitude": 0.04 } }
  ],
  "behavior": {
    "type": "Block",
    "statements": []
  },
  "graph": {
    "nodes": [
      { "id": "in-interest", "type": "stateInput", "data": { "key": "interest" } },
      { "id": "mul", "type": "multiply", "data": { "gain": 0.5 } },
      { "id": "out", "type": "output", "data": { "key": "mouthX" } }
    ],
    "edges": [
      { "id": "e1", "source": "in-interest", "target": "mul" },
      { "id": "e2", "source": "mul", "target": "out" }
    ]
  }
}
```

| フィールド        | 必須 | 説明                                            |
| ----------------- | ---- | ----------------------------------------------- |
| `name`            | ✅   | プリセット名                                    |
| `version`         | ✅   | **`3` のみ**                                    |
| `behavior`        | ✅   | Behavior AST ルート（`If` / `Assign`）          |
| `graph`           | ✅   | Motion Graph（`nodes` + `edges`）               |
| `behaviorPlugins` | —    | gaze / blink 等のプラグイン定義                 |
| `extensions`      | —    | Motion Pack / 独自パラメータ（Extension Layer） |

### 廃止されたフィールド（v3 ではエラー）

| フィールド               | 代替                                           |
| ------------------------ | ---------------------------------------------- |
| `rules`                  | `graph` の stateInput → multiply → output 連鎖 |
| `modifiers`              | なし（Preset 外。ランタイム API で任意追加可） |
| `modifierOrder`          | 同上                                           |
| `Builtin`（behavior 内） | `behaviorPlugins` に移す                       |

旧 **Preset v2**（`rules` / `modifiers` / `Builtin` 併用）は非対応です。

## 公式 Behavior Pack（6 種）

パッケージ `@puppetflow/behavior-packs` に同梱。`behaviorPlugins` + `graph` + 必要に応じて `behavior`（If / Assign）で構成します。

| 名前     | 概要                                   |
| -------- | -------------------------------------- |
| Curious  | attention + gaze、interest → mouthX 等 |
| Happy    | 高エネルギー寄りの mouthX / facePitch  |
| Idle     | blink + gaze + idle、待機ゆらぎ        |
| Thinking | 考え中の視線・条件付き headTilt        |
| Sleepy   | まばたき間隔長め・低エネルギー         |
| Focused  | 強めの attention・視線抑制             |

```ts
import { getPresetJson, listPresetNames } from "@puppetflow/behavior-packs";

const json = getPresetJson("Curious");
```

ファイル実体: `packages/behavior-packs/presets/*.pfpreset`

## 読み込み API

```ts
import { loadPreset } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const loaded = loadPreset(presetJson);
// loaded.plugins ← behaviorPlugins から生成
const runtime = new PuppetFlowRuntime().loadPreset(loaded);
await runtime.start();
```

## Studio での編集

| タブ              | 編集対象                                  |
| ----------------- | ----------------------------------------- |
| Scratch (Blockly) | `behavior`（If / Assign）                 |
| Graph Editor      | `graph`                                   |
| 動きのつなぎ      | `graph`（かんたんモードの表 UI）          |
| Plugins           | ランタイムへの追加プラグイン（Preset 外） |
| Preset Manager    | `behaviorPlugins` / `behavior` / `graph`  |

適用前に `loadPreset()` 相当のバリデーションが走ります。

## 配布

`.pfpreset` を共有し、Studio のインポートまたは `loadPreset()` で利用できます。

関連: [Behavior Plugins](plugins.md) / [Motion Extension](motion-extension.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [MotionState](motion-state.md)
