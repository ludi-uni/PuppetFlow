# アダプタ

Rendered Motion を外部システムへ送出するアダプタのリファレンスです。

## 共通インターフェース

```ts
interface Adapter {
  id: string;
  initialize(): Promise<void>;
  update(motion: MotionState, deltaTime: number): Promise<void>;
  dispose(): Promise<void>;
}
```

ランタイムは tick ごとに全アダプタの `update()` を呼び出します。複数アダプタの同時利用が可能です。

```ts
runtime.attachAdapter(new TauriVmcAdapter());
runtime.attachAdapter(new LoggerAdapter({ label: "debug" }));
```

## パッケージ一覧

| パッケージ                      | 出力                     | デフォルト送信先      |
| ------------------------------- | ------------------------ | --------------------- |
| `@puppetflow/adapter-vmc`       | VMC OSC                  | `127.0.0.1:39539`     |
| `@puppetflow/adapter-live2d`    | Live2D パラメータ OSC    | `127.0.0.1:39539`     |
| `@puppetflow/adapter-vrm`       | VRM ブレンドシェイプ OSC | `127.0.0.1:39539`     |
| `@puppetflow/adapter-websocket` | WebSocket JSON           | `ws://127.0.0.1:3939` |
| `@puppetflow/adapter-logger`    | コンソールログ           | ローカル              |

## VMC OSC

### アドレス

```text
/VMC/Ext/Blend/Val
```

### 引数

1. ブレンドシェイプ名（string）
2. 値（float, 0.0〜1.0）

### デフォルトマッピング

`packages/adapter-vmc/mappings/default.json` を参照。Viewer やモデルに合わせてパラメータ名を編集してください。

### 手動テスト

1. nijiexpose 等の VMC 受信アプリをポート `39539` で起動
2. Playground または Studio を起動
3. **Interest** スライダーを動かし、マッピングされたブレンドシェイプの変化を確認

## Motion Mapper（Studio）

Studio の **Motion Mapper** タブでは、MotionState キーごとに次を設定できます。

- 送信先パラメータ名
- 値変換（`identity` / `centered` / `invert`）
- Host / Port
- 送信の有効/無効

VMC / Live2D / VRM をモデルごとに独立して設定できます。`@puppetflow/motion-mapper` が変換層を担います。

## WebSocket

`@puppetflow/adapter-websocket` は次の形式でブロードキャストします。

```json
{
  "type": "motion",
  "motion": { "mouthX": 0.4, "facePitch": 0.5, "lookX": 0.52, ... },
  "deltaTime": 0.016
}
```

`apps/viewer` がこのストリームを受信してモーション値を表示します（キャラ描画は行いません）。

## Logger

デバッグ用。`throttleMs` でログ間隔を制御できます。Studio の Motion Mapper から有効化できます。
