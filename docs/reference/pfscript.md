# PFScript

**PFScript** は PuppetFlow の上級者向け Behavior 記述 DSL です。Lua 風の構文ですが **Lua VM は使いません**。パース → AST → Behavior AST へ lower し、既存 `executeBehavior()` で実行します。

| 編集手段   | 向いている人 | Studio タブ        |
| ---------- | ------------ | ------------------ |
| Scratch    | 初心者       | Scratch (Blockly)  |
| Graph      | 中級者       | Graph Editor       |
| **PFScript** | 上級者     | **PFScript**（エキスパート） |

パッケージ: `@puppetflow/pfscript-core` / `@puppetflow/preset`（コンパイル API）

---

## パイプライン上の位置

```text
behaviorPfScript（ソース）
  ↓ parsePfScript / compilePfScript
Behavior AST（ExprAssign / StringCompare / MotionPack 等）
  ↓ executeBehavior（条件付き Pack 収集）
  ↓ merge with plugins / graph
Extension Layer（MotionPack 実行）
  ↓
Rendered MotionState
```

Graph の数値パイプラインとは **別経路** です。同一 Motion キーは merge 時に **平均** されます（[behavior-and-graph.md](behavior-and-graph.md)）。

---

## 構文（Phase 1）

### コメント

```pfscript
-- 行コメント（-- から行末まで）
```

### 代入

```pfscript
smile = interest * 0.4
mouthOpen = volume
headTilt = noise(time * 0.2) * 0.1
```

### 条件分岐

```pfscript
if interest > 0.7 then
    smile = 0.5
elseif interest > 0.4 then
    smile = 0.3
else
    smile = 0.1
end
```

論理演算: `and` / `or` / `not`  
比較: `==` `!=` `>` `>=` `<` `<=`

### Motion Pack 呼び出し

```pfscript
thinking(
    intensity = 0.8
)
```

`CallStmt` は Behavior `MotionPack` に lower され、**If 条件を満たしたときのみ** ランタイムで Extension Layer へ渡されます。

### 文字列比較（リップシンク）

```pfscript
if currentPhoneme == "A" then
    MouthA = 1
end
```

---

## 組み込み変数

| 名前               | 参照元                                              |
| ------------------ | --------------------------------------------------- |
| `interest` 等      | StateStore                                          |
| `volume` 等        | ChannelStore（`volume`, `phoneme`, `emotion` 等）   |
| `time`             | ランタイム経過秒                                    |
| `currentPhoneme`   | Channel `phoneme` → Timeline phoneme → 明示 override |

`currentPhoneme` は Channel キー **`phoneme`**（[sources.md](sources.md)）からも解決されます。

---

## 組み込み関数

| 分類           | 関数                                              |
| -------------- | ------------------------------------------------- |
| Math           | `abs`, `min`, `max`, `clamp`, `floor`, `ceil`, `round` |
| Interpolation  | `lerp(a, b, t)`                                   |
| Trigonometry   | `sin`, `cos`, `tan`                               |
| Noise          | `noise(x)` — 決定論的 1D ノイズ [0, 1)            |
| Timeline       | `eventActive("blink")` — アクティブイベント type 一致 |
| **Stateful**   | `oscillator`, `smooth`, `spring`, `randomHold`, `blink`, `breath`, `wander`, `cooldown` |

Stateful 関数は `id` でインスタンスを識別し、フレーム跨ぎで状態を保持します。詳細: [stateful.md](stateful.md)

```pfscript
bodyLean = oscillator(id = "body", frequency = 0.3) * 0.1 + 0.5
if cooldown(id = "wave", duration = 3) then
    wave()
end
```

`oscillator` / `wander` の出力は **-1〜+1** です。代入前にスケールしてください。

---

## 値域とマージ規則

| 項目 | 規則 |
| ---- | ---- |
| **標準 Motion キー** | 代入値は実質 **0〜1**（`clamp` 推奨）。体の揺れは **0.5 前後を中心** に小さな振幅を足す |
| **custom パラメータ** | 現状 **0〜1**（Extension Mapper も同様） |
| **レイヤー合成** | Plugins + Behavior + Graph は `addMotionState`（デルタ加算）で合成 |
| **静的統合** | `mergeMotionState` は平均（Graph と Behavior の重複キー用） |
| **重複禁止** | 同一キーを Graph と PFScript の両方に書かない（load 時に警告） |
| **意図的重複** | `eyeYaw` は PFScript（energy ベース）+ `blink` プラグインのレイヤリングを許可 |

