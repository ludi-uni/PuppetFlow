# ADR: Behavior Plugin 層（公式 / レガシー）

## 状況

Behavior Plugins は `lookX` / `bodyLean` / `mouthX` 等の標準 Motion キーを直接書き込む。PFScript・Graph と **同一キーを奪い合う** と見た目が不安定になる。

公式 6 preset は **blink + idle** に統一済み。`gaze` / `attention` / `emotion` は旧構成の名残としてパッケージは維持する。

## 決定

| 区分         | プラグイン                     | 用途                                                              |
| ------------ | ------------------------------ | ----------------------------------------------------------------- |
| **公式**     | `blink`, `idle`                | 瞬き（`eyeYaw`）、低 interest 時の視線 wander（`lookX`/`lookY`）  |
| **レガシー** | `gaze`, `attention`, `emotion` | カスタム preset / ランタイム `use()` 向け。公式 preset では非採用 |

### 代替手段（レガシー → 現行）

| やりたいこと         | 推奨                                                     |
| -------------------- | -------------------------------------------------------- |
| 常時視線ゆらぎ       | PFScript `wander()` または Scratch「ランダムに視線移動」 |
| 低 interest 時の視線 | `idle` プラグイン（公式）                                |
| 体・頭の傾き         | PFScript `bodyLean` / `headTilt` + `oscillator`          |
| 感情連動の口・眉     | Graph `mouthX` + PFScript、または `emotion`（レガシー）  |

### Overlap 検知

`@puppetflow/preset` の `detectPresetMotionOverlaps` は次を警告する:

- Graph / PFScript / Plugin の **ステージ間** 重複
- **複数 Plugin** が同一キーを出力（例: `gaze` + `idle` → `lookX`）
- **意図的レイヤー例外**: PFScript `eyeYaw` + `blink`（load 時は警告しない）

Studio は `collectPluginLayerGuidance` でレガシー利用と overlap を案内する。

## 将来（スコープ外）

- `idle` の視線を PFScript `wander()` へ完全移行するかは別 Epic
- `plugin-gaze` を Extension / stateful ノードへ統合

## 関連

- [plugins.md](../reference/plugins.md)
- [preset-canonical-model.md](preset-canonical-model.md)
- `packages/core/src/motion-state.ts` — `OFFICIAL_BEHAVIOR_PLUGIN_IDS`
