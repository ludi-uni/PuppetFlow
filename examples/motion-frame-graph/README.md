# MotionFrameGraph example

この例は実機、VMC、ソケットを使わず固定入力だけで `MotionFrameGraph` と
`MotionFramePipeline` の canonical flow を検証するデモです。

```ts
const graph = createMotionFrameGraphController(document, { now: () => clock });
const pipeline = createMotionFramePipeline({ layers: [...] });

const idle = graph.evaluate({ sources: {} });
console.log("idle", pipeline.process(idleInputs, 1 / 60, idle.policy));

graph.setSignal("tracking", true);
const tracking = graph.evaluate({ sources: { tracker: { connected: true, stale: false } } });
console.log("tracking", pipeline.process(trackingInputs, 1 / 60, tracking.policy));
```

実行:

```bash
pnpm --filter @puppetflow/example-motion-frame-graph start
```

期待される確認ポイント:

- 出力が `idle` と `tracking` で異なること
- `tracking` が `sourceId: tracker` の priority により優先されること
- タイムアウトやソケットを使わないため、単体再現性があること