公式 Standard モデル: 笑顔=`mouthX`（Graph）、体・口=`mouthY` 等（PFScript）、瞬き=`blink`、低 interest 視線=`idle`。

---

Plugin / Extension 関数（`thinking()` 等）は **文としての呼び出し**（`CallStmt`）を使います。式中の任意関数呼び出しは Phase 1 非対応です。

---

## Motion 出力名（エイリアス）

PFScript では Live2D 向けなどの **読みやすい名前** を使えます。未マップ名は `custom` へ書き込まれます。

| PFScript 名   | MotionState キー |
| ------------- | ---------------- |
| `smile`       | `mouthX`         |
| `mouthOpen`   | `mouthY`         |
| `eyeOpen`     | `eyeYaw`         |
| `eyeSmile`    | `eyePitch`       |
| `headTilt` 等 | 同名（標準 14 キー） |
| `MouthA` 等   | `custom.MouthA`  |

標準 16 キー一覧: [motion-state.md](motion-state.md)

---

## 禁止事項（パースエラー）

| 禁止                     | 理由           |
| ------------------------ | -------------- |
| `while` / `for` / `goto` | 無限ループ防止 |
| `require` / `function`   | モジュール禁止 |
| `os.*` / `io.*` / `debug.*` | I/O 禁止    |
| ローカル変数 `let`       | Phase 1 非対応 |

---

## Preset v3 との統合

Optional フィールド `behaviorPfScript` を Preset JSON に保存できます。

```json
{
  "name": "MyCharacter",
  "version": 3,
  "behaviorPfScript": "smile = interest * 0.4",
  "behavior": { "type": "Block", "statements": [] },
  "graph": { "nodes": [], "edges": [] }
}
```

| フィールド           | 説明                                               |
| -------------------- | -------------------------------------------------- |
| `behaviorPfScript`   | ソース（正）。Studio PFScript タブで編集           |
| `behavior`           | コンパイル結果キャッシュ。load 時にソースが優先    |

`behavior` または `behaviorPfScript` の **どちらか一方** があれば load 可能です。

### API

```ts
import { compilePfScript, compileToBehaviorJson } from "@puppetflow/pfscript-core";
import { compilePresetBehavior, loadPreset } from "@puppetflow/preset";

const behavior = compilePfScript(source);
const loaded = loadPreset(json); // behaviorPfScript があれば自動コンパイル
```

Node.js のファイル読込: `import { readPfScriptFile } from "@puppetflow/preset/node"`

---

## Studio での編集

1. **エキスパート** モードに切り替え
2. **PFScript** タブを開く
3. **コンパイル** — behavior JSON プレビュー
4. **Preset に適用** — `behaviorPfScript` + `behavior` を保存しランタイムへ反映
5. **サンプルを挿入** — 公式サンプルをエディタに読み込み

`extensions.packs` と PFScript 内の同一 Pack 呼び出しが重複している場合、警告が表示されます。

---

## 公式サンプル

| ファイル | 内容 |
| -------- | ---- |
| [examples/pfscript/basic-smile.pfscript](../../examples/pfscript/basic-smile.pfscript) | 最小代入 |
| [examples/pfscript/lipsync-thinking.pfscript](../../examples/pfscript/lipsync-thinking.pfscript) | リップシンク + thinking |
| [examples/pfscript/pfscript-demo.pfpreset](../../examples/pfscript/pfscript-demo.pfpreset) | Preset 統合例 |
| [examples/pfscript/stateful-breathing.pfscript](../../examples/pfscript/stateful-breathing.pfscript) | Stateful 呼吸 |
| [examples/pfscript/stateful-spring-look.pfscript](../../examples/pfscript/stateful-spring-look.pfscript) | Spring + smooth |
| [examples/pfscript/stateful-idle.pfscript](../../examples/pfscript/stateful-idle.pfscript) | 待機（blink / wander / cooldown） |

---

## Phase 1 で未実装の仕様項目

[追加仕様.md](../追加仕様.md) に記載があるが Phase 1 では **未対応または部分対応** の例:

- ローカル変数・`targetSmile` のような中間状態
- 式中の Plugin 関数呼び出し（`lerp(smile, targetSmile, 0.1)` 等）
- Pack 引数の式（`thinking(intensity = interest * 0.5)` — 数値リテラルのみ lower）
- PFScript → Graph への自動変換

詳細: [追加仕様.md — 実装メモ](../追加仕様.md#実装メモphase-1)

---

関連: [プリセット](presets.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [Stateful 関数](stateful.md) / [Motion Extension](motion-extension.md) / [実装計画（PFScript）](../implementation-plan-pfscript.md)
