# 概要

## PuppetFlow とは

PuppetFlow は次の **いずれでもない** ランタイムです。

- 感情エンジンではない
- AI エンジンではない
- VMC ライブラリでもない

役割は、次のパイプラインを **実行する** ことです。

```text
State
 ↓
Behavior Plugins（behaviorPlugins: gaze / blink 等）
 ↓
Behavior Script Engine（If / Assign / MotionPack）
 ↓
Motion Graph Runtime
 ↓
MotionState（runtime: addMotionState / 内部: merge）
 ↓
Motion Modifiers
 ↓
Extension Layer（extensions / Motion Pack）
 ↓
Adapters → Viewer（外部）
```

キャラクターの **描画** は外部 Viewer（nijiexpose、Live2D、VRM アプリ等）が担います。PuppetFlow は状態からモーションまでを制御します。

## 設計思想

PuppetFlow は **状態・振る舞い・表現** を分離します。

| 層                       | 例                                                  |
| ------------------------ | --------------------------------------------------- |
| State（入力）            | `{ "interest": 0.8, "energy": 0.6 }`                |
| Behavior Plugins         | `gaze` による視線ゆらぎ、`blink` によるまばたき     |
| Behavior（条件）         | `If interest > 0.7 → headTilt += 0.1`               |
| Graph（数値マッピング）  | `interest × 0.5 → mouthX`（Clamp 等も可）           |
| Extension（Motion Pack） | `thinking` パック、`tailWag` カスタムパラメータ     |
| MotionState              | `{ "mouthX": 0.4, "headTilt": 0.2, "lookX": 0.52 }` |
| Adapter（表現）          | `{ "ParamMouthForm": 0.4, "ParamAngleZ": 0.2 }`     |
| Viewer                   | 外部アプリで描画                                    |

State のキーは固定しません。ゲーム・AI・IoT など用途ごとに異なる状態をそのまま受け入れます。

MotionState のキーは [MotionState リファレンス](reference/motion-state.md) で定義された **14 種** に正規化されます。

## 編集インターフェース

振る舞いは **Preset v3**（`.pfpreset`）にまとめます。

| UI                     | 担当                                                    |
| ---------------------- | ------------------------------------------------------- |
| **オプション動き**     | `behaviorPlugins` + `extensions.packs`                  |
| **Scratch（Blockly）** | If / Assign / Motion Pack                               |
| **Graph Editor**       | 数値ノード + motionPack / ext:\*                        |
| **Preset Manager**     | `behaviorPlugins` / `behavior` / `graph` / `extensions` |

詳細は [reference/presets.md](reference/presets.md) と [reference/motion-extension.md](reference/motion-extension.md) を参照。

## マイルストーン（現行）

```text
StateStore
 ↓
Behavior Plugins + @puppetflow/behavior + @puppetflow/motion-graph
 ↓
MotionState + Modifiers
 ↓
@puppetflow/adapter-vmc 等
 ↓
外部 Viewer
```

「interest を上げると口元（mouthX）が変わり、視線（lookX/Y）がゆらぐ」——この体験が基本デモです。

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
- [はじめての使い方](guides/getting-started.md)
- [Behavior Plugins](reference/plugins.md)
