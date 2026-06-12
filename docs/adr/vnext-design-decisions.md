# ADR: PuppetFlow vNext 設計決定

**Status:** Accepted  
**Date:** 2026-06-11

## Context

[implementation-plan.md](../implementation-plan.md) の Open Questions について方針を確定する。

## Decisions

### D1 — 条件分岐（If / And / Or / Not）は Behavior のみ

- **Motion Graph には Logic ノードを実装しない**（I8 キャンセル）
- Graph は純粋な数値処理（Input / Math / Function / Output）に限定
- Scratch（Blockly）・JSON で記述した条件分岐はすべて `behavior` AST にコンパイル

### D2 — character 系（gaze / blink / idle / attention / emotion）は Behavior Pack に埋め込み

- 独立 Behavior Plugin としては **vNext で廃止**
- 各公式 Pack の `behavior` AST に待機・瞬き・視線・注目・感情ロジックを **固定定義として埋め込む**
- `plugin-gaze` 等のパッケージはランタイムから切り離し、参照実装として pack 作成時に移植

### D3 — Scratch UI は Blockly

- `blockly` パッケージを Studio Scratch モードに採用
- カスタムブロック定義 → Behavior AST コンパイラを `@puppetflow/behavior` 側に配置
- I4（ライブラリ選定スパイク）は不要。I17 で Blockly 統合を直接実装

### D4 — Preset version 1 は即時廃止

- ランタイムの `loadPreset` は **`version: 2` のみ**受け付ける
- 既存 `rules[]` 形式は **非対応**（未リリースのため移行スクリプトは提供しない）
- 組み込み preset は `@puppetflow/behavior-packs` の v2（6 種）に統一済み
- `USE_LEGACY_RULE_PLUGIN` 等のロールバックフラグは設けない

## Consequences

- Motion Graph の実装範囲が縮小し M2 が短縮可能
- Behavior Pack 作成工数は増える（gaze/blink 等の AST 化が必要）
- Blockly 導入により Studio のバンドルサイズ増加（code-split で緩和）
- 外部ユーザーが v1 preset を持つ場合は移行スクリプト実行が必須（README に明記）

## Related

- [追加仕様.md](../追加仕様.md)
- [implementation-plan.md](../implementation-plan.md)
