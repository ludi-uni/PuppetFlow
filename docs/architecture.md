# アーキテクチャ

モノレポ実装（2026-06 時点）の技術概要です。設計決定の履歴は [ADR](adr/) と [ロードマップ](roadmap.md) を参照してください。

## パイプライン全体

```text
                 +----------------+
                 |  State Sources |
                 +----------------+
                    ↑    ↑    ↑
              HTTP  WS  MQTT  Discord …

                        ↓

              +---------------------+
              | State / Channel /   |
              | Timeline Stores     |
              +---------------------+

                        ↓

              +---------------------+
              |  Behavior Plugins   |
              |  blink, idle, …     |
              +---------------------+

                        ↓

              +---------------------+
              |  Behavior Runtime   |
              |  PFScript / Scratch |
              |  If / ExprAssign    |
              +---------------------+

                        ↓

              +---------------------+
              | Motion Graph Runtime|
              | 数値 + stateful +   |
              | motionFunction      |
              +---------------------+

                        ↓

              +---------------------+
              |   Target Motion     |
              | 段階出力をマージ    |
              +---------------------+

                        ↓

              +---------------------+
              |  Motion Modifiers   |
              |  (smooth, noise, …) |
              +---------------------+

                        ↓

              +---------------------+
              |  Extension Layer    |
              |  Pack / Generator   |
              +---------------------+

                        ↓

              +---------------------+
              |  Rendered Motion    |
              +---------------------+

                        ↓

              +---------------------+
              |  Motion Mapper +    |
              |      Adapters       |
              +---------------------+

                        ↓

          VMC  Live2D  VRM  WebSocket  Logger
                        ↓
                   外部 Viewer
```

ランタイムは **60 Hz** で tick します。Studio の Pipeline タブで `blink` / `idle` / `behavior` / `graph` 各段階（マージ前）の出力を確認できます。

### マージ規則（要点）

| 段階 | 同一キー複数出力時 |
| ---- | ------------------ |
| Plugins + Behavior + Graph → Target | `addMotionState`（デルタ加算、0.5 中心キーは ±0.5 スケール） |
| Graph 内の複数 output | 平均 |
| Extension Layer | Pack 出力を平均マージ |
| Modifiers | 前フレームからの補間 |

Overlap（Graph と PFScript が同じキーを書く等）は `loadPreset()` と Studio で警告します。[ADR: Preset 正本](adr/preset-canonical-model.md)

## モノレポ構成

```text
puppetflow/
  packages/
    core/              # MotionState, StateStore, ChannelStore, PLUGIN_MOTION_OUTPUTS
    behavior/          # Behavior AST, executeBehavior, PFScript builtins catalog
    motion-graph/      # Graph 実行（Logic なし、stateful ノード対応）
    stateful-core/     # oscillator / wander / blink 等のフレーム跨ぎ関数
    pfscript-core/     # PFScript Lexer / Parser / Lowering
    runtime/           # PuppetFlowRuntime（tick オーケストレーション）
    preset/            # Preset v3 ローダー、overlap 検知、Mapper custom 列挙
    behavior-packs/    # 公式 .pfpreset（Standard + 6 種）
    extension-core/    # Motion Registry, Extension Layer
    extension-bundled/ # 公式 Motion Pack / heartbeat 等
    plugin-blink/      # まばたき（公式）
    plugin-idle/       # 低 interest 視線（公式）
    plugin-gaze/       # 視線（レガシー）
    plugin-attention/  # 注目姿勢（レガシー）
    plugin-emotion/    # 感情（レガシー）
    plugin-thinking/   # 考え込み Pack
    modifier-core/     # MotionModifier インターフェース
    modifier/          # smoothing, noise, breath
    motion-mapper/     # MotionState → OSC パラメータ（live2d / vmc プロファイル）
    adapter-core/      # Adapter インターフェース
    adapter-*/          # vmc, live2d, vrm, websocket, logger
    source-core/       # StateSource インターフェース
    source-*/          # http, websocket, mqtt, discord
  apps/
    studio/            # メイン制作・監視（かんたん / エキスパート）
    playground/        # 軽量デモ
    editor/            # スタンドアロン Graph Editor
    viewer/            # WebSocket モーション確認（任意）
  presets/             # 公式 preset ミラー（CI で同期）
  examples/pfscript/   # PFScript サンプル
```

## コア API

### MotionState

`@puppetflow/core` で 12 標準キー + `custom` を定義。詳細は [reference/motion-state.md](reference/motion-state.md)。

### State / Channel / Timeline

```ts
runtime.state.set("interest", 0.8);
runtime.channels.set("volume", 0.6);
runtime.timeline.push({ startMs: 0, endMs: 200, type: "phoneme", value: { phoneme: "A" } });
```

### Preset v3

```ts
import { loadPreset } from "@puppetflow/preset";
import { getPresetJson } from "@puppetflow/behavior-packs";

const loaded = loadPreset(getPresetJson("Standard"));
runtime.loadPreset(loaded); // behaviorPlugins + behaviorPfScript + graph + extensions
```

- `version: 3` のみ受け付け（v1 / v2 は **読み込みエラー**）
- `behaviorPfScript` があればコンパイルして `behavior` を生成（正本はソース側）
- `rules` / `modifiers` / behavior 内 `Builtin` は **非対応**

### Behavior / Graph / Extension

| 層 | API | 主なノード・文 |
| --- | --- | --- |
| Behavior | `executeBehaviorWithInvocations` | If, ExprAssign, MotionPack |
| Graph | `executeMotionGraph` | stateInput, multiply, output, oscillator, motionFunction |
| Extension | `executeExtensions` | motionPack, motionGenerator, ext:*, `extensions.packs` |

編集分担: [behavior-and-graph.md](reference/behavior-and-graph.md) / [pfscript.md](reference/pfscript.md) / [motion-extension.md](reference/motion-extension.md)

### Motion Modifier

```ts
interface MotionModifier {
  apply(current: MotionState, target: MotionState, deltaTime: number): MotionState;
}
```

### Adapter / Motion Mapper

`attachAdapter()` で OSC 送出。Studio の Motion Mapper は **Rendered Motion** を `live2d` / `vmc` プロファイルへ変換します。nijiexpose 向けは [ADR: Inochi2D](adr/motion-mapper-inochi2d.md) のとおり `live2d` ターゲットを使用します。

## Studio 構成（R2 以降）

```text
apps/studio/src/
  hooks/           usePresetState, useMotionPipeline, useStudioMode, …
  features/
    shared/        StudioChrome, StudioTabPanel, Pipeline/Plugins/Presets タブ
    simple/        動きのつなぎ（Mapping）
    expert/        Graph, PFScript, Sources
```

かんたん / エキスパートの切り替えは `constants/studio-mode.ts` でタブ集合を制御します。

## Runtime の使い方

```ts
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { loadPreset } from "@puppetflow/preset";
import { getPresetJson } from "@puppetflow/behavior-packs";
import { TauriVmcAdapter } from "@puppetflow/adapter-vmc";

const runtime = new PuppetFlowRuntime()
  .loadPreset(loadPreset(getPresetJson("Standard")))
  .attachAdapter(new TauriVmcAdapter());

await runtime.start();
```

## アプリケーションの役割

| App | 用途 |
| --- | --- |
| **Studio** | Pipeline / Scratch / PFScript / Graph / Plugins / Preset / Sources / Mapper |
| Playground | スライダー + VMC 送信の軽量デモ |
| Editor | Graph → Preset のスタンドアロン版 |
| Viewer | WebSocket 経由のモーション値確認 |

詳細は [Studio ガイド](guides/studio.md)。
