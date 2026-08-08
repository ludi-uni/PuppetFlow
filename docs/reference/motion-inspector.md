# Motion Inspector

Runtime は現在の source、mixer、output adapter の状態を同期 snapshot として取得できます。

```ts
const snapshot = runtime.getMotionInspectorSnapshot();
```

Snapshot には次の情報が含まれます。

- `sources`: 接続状態、stale 状態、直近の frame receipt 時刻、frame timestamp、直近 1 秒の `inputRateHz`
- `mixer`: 現在の入力に対して各 bone・BlendShape・parameter を担当する最高 priority layer の source 一覧
- `outputs`: adapter の接続状態、直近の output 時刻、直近 1 秒の `outputRateHz`、最後のエラーメッセージ

```ts
const source = snapshot.sources.find(({ id }) => id === "tracking");
if (source?.stale) {
  console.warn("tracking source is stale", source.ageMs);
}

for (const output of snapshot.outputs) {
  if (!output.connected) {
    console.warn(output.id, output.error);
  }
}
```

`mixer` の inspection は、attach した Pipeline が inspection を公開している場合だけ提供されます。Snapshot は内部 state の参照を返さないため、表示用に保持しても Runtime の frame を変更しません。`stop()` 後は `running` が false になり、source/output の rate と mixer inspection はリセットされます。
