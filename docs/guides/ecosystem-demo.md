# Ecosystem デモ

複数のアダプタ（VMC + Live2D + VRM + WebSocket）を同時に動かすデモです。

## 起動手順

**ターミナル 1** — ランタイム + アダプタ:

```bash
pnpm example:ecosystem
```

**ターミナル 2**（任意）— WebSocket モーション確認:

```bash
pnpm dev:viewer
```

Viewer は `ws://127.0.0.1:3939` に接続し、モーション値を簡易表示します。キャラ描画の代わりではなく、デバッグ用途です。

## 出力先

| Adapter   | 出力                               | デフォルト            |
| --------- | ---------------------------------- | --------------------- |
| VMC       | OSC `/VMC/Ext/Blend/Val`           | `127.0.0.1:39539`     |
| Live2D    | OSC（Live2D パラメータ名）         | `127.0.0.1:39539`     |
| VRM       | OSC（VRM ブレンド名）              | `127.0.0.1:39539`     |
| WebSocket | JSON `{ type, motion, deltaTime }` | `ws://127.0.0.1:3939` |
| Logger    | コンソール                         | ローカル              |

パラメータ名は各アダプタの `mappings/default.json` で変更できます。Studio の Motion Mapper からも編集可能です。

## State の注入

Ecosystem デモは内部で State を生成します。外部から State を送る場合は Studio またはランタイム API で Source を接続してください。形式は [State Sources](../reference/sources.md) を参照。

## Discord（Node のみ）

```ts
import { DiscordSource } from "@puppetflow/source-discord";

runtime.attachSource(
  new DiscordSource({
    token: process.env.DISCORD_BOT_TOKEN!,
    channelId: "1234567890",
  }),
);
```

設定チャンネルに `{ "interest": 0.9, "joy": 0.7 }` 形式の JSON を投稿すると State に反映されます。
