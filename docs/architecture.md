# アーキテクチャ

vNext 実装（モノレポ）に基づく技術概要です。

## パイプライン全体

```text
                 +----------------+
                 |  State Sources |
                 +----------------+
                    ↑    ↑    ↑
              HTTP  WS  MQTT  Discord …

                        ↓

              +---------------------+
              |     State Store     |
              +---------------------+

                        ↓

              +---------------------+
              |  Behavior Plugins   |
              |  rule, gaze, blink… |
              +---------------------+

                        ↓

              +---------------------+
              |  Behavior Runtime   |
              |  (If / Assign / …)  |
              +---------------------+

                        ↓

              +---------------------+
              | Motion Graph Runtime|
              |  (数値 + motionPack) |
              +---------------------+

                        ↓

              +---------------------+
              |   Target Motion     |
              |   (段階出力を平均)   |
              +---------------------+

                        ↓

              +---------------------+
              |  Motion Modifiers   |
              |  (smooth, noise, …) |
              +---------------------+

                        ↓

              +---------------------+
              |  Extension Layer    |
              |  (Motion Pack 等)   |
              +---------------------+

                        ↓

              +---------------------+
              |  Rendered Motion    |
              +---------------------+

                        ↓

              +---------------------+
              |      Adapters       |
              +---------------------+

                        ↓

          VMC  Live2D  VRM  WebSocket  Logger
                        ↓
                   外部 Viewer
```

ランタイムは **60 Hz** で tick します。Studio の Pipeline タブで各段階（`rule` / `gaze` / `behavior` / `graph` 等）の出力を確認できます。

## モノレポ構成

```text
puppetflow/
  packages/
    core/              # MotionState, StateStore, BehaviorPlugin
    behavior/          # Behavior AST, executeBehavior, Builtins
    motion-graph/      # Graph 実行（Logic ノードなし）
    runtime/           # PuppetFlowRuntime
    preset/            # Preset v3 ローダー
    behavior-packs/    # 公式 .pfpreset 6 種
    extension-core/    # Motion Registry, Extension Layer
    extension-bundled/ # 公式 Motion Pack 一括登録
    pfscript-core/     # PFScript 式評価
    plugin-thinking/   # 考え込み Pack
    plugin-lookaround/ # 視線探索
    plugin-tail/       # 尻尾
    plugin-animal-ears/# 耳ぴく
    plugin-gaze/       # 視線ゆらぎ
    plugin-blink/      # 瞬き
    plugin-idle/       # 待機視線
    plugin-attention/  # 注目姿勢
    plugin-emotion/    # 感情表情
    modifier-core/     # MotionModifier インターフェース
    modifier/          # smoothing, noise, breath
    motion-mapper/     # MotionState → モデルパラメータ変換
    adapter-core/      # Adapter インターフェース
    adapter-*/         # vmc, live2d, vrm, websocket, logger
    source-core/       # StateSource インターフェース
    source-*/          # http, websocket, mqtt, discord
  apps/
    studio/            # メイン制作・監視ツール
    playground/        # 軽量デモ
    editor/            # スタンドアロン Graph Editor
    viewer/            # WebSocket モーション確認（任意）
  examples/ecosystem/  # 複数アダプタ同時デモ
```

## コア API

### MotionState

`@puppetflow/core` で 16 キーを定義。詳細は [reference/motion-state.md](reference/motion-state.md)。

### State Store

```ts
runtime.state.set("interest", 0.8);
runtime.state.get("interest");
```

キーはスキーマ固定ではありません。

### Preset v3

```ts
import { loadPreset } from "@puppetflow/preset";
import { getPresetJson } from "@puppetflow/behavior-packs";

const loaded = loadPreset(getPresetJson("Curious"));
runtime.loadPreset(loaded); // behaviorPlugins + behavior + graph + extensions
```

- `version: 3` のみ受け付け（v1 / v2 は **読み込みエラー**）
- `rules` / `modifiers` / behavior 内 `Builtin` は **非対応**
- 任意の `behaviorPlugins` と `extensions` を併記可能（[plugins.md](reference/plugins.md) / [motion-extension.md](reference/motion-extension.md)）

### BehaviorPlugin

```ts
interface BehaviorPlugin {
  id: string;
  process(state: StateStore, motion: MotionState): Partial<MotionState>;
}
```

`runtime.use(plugin)` で追加。Preset の `behaviorPlugins` は `loadPreset()` 時に自動登録されます。

### Behavior / Graph / Extension

- **Behavior:** `executeBehavior(behaviorRoot, ctx)` — If, Assign, MotionPack
- **Graph:** `executeMotionGraph(graph, ctx)` — stateInput, multiply, output, motionPack 等
- **Extension:** `executeExtensions(registry, ctx, sources)` — Motion Pack, custom パラメータ

編集の分担は [reference/behavior-and-graph.md](reference/behavior-and-graph.md) と [reference/motion-extension.md](reference/motion-extension.md) を参照。

### Motion Modifier

```ts
interface MotionModifier {
  apply(current: MotionState, target: MotionState, deltaTime: number): MotionState;
}
```

低周波ノイズ・フレームレート非依存スムージングにより自然な待機動作を実現します。

### Adapter / State Source

`attachAdapter()` / `attachSource()` で拡張。Motion Mapper は **Rendered Motion** を各モデル形式へ変換して OSC 送出します。

## Runtime の使い方

```ts
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { loadPreset } from "@puppetflow/preset";
import { getPresetJson } from "@puppetflow/behavior-packs";
import { TauriVmcAdapter } from "@puppetflow/adapter-vmc";

const runtime = new PuppetFlowRuntime()
  .loadPreset(loadPreset(getPresetJson("Idle")))
  .attachAdapter(new TauriVmcAdapter());

await runtime.start();
```

## アプリケーションの役割

| App        | 用途                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| **Studio** | Pipeline / Scratch / Graph / Plugins / Preset / Sources / Mapper（推奨） |
| Playground | スライダー + VMC 送信の軽量デモ                                          |
| Editor     | Graph → Preset のスタンドアロン版                                        |
| Viewer     | WebSocket 経由のモーション値確認                                         |

詳細は [Studio ガイド](guides/studio.md) を参照してください。
