# Behavior Plugins

State から Motion へ変換する **拡張可能なプラグイン層** です。Preset v2 の `rules` / `behaviorPlugins`、または Studio の Plugins タブから有効化します。

Behavior AST・Motion Graph と **併用** できます。各段階の出力は平均マージされ、Modifier 適用後に Adapter へ渡ります。

## パイプライン上の位置

```text
StateStore
  ↓
Behavior Plugins     ← rule, gaze, blink, idle, attention, emotion
  ↓
Behavior Runtime     ← If / Assign / Builtin（Scratch）
  ↓
Motion Graph         ← 数値ノード（Graph Editor）
  ↓
merge → Modifiers → Rendered Motion → Adapters
```

## 公式プラグイン

| パッケージ                     | id          | 役割                                     |
| ------------------------------ | ----------- | ---------------------------------------- |
| `@puppetflow/plugin-rule`      | `rule`      | `input × gain → output` の線形マッピング |
| `@puppetflow/plugin-gaze`      | `gaze`      | 視線ゆらぎ（`lookX` / `lookY`）          |
| `@puppetflow/plugin-blink`     | `blink`     | 瞬き（`facePitch`）                      |
| `@puppetflow/plugin-idle`      | `idle`      | 低 interest 時の待機視線                 |
| `@puppetflow/plugin-attention` | `attention` | interest 連動の姿勢                      |
| `@puppetflow/plugin-emotion`   | `emotion`   | joy / sadness / anger → 表情             |

### Rule Plugin

```json
"rules": [
  { "input": "interest", "output": "mouthX", "gain": 0.5 },
  { "input": "energy", "output": "facePitch", "gain": 0.8 }
]
```

同一 `output` への複数ルールは **平均** してマージします。

### Character Plugins

```json
"behaviorPlugins": [
  { "id": "gaze", "config": { "wanderAmplitude": 0.04, "speed": 0.3 } },
  { "id": "blink" }
]
```

`gaze` / `blink` 等は Behavior の **Builtin** と同系統の動きですが、プラグインとして独立に追加・削除できます。

## Preset v2 での定義

`version` は **2 のまま**、`behavior` / `graph` と併記します（旧 v1 形式とは別）。

```json
{
  "name": "Custom",
  "version": 2,
  "rules": [],
  "behaviorPlugins": [{ "id": "gaze" }],
  "behavior": { "type": "Block", "statements": [] },
  "graph": { "nodes": [], "edges": [] },
  "modifiers": [],
  "modifierOrder": ["breath", "noise", "smoothing"]
}
```

`loadPreset()` は `rules` と `behaviorPlugins` から `BehaviorPlugin` インスタンスを生成し、`runtime.loadPreset()` で登録します。

## ランタイム API

```ts
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { GazePlugin } from "@puppetflow/plugin-gaze";
import { createRulePlugin } from "@puppetflow/plugin-rule";

const runtime = new PuppetFlowRuntime()
  .use(createRulePlugin([{ input: "interest", output: "mouthX", gain: 0.5 }]))
  .use(new GazePlugin({ wanderAmplitude: 0.04 }));
```

Preset 読み込み後に `runtime.use()` で追加することもできます（同一 id の重複に注意）。

## Studio での編集

| タブ               | プラグイン関連                                              |
| ------------------ | ----------------------------------------------------------- |
| **Plugins**        | Preset 外から gaze / blink 等を ON/OFF（Apply Plugins）     |
| **Preset Manager** | `rules` / `behaviorPlugins` JSON エディタ                   |
| **Graph Editor**   | エクスポート時に plugins / behavior / modifiers を **保持** |
| **Scratch**        | behavior 適用時に plugins フィールドを **保持**             |
| **Motion Mapper**  | **Rendered Motion**（plugins 適用後）を OSC 送信            |
| **Pipeline**       | 各プラグイン段階の出力を表形式で表示                        |

Graph Editor は `graph` を編集します。ノードをエクスポートすると `graph` が更新され、重複を避けるため `rules` は空にされます（数値マッピングは graph が正）。

`rules` のみの Preset は Graph Editor 上でノードとして読み込めます。

## Builtin との使い分け

| 手段                          | 向いている用途                                   |
| ----------------------------- | ------------------------------------------------ |
| **Builtin**（`behavior` AST） | Scratch で条件付きに gaze / blink を組み合わせる |
| **behaviorPlugins**           | Preset に固定の動きを宣言する                    |
| **Plugins タブ**              | 試行錯誤・一時的な追加                           |
| **rules**                     | シンプルな gain マッピング（Graph なしでも可）   |
| **graph**                     | 複数ノード・Clamp 等を含む数値処理               |

関連: [プリセット](presets.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [Studio ガイド](../guides/studio.md)
