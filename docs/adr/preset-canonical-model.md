# ADR — Preset Canonical Model & Motion Merge

**ステータス:** 採用（2026-06）  
**関連:** [presets.md](../reference/presets.md) / [pfscript.md](../reference/pfscript.md) / [motion-state.md](../reference/motion-state.md)

## 文脈

Preset v3 では **PFScript**・**Graph**・**behaviorPlugins**・**extensions** が同一 Motion キーを触りうる。  
公式プリセットは **Standard モデル**（笑顔=Graph、体・呼吸=PFScript、瞬き=blink）に統一したが、次をコードとドキュメントで固定する必要がある。

1. `behaviorPfScript` と `behavior` AST の正本関係
2. パイプライン各段のマージ規則（`addMotionState` vs `mergeMotionState`）
3. `custom:*` パラメータの値域

## 決定

### 1. 正本は `behaviorPfScript`、AST はキャッシュ

| フィールド             | 役割                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| **`behaviorPfScript`** | 人間が編集する **ソース**。Git・Studio PFScript タブの正本。         |
| **`behavior`**         | `compilePfScript()` の **キャッシュ AST**。Scratch/JSON ツール向け。 |

**ルール:**

- `loadPreset()` / `compilePresetBehavior()` は **`behaviorPfScript` があれば常にそこから再コンパイル** し、キャッシュを無視する。
- 保存・生成時は `materializePresetBehavior()` で **キャッシュをソースと同期** する（`pnpm build:presets`、今後の Studio エクスポート）。
- 両方欠如はエラー。PFScript のみの JSON も可（load 時に AST 生成）。

### 2. Standard モデルの層分担

| 層                  | 担当                                                       | 非担当                               |
| ------------------- | ---------------------------------------------------------- | ------------------------------------ |
| **Graph**           | `interest → mouthX` 等、かんたんモードで編集するマッピング | 条件分岐・stateful・Pack             |
| **PFScript**        | 体・呼吸・volume→mouthY・custom リップシンク               | Graph と同じ標準キー（overlap 警告） |
| **behaviorPlugins** | blink（`eyeYaw` 上書き）・idle（低 interest 視線）         | プリセット固有の性格表現             |
| **extensions**      | thinking / tail 等 Pack                                    | PFScript で既に書く標準キー          |

**意図的重複（警告対象外）:** PFScript の `eyeYaw`（energy ベースライン）+ `plugin:blink`（瞬き）は `addMotionState` で合成。

### 3. マージ規則

| 関数                   | 用途                                                                        | 合成                                      |
| ---------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| **`addMotionState`**   | **Runtime 60Hz パイプライン**（plugins → behavior → graph の partial 配列） | 各キー: ニュートラルからの **デルタ加算** |
| **`mergeMotionState`** | 複数ソースの **静的統合**（テスト・将来のオフライン合成）                   | 各キー: 値の **平均**                     |

Runtime は plugins / behavior / graph の出力を **順に `addMotionState` で合成** して `targetMotion` を得る。Modifiers は target → rendered の後処理。

### 4. custom パラメータ値域（現行）

- 標準キー・`custom:*` とも **代入は `clamp01`（0〜1）**。
- PFScript 式の中間計算は負値可。最終代入のみクランプ。
- signed custom（例: -1〜1 OSC）は **将来の Preset v4** で検討。現状は Mapper の `transform` で対応。

## API（`@puppetflow/preset`）

```ts
import {
  collectPresetMotionKeys,
  collectPresetCustomMotionKeysFromJson,
  detectPresetMotionOverlaps,
  materializePresetBehavior,
  loadPreset,
} from "@puppetflow/preset";
```

## 影響

- 公式 preset 生成: `packages/preset/src/build-official-presets.ts`（`pnpm build:presets`）
- Studio Mapper: `collectPresetCustomMotionKeysFromJson` で PFScript custom を列挙
- CI: preset ミラー同期 + overlap ゼロ（`official-presets.test.ts`）

## 却下した案

| 案                                          | 却下理由                                           |
| ------------------------------------------- | -------------------------------------------------- |
| `behavior` AST を正本にする                 | PFScript 編集フローと乖離、キャッシュドリフト      |
| Runtime で `mergeMotionState`（平均）を使う | プラグイン重ね合わせの意図（瞬き等）が表現できない |
| custom の signed 値域を即導入               | Mapper / OSC プロファイル全体への波及が大きい      |
