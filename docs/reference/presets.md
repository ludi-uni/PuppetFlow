# プリセット

振る舞いを `.pfpreset` JSON で共有する仕組みです。**ランタイムは version 3 のみ** 受け付けます。

## 標準構成（Standard モデル）

公式プリセットは `Standard.pfpreset` を基準に、次の **役割分担** で構成します。

| 層                                | 担当                                                                                | 例                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| **PFScript** (`behaviorPfScript`) | 体の揺れ、前のめり、口開き（volume）、まぶた開き（energy→`eyeYaw`）、呼吸（custom） | `bodyLean`, `mouthY`, `eyeYaw`, `custom:breath` |
| **Graph**                         | かんたんモードで編集する笑顔マッピング                                              | `interest × gain → mouthX`                      |
| **behaviorPlugins**               | 瞬き（`eyeYaw` 上書き）・低 interest 時の視線 wander                                | `blink`, `idle`                                 |
| **extensions**                    | Motion Pack（Thinking 等）                                                          | `thinking`                                      |

**同一 Motion キーを PFScript と Graph の両方に書かない** こと（load 時に overlap 警告）。笑顔は Graph、体・呼吸は PFScript に寄せます。

再生成: `pnpm build:presets`（`packages/preset/src/build-official-presets.ts`）

## ファイル形式（v3）

```json
{
  "name": "Curious",
  "version": 3,
  "behaviorPfScript": "bodyLean = oscillator(...) + 0.5\nmouthY = volume\nbreath = breath(0.1)",
  "behavior": { "type": "Block", "statements": [] },
  "behaviorPlugins": [
    { "id": "blink", "config": { "minInterval": 3, "maxInterval": 8 } },
    { "id": "idle", "config": { "interestThreshold": 0.35, "wanderBoost": 0.12 } }
  ],
  "graph": {
    "nodes": [
      { "id": "interest", "type": "stateInput", "data": { "key": "interest" } },
      { "id": "multiply", "type": "multiply", "data": { "gain": 0.5 } },
      { "id": "mouthX", "type": "output", "data": { "key": "mouthX" } }
    ],
    "edges": [
      { "id": "e1", "source": "interest", "target": "multiply" },
      { "id": "e2", "source": "multiply", "target": "mouthX" }
    ]
  },
  "extensions": { "packs": [] }
}
```

| フィールド         | 必須 | 説明                                                  |
| ------------------ | ---- | ----------------------------------------------------- |
| `name`             | ✅   | プリセット名                                          |
| `version`          | ✅   | **`3` のみ**                                          |
| `behavior`         | △    | Behavior AST（`behaviorPfScript` があればキャッシュ） |
| `behaviorPfScript` | —    | PFScript ソース（load 時に `behavior` へコンパイル）  |
| `graph`            | ✅   | Motion Graph（`nodes` + `edges`）                     |
| `behaviorPlugins`  | —    | blink / idle 等のプラグイン定義                       |
| `extensions`       | —    | Motion Pack / 独自パラメータ（Extension Layer）       |

`behavior` または `behaviorPfScript` のどちらか一方が必要です。両方ある場合 **ソース（`behaviorPfScript`）が優先** されます。

詳細: [PFScript](pfscript.md)

### 廃止されたフィールド（v3 ではエラー）

| フィールド               | 代替                                           |
| ------------------------ | ---------------------------------------------- |
| `rules`                  | `graph` の stateInput → multiply → output 連鎖 |
| `modifiers`              | なし（Preset 外。ランタイム API で任意追加可） |
| `modifierOrder`          | 同上                                           |
| `Builtin`（behavior 内） | `behaviorPlugins` に移す                       |

旧 **Preset v2**（`rules` / `modifiers` / `Builtin` 併用）は非対応です。

## 公式プリセット（6 種 + Standard）

| 名前         | 概要                                                     |
| ------------ | -------------------------------------------------------- |
| **Standard** | 基準テンプレート（PFScript + blink/idle + Graph mouthX） |
| Curious      | Standard 同等・きょろきょろ                              |
| Happy        | 活発な揺れ・明るい笑顔（Graph gain 0.8）                 |
| Idle         | 控えめな揺れ・待機向け                                   |
| Thinking     | 控えめ + `headTilt` + `thinking` Pack                    |
| Sleepy       | ゆっくり・半開き目・長めのまばたき                       |
| Focused      | 引き締め・前のめり強め                                   |

```ts
import { getPresetJson, listPresetNames } from "@puppetflow/behavior-packs";

const json = getPresetJson("Curious");
```

**正本:** `packages/behavior-packs/presets/*.pfpreset`  
**ミラー:** リポジトリルート `presets/`（`pnpm build:presets` で同期。CI で差分チェック）

## 読み込み API

```ts
import { loadPreset, detectPresetMotionOverlaps } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const loaded = loadPreset(presetJson);
// loaded.warnings に graph/behavior/plugin の重複があれば文字列で入る
const runtime = new PuppetFlowRuntime().loadPreset(loaded);
await runtime.start();
```

`detectPresetMotionOverlaps()` は PFScript の `ExprAssign` も behavior 出力として検出します。

## Studio での編集

| タブ              | 編集対象                                     |
| ----------------- | -------------------------------------------- |
| Scratch (Blockly) | `behavior`（If / Assign）                    |
| **PFScript**      | `behaviorPfScript` + コンパイル済 `behavior` |
| Graph Editor      | `graph`                                      |
| 動きのつなぎ      | `graph`（かんたんモードの表 UI）             |
| オプション動き    | `behaviorPlugins` / `extensions`             |
| Preset Manager    | JSON 直接編集                                |

適用前に `loadPreset()` 相当のバリデーションが走ります。

## 配布

`.pfpreset` を共有し、Studio のインポートまたは `loadPreset()` で利用できます。

関連: [PFScript](pfscript.md) / [Behavior Plugins](plugins.md) / [Motion Extension](motion-extension.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [MotionState](motion-state.md)
