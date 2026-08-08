# Motion Mixer example

この例は、実機・UDP・VMC サーバーなしで複数の合成入力を確認します。

```text
synthetic body source       ─┐
synthetic head source        ├─ MotionFrame Pipeline ── JSON output
synthetic expression source ─┘
```

`body` は胴体と腕、`head` は首と頭、`expression` は BlendShape を提供します。
Pipeline は source filter、priority/mask 付き Mixer、bone mapping と position scale を
持つ Retarget、Head の low-pass output filter を順番に適用します。

実行方法:

```bash
pnpm --filter @puppetflow/example-motion-mixer start
```

この例の入力は固定された合成データです。実際の VMC 相互運用や異常パケット検証は
この repository の責務ではなく、VMC Lab で行います。
