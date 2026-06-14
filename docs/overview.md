# 概要

## PuppetFlow とは

PuppetFlow は次の **いずれでもない** ランタイムです。

- 感情エンジンではない
- AI エンジンではない
- VMC ライブラリでもない

役割は、次のパイプラインを **実行する** ことです。

```text
State / Channel / Timeline
 ↓
Behavior Plugins（blink / idle 等）
 ↓
Behavior（PFScript / Scratch / JSON）
 ↓
Motion Graph（数値 + stateful + motionFunction）
 ↓
Target MotionState（段階出力をマージ）
 ↓
Motion Modifiers
 ↓
Extension Layer（Motion Pack / Generator / ext:*）
 ↓
Rendered MotionState
 ↓
Adapters → Viewer（外部）
```

キャラクターの **描画** は外部 Viewer（nijiexpose、Live2D、VRM アプリ等）が担います。PuppetFlow は状態からモーションまでを制御します。

## 設計思想

PuppetFlow は **状態・振る舞い・表現** を分離します。

| 層 | 例 |
| --- | --- |
| State / Channel / Timeline | `interest`, `volume`, phoneme イベント |
| Behavior Plugins（公式） | `blink`（まばたき）、`idle`（低 interest 時の視線） |
| PFScript / Behavior | `bodyLean = oscillator(...)`, `mouthY = volume` |
| Graph（数値マッピング） | `interest × gain → mouthX` |
| Extension | `thinking` Pack、`heartbeat` 関数、`tailWag` custom |
| MotionState | `{ mouthX, bodyLean, lookX, custom: { MouthA } }` |
| Adapter | `ParamMouthForm`, `ParamAngleY` 等へ OSC 送出 |
| Viewer | 外部アプリで描画 |

State のキーは固定しません。ゲーム・AI・IoT など用途ごとに異なる状態をそのまま受け入れます。

標準 Motion キーは [MotionState リファレンス](reference/motion-state.md) の **12 種**（+ `custom`）に正規化されます。

## Standard モデル（公式プリセット）

公式プリセットは **PFScript + Graph + blink/idle** の役割分担を正とします。

| 担当 | 層 | 例 |
| ---- | --- | --- |
| 笑顔・数値マッピング | Graph | `interest → mouthX` |
| 体・口・呼吸・custom | PFScript | `bodyLean`, `mouthY`, `custom:breath` |
| 瞬き・待機視線 | Plugins | `blink`, `idle` |
| 考え込み等 | Extension | `thinking` Pack |

`gaze` / `attention` / `emotion` はレガシー向けにパッケージは残しますが、公式 preset では採用しません。詳細は [plugins.md](reference/plugins.md) と [ADR: Plugin 層](adr/plugin-layer.md)。

## 編集インターフェース

振る舞いは **Preset v3**（`.pfpreset`）にまとめます。

| UI | 担当 |
| --- | --- |
| **かんたんモード** | 動きのつなぎ（Graph）、オプション動き（Plugins + Extension） |
| **Scratch（Blockly）** | If / Assign / Motion Pack |
| **PFScript** | DSL ソース（`behaviorPfScript`） |
| **Graph Editor** | 数値 / stateful / `motionFunction` / motionPack / ext:* |
| **Preset Manager** | JSON 直接編集 |

詳細は [presets.md](reference/presets.md)、[pfscript.md](reference/pfscript.md)、[motion-extension.md](reference/motion-extension.md)。

## マイルストーン（現行）

```text
StateStore + Channel + Timeline
 ↓
@puppetflow/runtime（60 Hz tick）
 ↓
@puppetflow/adapter-vmc + Motion Mapper
 ↓
外部 Viewer（nijiexpose 等）
```

基本デモ: interest を上げると Graph 経由で笑顔（`mouthX`）が変わり、PFScript で体が揺れ、`blink` / `idle` が目と視線を補完する。

## 想定ユースケース

- AITuber
- VRM アプリ
- Discord Bot
- Home Assistant アバター
- デスクトップマスコット
- ゲーム NPC

DOLL は PuppetFlow の上に構築される実装例の一つです（DOLL 専用機能はコアに含めません）。

## 次に読むもの

- [アーキテクチャ](architecture.md)
- [ロードマップ](roadmap.md)
- [はじめての使い方](guides/getting-started.md)
- [プリセット（Standard モデル）](reference/presets.md)
