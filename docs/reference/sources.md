# State Sources

外部から State Store へ値を注入するソースのリファレンスです。

## 共通インターフェース

```ts
interface StateSource {
  readonly id: string;
  initialize(): Promise<void>;
  update(target: SourceUpdateTarget): Promise<void>;
  dispose(): Promise<void>;
}
```

`StateSource` は `initialize()`、`update(target)`、`dispose()` を持つ互換インターフェースです。
Polling 用の `pollIntervalMs`、`poll(signal)`、`apply(update, target)` をすべて実装し、
`pollIntervalMs` が有限かつ 0 以上であるソースは `PollingStateSource` として、ランタイムの
tick から I/O を分離できます。
Polling capability の判定と登録は Runtime の start 時に行われます。start 後に追加した Source は
次の start/restart まで、従来どおり await される `update(target)` 経路で処理されます。

### PollingStateSource のライフサイクル

Polling ソースの `poll()` はバックグラウンドで実行されます。ソースごとに同時に実行される
poll は常に 1 件だけで、完了した更新はキューを増やさず最新 1 件に置き換えられます。
ランタイムは各 tick の境界で、その最新更新を同期的に取り出して `apply()` します。その後に
モーション・パイプラインが実行されるため、I/O の待機は tick をブロックしません。

`stop()` は実行中の poll をキャンセルし、停止後に返ってきた遅延結果は適用しません。poll
または `apply()` のエラーはそのソースに分離され、他のソースとランタイムの tick は継続します。
Polling ソースと従来のソースの適用順序は、登録した attachment order のまま保持されます。
同じキーへの書き込みが競合する場合は、この順序が後勝ちの優先順位になります。

Polling の 3 メンバーが欠けている、または `pollIntervalMs` が有限でないか 0 未満の
ソースは、互換性のため従来どおり各 tick 内で `await source.update(target)` されます。
したがって、その `update()` の完了はその tick の後続処理を進める前に待機されます。

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

デフォルトのポーリング間隔は 1000 ms です。HTTP リクエストはバックグラウンドで実行され、
取得した最新の JSON が次の tick 境界で State に適用されます。

`state` / `channels` / `timeline` に加え、`motion` で MotionState パラメータを直接上書きできます（パイプライン出力の後、Adapter 送出前に適用）。

```json
{
  "state": { "interest": 0.8 },
  "motion": {
    "mouthX": 0.7,
    "lookX": 0.4,
    "lookY": 0.5,
    "custom": { "heartbeat": 0.6 }
  }
}
```

標準キーは `faceYaw`, `facePitch`, `bodyYaw`, `bodyRoll`, `eyeYaw`, `eyePitch`, `mouthX`, `mouthY`, `headTilt`, `bodyLean`, `lookX`, `lookY` です。値は 0.0〜1.0。詳細は [MotionState](./motion-state.md) を参照してください。

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

`payload` 内に `motion` を含めれば、モーションパラメータも直接指定できます。

```json
{
  "type": "event",
  "payload": {
    "motion": { "mouthX": 0.8, "lookX": 0.3 }
  }
}
```

```ts
runtime.attachSource(new WebSocketSource({ url: "ws://localhost:8080/state" }));
```

受信した有効な JSON オブジェクトは内部バッファに保持され、`poll()` が 16 ms 間隔で
バッファを drain します。バッファには最新の 1 件だけが残り、適用は tick 境界で行われます。

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

受信した有効な JSON オブジェクトは最新の 1 件として内部バッファに保持され、16 ms 間隔の
polling で drain されます。MQTT の受信処理やバッファ待機は tick をブロックせず、State への
適用は tick 境界で行われます。

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
