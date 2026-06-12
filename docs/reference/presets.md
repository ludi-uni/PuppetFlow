# プリセット

振る舞いを `.pfpreset` JSON で共有する仕組みです。**ランタイムは version 2 のみ** 受け付けます。

## ファイル形式（v2）

```json
{
  "name": "Curious",
  "version": 2,
  "rules": [],
  "behaviorPlugins": [],
  "behavior": {
    "type": "Block",
    "statements": [
      {
        "type": "Builtin",
        "id": "attention",
        "config": { "leanGain": 0.25, "tiltGain": 0.2 }
      },
      { "type": "Builtin", "id": "gaze", "config": { "wanderAmplitude": 0.04 } }
    ]
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
  },
  "modifiers": [
    { "id": "breath", "config": { "period": 4.5, "amplitude": 0.04 } },
    { "id": "noise", "config": { "amplitude": 0.008, "keys": ["mouthX"] } },
    { "id": "smoothing", "config": { "factor": 0.1 } }
  ],
  "modifierOrder": ["breath", "noise", "smoothing"]
}
```

| フィールド        | 必須 | 説明                                 |
| ----------------- | ---- | ------------------------------------ |
| `name`            | ✅   | プリセット名                         |
| `version`         | ✅   | **`2` のみ**（`1` はエラー）         |
| `behavior`        | ✅   | Behavior AST ルート（`Block`）       |
| `graph`           | ✅   | Motion Graph（`nodes` + `edges`）    |
| `rules`           | —    | Rule Plugin 用の gain マッピング配列 |
| `behaviorPlugins` | —    | gaze / blink 等のプラグイン定義      |
| `modifiers`       | —    | smoothing / noise / breath 等        |
| `modifierOrder`   | —    | モディファイア適用順                 |

旧 **Preset v1**（`version: 1` のみ `rules`）は非対応です。v2 では `rules` を **任意フィールド** として併用できます。

## 公式 Behavior Pack（6 種）

パッケージ `@puppetflow/behavior-packs` に同梱。主に `behavior` + `graph` + `modifiers` で構成し、必要に応じて Builtin で gaze / blink を埋め込んでいます。

| 名前     | 概要                                      |
| -------- | ----------------------------------------- |
| Curious  | 注目・視線 + interest → mouthX / headTilt |
| Happy    | 高エネルギー寄りの mouthX / facePitch     |
| Idle     | blink + gaze + idle、待機ゆらぎ           |
| Thinking | 考え中の視線・条件付き headTilt           |
| Sleepy   | まばたき間隔長め・低エネルギー            |
| Focused  | 強めの attention・視線抑制                |

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
// loaded.plugins ← rules + behaviorPlugins から生成
const runtime = new PuppetFlowRuntime().loadPreset(loaded);
await runtime.start();
```

## Studio での編集

| タブ              | 編集対象                                                       |
| ----------------- | -------------------------------------------------------------- |
| Scratch (Blockly) | `behavior`（他フィールド保持）                                 |
| Graph Editor      | `graph`（他フィールド保持）                                    |
| Plugins           | ランタイムへの追加プラグイン（Preset 外）                      |
| Preset Manager    | `rules` / `behaviorPlugins` / `behavior` / `graph` / フル JSON |

適用前に `loadPreset()` 相当のバリデーションが走ります。

## 配布

`.pfpreset` を共有し、Studio のインポートまたは `loadPreset()` で利用できます。

関連: [Behavior Plugins](plugins.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [MotionState](motion-state.md)
