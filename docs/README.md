# PuppetFlow ドキュメント

イベント駆動型キャラクターランタイム **PuppetFlow** のドキュメント索引です。

> **Language:** このドキュメントは主に **日本語** です。リポジトリ概要とコントリビューション手順は英語の [README.md](../README.md) / [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。

## 現行システム

```text
StateStore
 ↓
Behavior Plugins        ← blink / idle（公式）
 ↓
Behavior Script Engine  ← PFScript / Scratch / If / ExprAssign / MotionPack
 ↓
Motion Graph Runtime    ← 数値 + stateful + motionFunction / motionPack / ext:*
 ↓
Target MotionState
 ↓
Motion Modifiers
 ↓
Extension Layer         ← extensions.packs / graph motionPack
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

| ドキュメント                                  | 内容                                                    |
| --------------------------------------------- | ------------------------------------------------------- |
| [はじめての使い方](guides/getting-started.md) | インストール、Playground / Studio の起動                |
| [Studio ガイド](guides/studio.md)             | Pipeline / Scratch / PFScript / Graph / Preset / Mapper |
| [CLI ガイド](guides/cli.md)                   | ヘッドレス常時稼働（`pf run`）                          |
| [Ecosystem デモ](guides/ecosystem-demo.md)    | 複数アダプタ同時出力                                    |

## リファレンス

| ドキュメント                                                | 内容                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| [MotionState](reference/motion-state.md)                    | 正規化モーションパラメータ（16 キー）    |
| [Behavior Plugins](reference/plugins.md)                    | blink / idle（公式）、レガシー gaze 等   |
| [Behavior と Motion Graph](reference/behavior-and-graph.md) | AST、Graph ノード、編集の分担            |
| [Motion Extension](reference/motion-extension.md)           | Extension Layer、Pack、custom パラメータ |
| [PFScript](reference/pfscript.md)                           | 上級者向け Behavior DSL（.pfscript）     |
| [Stateful 関数](reference/stateful.md)                      | フレーム跨ぎ状態・Physics Pack 連携      |
| [プリセット](reference/presets.md)                          | Preset v3、Standard モデル、公式 7 種    |
| [アダプタ](reference/adapters.md)                           | VMC / Live2D / VRM / WebSocket / Logger  |
| [State Sources](reference/sources.md)                       | HTTP / WebSocket / MQTT / Discord        |

## 設計・拡張仕様

| ドキュメント                                                           | 内容                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| [追加仕様（Motion Extension / PFScript 設計メモ）](追加仕様.md)        | PFScript DSL / Extension Layer の設計草案          |
| [実装計画（PFScript）](implementation-plan-pfscript.md)                | PFScript Issue 分解・**M1–M6 完了**                |
| [Stateful 関数](reference/stateful.md)                                 | フレーム跨ぎ状態・Physics Pack 連携                |
| [実装計画（Stateful Node）](implementation-plan-stateful.md)           | Stateful 関数・ノード Issue 分解（**完了**）       |
| [リファクタリング計画（進捗）](refactoring-plan.md)                    | R0–R5 フェーズの完了状況と残タスク                 |
| [設計決定（Plugin 層）](adr/plugin-layer.md)                           | 公式 blink+idle / レガシー gaze 等 / overlap       |
| [設計決定（Mapper / Inochi2D）](adr/motion-mapper-inochi2d.md)         | nijiexpose は live2d ターゲットを使用              |
| [設計決定（Preset 正本）](adr/preset-canonical-model.md)               | behaviorPfScript 正本 / overlap / custom 値域      |
| [設計決定（Stateful）](adr/stateful-design-decisions.md)               | Stateful / Modifier / Plugin の境界                |
| [実装計画（Input & Timeline）](implementation-plan-input-timeline.md)  | Phase 11 Issue 分解（未着手）                      |
| [設計決定（Input & Timeline）](adr/input-timeline-design-decisions.md) | sticky Channel / global clock / phoneme テーブル等 |

### vNext 移行（履歴・MVP 完了）

| ドキュメント                                           | 内容                                           |
| ------------------------------------------------------ | ---------------------------------------------- |
| [実装計画（vNext）](implementation-plan.md)            | Issue 分解・スプリント計画（完了）             |
| [設計決定（vNext ADR）](adr/vnext-design-decisions.md) | If=Behavior のみ / Blockly / Preset v1 廃止 等 |

## アーカイブ

Phase 1 以前の設計メモは [archive/](archive/) に保管しています。現行仕様と矛盾する場合は **architecture / reference を正** とします。
