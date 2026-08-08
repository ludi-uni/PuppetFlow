# VMC Bone Output

`@puppetflow/adapter-vmc` は canonical frame の完全な骨姿勢を `/VMC/Ext/Bone/Pos` として OSC Bundle に含めます。引数は VMC Protocol の順序どおりです。

```text
address: /VMC/Ext/Bone/Pos
types:   ,sfffffff
args:    boneName, position.x, position.y, position.z,
         rotation.x, rotation.y, rotation.z, rotation.w
```

position または quaternion が欠ける骨は送信しません。原点・identity quaternion を補完しないため、partial tracking の入力でも誤った姿勢を生成しません。blendShapes は直接送信し、`parameters` は既存 Motion Mapper profile を通して Blend/Val に変換します。

Bundle timetag は `immediate`、`send-time`、`frame-unix` を選べます。source-relative / monotonic timestamp は Unix 時刻として扱いません。`frame-unix` は `metadata.clock: "unix"` が明示された frame のみ利用します。

Node は `OscTransport` を差し替えて UDP なしでテストできます。Tauri は既存 `osc_send_blend_params` を変更せず、`osc_send_motion_frame` Rust command で同じ Bundle を作成します。
