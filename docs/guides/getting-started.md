# はじめての使い方

## 前提

- Node.js + pnpm
- キャラ描画用の **外部 Viewer**（nijiexpose、VSeeFace、Live2D 等）を別途用意

PuppetFlow はモーションを OSC 等で送出します。キャラの表示は Viewer 側で行います。

## インストール

```bash
pnpm install
pnpm build
pnpm test
```

## 最短デモ（Playground）

```bash
pnpm dev
```

1. 外部 Viewer を `127.0.0.1:39539` で起動（VMC 受信）
2. Playground で **Interest** スライダーを動かす
3. Viewer 側でパラメータが変化することを確認

VMC マッピングの詳細は [アダプタ](../reference/adapters.md) を参照。

## 推奨ワークフロー（Studio）

制作・設定の中心は **PuppetFlow Studio** です。

```bash
pnpm dev:studio
```

| タブ              | 用途                                       |
| ----------------- | ------------------------------------------ |
| Pipeline          | State 入力と各段階の Motion 監視（表形式） |
| Scratch (Blockly) | If / Builtin による `behavior` 編集        |
| Graph Editor      | 数値グラフ（Multiply → mouthX 等）         |
| Preset Manager    | `.pfpreset` v2 の編集・適用                |
| Plugins           | gaze / blink 等の追加プラグイン            |
| State Sources     | HTTP / WebSocket / MQTT                    |
| Motion Mapper     | Rendered Motion の VMC / Live2D / VRM 送出 |

詳細は [Studio ガイド](studio.md) を参照。

## アプリの選び方

| 目的                       | コマンド                    |
| -------------------------- | --------------------------- |
| 軽く動作確認               | `pnpm dev`（Playground）    |
| 本格的な編集・監視         | `pnpm dev:studio`（Studio） |
| グラフのみ                 | `pnpm dev:editor`（Editor） |
| モーション値の確認（任意） | `pnpm dev:viewer`（Viewer） |

## 次のステップ

- [Behavior Plugins](../reference/plugins.md) — rule / gaze / blink 等
- [MotionState](../reference/motion-state.md) — 出力パラメータ一覧
- [プリセット](../reference/presets.md) — 公式 Pack 6 種と v2 形式
- [Behavior と Graph](../reference/behavior-and-graph.md) — 編集の分担
- [Ecosystem デモ](ecosystem-demo.md) — 複数アダプタ同時出力
- [State Sources](../reference/sources.md) — 外部アプリからの State 注入
