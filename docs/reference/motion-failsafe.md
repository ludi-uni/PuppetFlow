# Motion fail-safe

Runtime に接続した `MotionSource` は、最後に受信した frame の receipt age を使って fail-safe を適用できます。設定は Runtime ごとに行い、source や adapter の実装を変更しません。

```ts
runtime.configureMotionFailSafe({
  timeoutMs: 250,
  action: "blend-to-neutral",
  transitionMs: 500,
});
```

`timeoutMs` 未満の frame はそのまま配送されます。timeout に達した後の action は次の 3 種類です。

- `hold-last-frame`: 最後の frame を保持します。
- `blend-to-neutral`: position と数値 channel を 0、rotation を identity、scale を 1 へ遷移させます。
- `disable-source`: その source の frame を pipeline へ渡しません。

fail-safe は受信時刻で判定します。frame 内の timestamp は遅延判定には使いませんが、Inspector の診断情報として保持されます。設定値は `getMotionFailSafe()` で読み戻せます。

```ts
const options = runtime.getMotionFailSafe();
```

未設定の場合は従来どおり latest frame を clone して配送し、fail-safe による破棄や中立化は行いません。
