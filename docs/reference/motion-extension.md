# Motion Extension Plugin System

`docs/追加仕様.md` に基づく拡張レイヤーです。**State / Channel / Timeline は書き換えず**、Parameter / Function / Node / Motion Pack を追加します。

## パイプライン

```text
State / Channel / Timeline
  → Behavior Plugins
  → Behavior (If / Assign / MotionPack)
  → Motion Graph
  → merge → Modifiers
  → Extension Layer    ← ここ
  → Adapters
```

## MotionState.custom

標準 16 キーに加え、独自パラメータを `custom` に格納します。

```json
{
  "mouthX": 0.4,
  "custom": {
    "tailWag": 0.7,
    "earAngle": 0.3
  }
}
```

## Preset での定義（v3 + extensions）

```json
{
  "name": "Thinking",
  "version": 3,
  "extensions": {
    "packs": [
      { "id": "thinking", "config": { "intensity": 0.8 } },
      { "id": "tailWag", "config": { "intensity": 0.7 } }
    ],
    "parameterDefaults": { "earAngle": 0.5 }
  }
}
```

## プラグインカテゴリ

| カテゴリ    | パッケージ例                    | 役割                           |
| ----------- | ------------------------------- | ------------------------------ |
| Parameter   | `@puppetflow/plugin-tail`       | `tailWag` 等を registry に追加 |
| Motion Pack | `@puppetflow/plugin-thinking`   | 考え込み等の決まった動き       |
| Generator   | `@puppetflow/plugin-lookaround` | 複数 Motion キーを生成         |
| Function    | bundled `heartbeat`             | PFScript 関数                  |
| Node        | bundled `ext:heartbeat`         | Graph 専用ノード               |
| Timeline    | bundled `blinkScheduler`        | 将来: イベント生成             |

## 編集面

| UI                      | 内容                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Studio → オプション動き | Motion Pack ON/OFF + パラメータ                                      |
| Scratch                 | Motion Packs カテゴリ（考え込む等）                                  |
| Graph                   | `motionPack` / `motionGenerator` / `motionFunction` / `ext:*` ノード |
| PFScript                | `@puppetflow/pfscript-core` で `thinking(intensity=0.8)` 等          |

## 新規プラグインの追加

1. `@puppetflow/extension-core` の `ExtensionPlugin` を実装
2. `@puppetflow/extension-bundled` に登録（またはランタイムで別途 register）
3. `plugin-catalog` / Studio UI は registry から自動列挙

関連: [plugins.md](plugins.md) / [presets.md](presets.md) / [追加仕様.md](../追加仕様.md)
