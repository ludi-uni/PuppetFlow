# Behavior と Motion Graph

Preset v2 は **Plugins**、**behavior**、**graph** の 3 層でモーションを生成します。条件分岐は Behavior のみ、数値計算は Graph のみ、という分担です（[ADR](../adr/vnext-design-decisions.md)）。

## 実行順序

```text
StateStore
  → Behavior Plugins（rules / behaviorPlugins）
  → executeBehavior(behavior)
  → executeMotionGraph(graph)
  → merge（同一キーは平均）
  → Modifiers
  → Adapters
```

プラグイン層の詳細は [plugins.md](plugins.md) を参照。

## Behavior AST

パッケージ: `@puppetflow/behavior`

| ノード    | 説明                                              |
| --------- | ------------------------------------------------- |
| `Block`   | 文の連鎖（ルート）                                |
| `If`      | 条件（比較・And/Or/Not）と `then` / 任意の `else` |
| `Assign`  | Motion キーへの代入（`set` / `add`）              |
| `Builtin` | `gaze`, `blink`, `idle`, `attention`, `emotion`   |

### Builtin 概要

| id          | 効果                                                    |
| ----------- | ------------------------------------------------------- |
| `gaze`      | `lookX` / `lookY` のゆらぎ                              |
| `blink`     | `facePitch` による瞬き                                  |
| `idle`      | 低 interest 時の視線ゆらぎ強化                          |
| `attention` | `bodyLean` / `headTilt` を interest に連動              |
| `emotion`   | joy / sadness / anger State から `mouthX` / `facePitch` |

Builtin と同名の **Behavior Plugin**（`behaviorPlugins`）は同系統の動きを提供します。Scratch の Builtin とプラグインを重複させないよう注意してください。

### 編集方法

- **Studio → Scratch (Blockly):** If / Assign / Builtin ブロック
- **Preset Manager → behavior JSON:** 直接編集

## Motion Graph

パッケージ: `@puppetflow/motion-graph`

**Logic ノード（If 等）はありません。** 条件分岐が必要な場合は Behavior 側に書きます。

| ノード type                   | 説明                                            |
| ----------------------------- | ----------------------------------------------- |
| `stateInput`                  | State キー（interest, energy, stress 等）を入力 |
| `constant`                    | 定数                                            |
| `time`                        | 経過時間                                        |
| `multiply`, `add`, `subtract` | 四則演算                                        |
| `clamp`                       | 範囲制限                                        |
| `sin`, `noise`                | 周期・ノイズ                                    |
| `output`                      | MotionState キーへ出力                          |

### 編集方法

- **Studio → Graph Editor:** React Flow UI（エクスポート時に plugins 等を保持）
- **Preset Manager → graph JSON:** 直接編集

Graph Editor は `rules` のみの Preset もノードとして読み込めます。graph をエクスポートすると数値マッピングは `graph` が正となり、`rules` はクリアされます（二重適用防止）。

## 例（最小）

```json
{
  "behaviorPlugins": [{ "id": "gaze", "config": { "wanderAmplitude": 0.04 } }],
  "behavior": {
    "type": "Block",
    "statements": []
  },
  "graph": {
    "nodes": [
      { "id": "in", "type": "stateInput", "data": { "key": "interest" } },
      { "id": "mul", "type": "multiply", "data": { "gain": 0.5 } },
      { "id": "out", "type": "output", "data": { "key": "mouthX" } }
    ],
    "edges": [
      { "id": "e1", "source": "in", "target": "mul" },
      { "id": "e2", "source": "mul", "target": "out" }
    ]
  }
}
```

`interest = 0.8` のとき Graph 段階で `mouthX ≈ 0.4`、Gaze プラグインで `lookX` / `lookY` がゆらぎます。
