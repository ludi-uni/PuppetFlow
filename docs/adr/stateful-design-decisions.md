# ADR — Stateful vs Modifier vs Behavior Plugin

**ステータス:** 採用（2026-06）  
**関連:** [stateful.md](../reference/stateful.md) / [implementation-plan-stateful.md](../implementation-plan-stateful.md)

## 文脈

PuppetFlow には時間依存の動きを実現する仕組みが複数ある。

| 仕組み              | 例                                               |
| ------------------- | ------------------------------------------------ |
| **Motion Modifier** | `SmoothingModifier` — Rendered 全体を低域通過    |
| **Behavior Plugin** | `gaze` / `blink` — 個別に phase / タイマーを保持 |
| **Extension Pack**  | `lookAround` — `ctx.time` + `Math.sin`           |
| **Stateful 関数**   | `oscillator` / `spring` / `wander` 等            |

仕様（[追加仕様.md](../追加仕様.md)）では Stateful を第一級とし、既存手段との境界を明確にする必要がある。

## 決定

### 1. Stateful は「信号単位・id 付き」の共通ランタイム

- `StatefulStore` は **Runtime 1 インスタンスにつき 1 つ**。Behavior / Graph / Extension が共有する。
- 状態は **Preset に永続化しない**。`loadPreset()` でリセット。
- PFScript / Graph / Pack は **同じ関数名・同じ id** であれば同一状態を参照する。

### 2. Motion Modifier は「最終出力全体」の後処理として維持

- `SmoothingModifier` は target → rendered の **グローバル平滑**。
- `smooth(id, value, speed)` は **個別信号**の指数平滑。用途が異なるため **共存**（置換しない）。

### 3. Behavior Plugin（gaze / blink）は stateful 委譲（2026-06 完了）

- Runtime が `runStatefulNumber` を `BehaviorPluginContext` 経由で注入。
- `gaze` → `oscillator`、`blink` → `blink`。ストア未注入時は従来ロジックへフォールバック。
- Scratch **Natural Motion** ブロックで PFScript 相当の stateful 動きを behavior へ追加可能。

### 4. Extension Pack の実装方針

- Runtime 経由で `statefulStore` が注入される環境では **Stateful を優先**。
- 単体テストやストア未注入時は **従来の数式へフォールバック**（後方互換）。

## 理由

- **一貫性:** 位相・慣性・乱数の再現性を id 単位で保証できる。
- **可観測性:** Studio Pipeline の Stateful 一覧でデバッグ可能。
- **漸進移行:** 既存 Preset / Plugin を壊さずに導入できる。

## 影響

- 新規ドキュメント: [stateful.md](../reference/stateful.md)
- Studio Expert: Pipeline タブに Stateful 状態テーブル
- 開発者は Pack 実装で `runStatefulNumber` を使うことを推奨

## 却下した案

| 案                                  | 却下理由                                      |
| ----------------------------------- | --------------------------------------------- |
| Stateful を独立パイプライン段にする | Behavior → Stateful → Graph の二重評価が複雑  |
| Modifier を stateful に統合         | Rendered 全体平滑と信号単位平滑の要件が異なる |
| gaze / blink を M4 で即時削除       | 既存 Preset との互換性を損なう                |
