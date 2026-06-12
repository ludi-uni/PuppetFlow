# State Sources

外部から State Store へ値を注入するソースのリファレンスです。

## 共通インターフェース

```ts
interface StateSource {
  id: string;
  initialize(): Promise<void>;
  update(state: StateStore): Promise<void>;
  dispose(): Promise<void>;
}
```

ランタイムの tick 内で `update()` が呼ばれ、返却されたペイロードが State Store にマージされます。

## パッケージ一覧

| パッケージ                     | 用途                    | 実行環境       |
| ------------------------------ | ----------------------- | -------------- |
| `@puppetflow/source-http`      | HTTP ポーリング         | Browser / Node |
| `@puppetflow/source-websocket` | WebSocket 受信          | Browser / Node |
| `@puppetflow/source-mqtt`      | MQTT 購読               | Node           |
| `@puppetflow/source-discord`   | Discord チャンネル JSON | Node           |

Studio の **State Sources** タブから HTTP / WebSocket / MQTT を設定できます。

## HTTP

`GET` で JSON オブジェクトを取得し、State に適用します。

```json
{ "interest": 0.8, "energy": 0.6 }
```

デフォルトのポーリング間隔は 1000 ms です。

```ts
runtime.attachSource(
  new HttpSource({ url: "http://localhost:3000/state", intervalMs: 1000 }),
);
```

## WebSocket

接続後、受信した JSON を State に適用します。

**フラット形式:**

```json
{ "interest": 0.8 }
```

**エンベロープ形式:**

```json
{ "type": "state", "state": { "interest": 0.8 } }
```

```json
{ "type": "event", "payload": { "interest": 0.8 } }
```

```ts
runtime.attachSource(new WebSocketSource({ url: "ws://localhost:8080/state" }));
```

## MQTT

Broker の Topic から JSON ペイロードを購読します。

```ts
runtime.attachSource(
  new MqttSource({
    brokerUrl: "mqtt://localhost:1883",
    topic: "puppetflow/state",
  }),
);
```

## Discord

設定チャンネルに投稿された JSON メッセージを State に反映します。Bot トークンが必要です。Node 環境でのみ利用可能です。

```ts
import { DiscordSource } from "@puppetflow/source-discord";

runtime.attachSource(
  new DiscordSource({
    token: process.env.DISCORD_BOT_TOKEN!,
    channelId: "1234567890",
  }),
);
```

投稿例:

```json
{ "interest": 0.9, "joy": 0.7 }
```

## フィールドマッピング

各 Source は `fieldMapping` オプションで、受信キーを State キーにリネームできます。

```ts
new HttpSource({
  url: "http://api.example.com/mood",
  fieldMapping: { engagement: "interest" },
});
```

## Source と手動入力の関係

Studio の Pipeline スライダーは手動入力用です。Source が有効な場合、Source からの更新が State を上書きします。デバッグ時は Source を無効にするか、スライダーと Source のどちらが優先されるかを意識してください。
