# Example: motion runtime plugin API

この例は外部機器・ソケットを使わず、MotionRuntime プラグインの
`MotionSource / MotionFrameFilter / MotionFrameAdapter` を実体化して
`PuppetFlowRuntime` に接続し、最終フレームを JSON で確認するデモです。

## 実行

```bash
pnpm --filter @puppetflow/example-motion-runtime-plugin start
```

`source` が `parameters.value = 2` を生成し、`double` フィルタで 2 倍されるため、
`capture` で `parameters.value = 4` のフレームが出力され、Runtime はクリーンに停止します。

## 期待例

```text
{
  "timestamp": 1000,
  "parameters": {
    "value": 4
  }
}
```

## 実装ポイント

- `registerMotionRuntimePlugins()` で registry を作成
- `registry.createSource("synthetic", ...)` → `runtime.attachMotionSource(...)`
- `registry.createFilter("double", ...)` → `createMotionFramePipeline(...)`
- `registry.createFrameAdapter("capture", ...)` → `runtime.attachMotionAdapter(...)`
- YAML/CLI 経由のプラグイン自動起動は行わず、`registerMotionRuntimePlugins()` 経由のみを使用
