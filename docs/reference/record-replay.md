# Record / Replay

Node の `@puppetflow/motion-recording` は `.pfmotion` JSONL を streaming で扱います。先頭行は必須 header です。

```json
{"type":"header","format":"puppetflow-motion","version":1,"timeUnit":"ms","metadata":{}}
{"type":"frame","frame":{"timestamp":0,"blendShapes":{"Smile":0.5}}}
```

`MotionFrameRecorder` は 1 行ずつ書き込み、`readMotionRecording()` は配列へ全件ロードせず 1 frame ずつ返します。Replay は `speed`、`loop`、`startOffsetMs` と `stop()` による timer/read cancellation をサポートします。

```powershell
pnpm pf record examples/motion-replay/session.pfmotion --preset Idle --duration 10000
pnpm pf replay examples/motion-replay/session.pfmotion --speed 1.5 --vmc-host 127.0.0.1 --vmc-port 39539
```

`pf run` と既存 YAML 設定は従来どおりです。record はデフォルトで外部 adapter を無効化し、replay は canonical frame と VMC frame output のみを使います。
