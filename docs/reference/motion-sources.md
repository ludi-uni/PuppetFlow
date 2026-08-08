# MotionSource

Canonical frame を生成する入力元は `@puppetflow/source-core` の `MotionSource` を実装します。

```ts
interface MotionSource {
  readonly id: string;
  start(emit: (frame: MotionFrame) => void): Promise<void>;
  stop(): Promise<void>;
}
```

```ts
runtime.attachMotionSource(source);
runtime.attachMotionAdapter(frameAdapter);
await runtime.start();
```

`start()` は source の lifecycle を開始し、受け取った frame は Runtime が検証して source ID ごとの latest frame として保持します。frame-capable adapter への配信は source の登録順です。source や adapter の 1 件の失敗は他の経路を停止させません。

既存の `StateSource` は変更されません。`MotionStateFrameSource` を使うと、既存の `() => MotionState` を 60 Hz の source-relative `MotionFrame.parameters` に変換できます。
