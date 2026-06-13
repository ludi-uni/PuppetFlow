# Behavior と Motion Graph

Preset v3 は **behaviorPlugins**、**behavior**、**graph** の 3 層でモーションを生成します。条件分岐は Behavior のみ、数値計算は Graph のみ、という分担です（[ADR](../adr/vnext-design-decisions.md)）。

## 実行順序

```text
StateStore
  → Behavior Plugins（behaviorPlugins）
  → executeBehavior(behavior)
  → executeMotionGraph(graph)
  → merge（同一キーは平均）
  → Motion Modifiers
  → Extension Layer（extensions / MotionPack / motionPack ノード）
  → Adapters
```

Extension Layer の詳細は [motion-extension.md](motion-extension.md) を参照。プラグイン層は [plugins.md](plugins.md)。

## Behavior AST

パッケージ: `@puppetflow/behavior`

| ノード       | 説明                                              |
| ------------ | ------------------------------------------------- |
| `Block`      | 文の連鎖（ルート）                                |
| `If`         | 条件（比較・And/Or/Not）と `then` / 任意の `else` |
| `Assign`     | Motion キーへの代入（`set` / `add`）              |
| `ExprAssign` | 式による Motion / custom 代入（PFScript 由来）    |
| `MotionPack` | Extension Pack の呼び出し（`packId`, `config`） |

gaze / blink 等の組み込み動きは **behaviorPlugins** で定義します（`Builtin` AST ノードは v3 で廃止）。

### 編集方法

- **Studio → Scratch (Blockly):** If / Assign ブロック
- **Studio → PFScript:** DSL ソース（[pfscript.md](pfscript.md)）
- **Preset Manager → behavior JSON:** 直接編集

## Motion Graph

パッケージ: `@puppetflow/motion-graph`

**Logic ノード（If 等）はありません。** 条件分岐が必要な場合は Behavior 側に書きます。

| ノード type                   | 説明                                             |
| ----------------------------- | ------------------------------------------------ |
| `stateInput`                  | State キー（interest, energy, stress 等）を入力  |
| `constant`                    | 定数                                             |
| `time`                        | 経過時間                                         |
| `multiply`, `add`, `subtract` | 四則演算                                         |
| `clamp`                       | 範囲制限                                         |
| `sin`, `noise`                | 周期・ノイズ                                     |
| `output`                      | MotionState キーへ出力                           |
| `motionPack`                  | Extension Pack（エッジ不要・Extension Layer へ） |
| `motionGenerator`             | Extension Generator                              |
| `ext:*`                       | 拡張 Custom Node（例: `ext:heartbeat`）          |

Studio Graph Editor では `position` をノードに保存でき、再読み込み時にレイアウトを復元します。

### 編集方法

- **Studio → Graph Editor:** React Flow UI（エクスポート時に plugins 等を保持）
- **Preset Manager → graph JSON:** 直接編集

数値マッピングは `graph` が唯一の正です。かんたんモードの「動きのつなぎ」も `graph` を編集します。

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
