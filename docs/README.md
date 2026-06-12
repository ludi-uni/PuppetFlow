# PuppetFlow ドキュメント

イベント駆動型キャラクターランタイム **PuppetFlow** のドキュメント索引です。

## 現行システム

```text
StateStore
 ↓
Behavior Plugins        ← rules / behaviorPlugins（gaze, blink, rule 等）
 ↓
Behavior Script Engine  ← If / Builtin / Assign（Blockly または JSON）
 ↓
Motion Graph Runtime    ← 数値ノード（Multiply / Clamp / Output 等）
 ↓
Target MotionState
 ↓
Motion Modifiers        ← breath / noise / smoothing
 ↓
Rendered MotionState
 ↓
Adapters → 外部 Viewer
```

| ドキュメント                      | 内容                              |
| --------------------------------- | --------------------------------- |
| [概要](overview.md)               | PuppetFlow とは何か、設計思想     |
| [アーキテクチャ](architecture.md) | パイプライン、パッケージ構成、API |
| [ロードマップ](roadmap.md)        | Phase 計画と実装状況              |

## ガイド

| ドキュメント                                  | 内容                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| [はじめての使い方](guides/getting-started.md) | インストール、Playground / Studio の起動               |
| [Studio ガイド](guides/studio.md)             | Pipeline / Scratch / Graph / Plugins / Preset / Mapper |
| [Ecosystem デモ](guides/ecosystem-demo.md)    | 複数アダプタ同時出力                                   |

## リファレンス

| ドキュメント                                                | 内容                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| [MotionState](reference/motion-state.md)                    | 正規化モーションパラメータ（16 キー）    |
| [Behavior Plugins](reference/plugins.md)                    | rule / gaze / blink 等のプラグイン層     |
| [Behavior と Motion Graph](reference/behavior-and-graph.md) | AST、Graph ノード、編集の分担            |
| [プリセット](reference/presets.md)                          | Preset v2（`.pfpreset`）と公式 Pack 6 種 |
| [アダプタ](reference/adapters.md)                           | VMC / Live2D / VRM / WebSocket / Logger  |
| [State Sources](reference/sources.md)                       | HTTP / WebSocket / MQTT / Discord        |

## 設計・拡張仕様

| ドキュメント                                                           | 内容                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| [追加仕様（Input & Timeline）](追加仕様.md)                            | Channel / Timeline 入力層の拡張仕様                |
| [実装計画（Input & Timeline）](implementation-plan-input-timeline.md)  | Phase 11 Issue 分解（未着手）                      |
| [設計決定（Input & Timeline）](adr/input-timeline-design-decisions.md) | sticky Channel / global clock / phoneme テーブル等 |

### vNext 移行（履歴・MVP 完了）

| ドキュメント                                           | 内容                                           |
| ------------------------------------------------------ | ---------------------------------------------- |
| [実装計画（vNext）](implementation-plan.md)            | Issue 分解・スプリント計画（完了）             |
| [設計決定（vNext ADR）](adr/vnext-design-decisions.md) | If=Behavior のみ / Blockly / Preset v1 廃止 等 |

## アーカイブ

Phase 1 以前の設計メモは [archive/](archive/) に保管しています。現行仕様と矛盾する場合は **architecture / reference を正** とします。
