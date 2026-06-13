# Behavior Plugins

State / Channel から Motion へ変換する **拡張可能なプラグイン層** です。Preset v3 の `behaviorPlugins` で定義し、Studio の「オプション動き」タブから数値パラメータを編集できます。

Motion Pack（考え込み・尻尾等）は **別レイヤー** です。`extensions.packs` と Extension Layer については [motion-extension.md](motion-extension.md) を参照してください。

## パイプライン上の位置

```text
StateStore / ChannelStore
  ↓
Behavior Plugins     ← behaviorPlugins（gaze, blink, idle, attention, emotion）
  ↓
Behavior Runtime     ← If / Assign / MotionPack（Scratch）
  ↓
Motion Graph         ← 数値ノード + motionPack / ext:*（Graph Editor / 動きのつなぎ）
  ↓
merge → Motion Modifiers
  ↓
Extension Layer      ← extensions.packs / graph motionPack（Motion Pack プラグイン）
  ↓
Adapters
```

## 公式プラグイン

| パッケージ                     | id          | 動かす Motion キー             |
| ------------------------------ | ----------- | ------------------------------ |
| `@puppetflow/plugin-gaze`      | `gaze`      | `lookX`, `lookY`               |
| `@puppetflow/plugin-blink`     | `blink`     | `facePitch`                    |
| `@puppetflow/plugin-idle`      | `idle`      | `lookX`, `lookY`               |
| `@puppetflow/plugin-attention` | `attention` | `bodyLean`, `headTilt`         |
| `@puppetflow/plugin-emotion`   | `emotion`   | `mouthX`, `facePitch`, `lookX` |

### Preset での定義

```json
"behaviorPlugins": [
  { "id": "gaze", "config": { "wanderAmplitude": 0.04, "speed": 0.12 } },
  { "id": "blink", "config": { "blinkStrength": 0.15, "minInterval": 3 } }
]
```

`config` の各キーは **0〜1 または秒単位** など、プラグインごとに型付きパラメータです。Studio のプラグインカタログ（`plugin-catalog.ts`）にラベル・最小/最大・デフォルト・影響する Motion キーが定義されています。

### パラメータを追加する手順

1. プラグインパッケージの `*PluginConfig` にフィールドを追加し、`process()` で Motion へ反映
2. `apps/studio/src/constants/plugin-catalog.ts` にパラメータ定義（`min` / `max` / `motionKeys`）を追加
3. 必要なら公式 `.pfpreset` の `behaviorPlugins` デフォルトを更新

カタログに載せたパラメータは Studio でスライダーとして自動表示されます。

## ランタイム API

```ts
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { GazePlugin } from "@puppetflow/plugin-gaze";

const runtime = new PuppetFlowRuntime().use(new GazePlugin({ wanderAmplitude: 0.04 }));
```

Preset 読み込み後に `runtime.use()` で追加することもできます（同一 id の重複に注意）。

## Studio での編集

| タブ / セクション               | Preset フィールド  | 内容                                  |
| ------------------------------- | ------------------ | ------------------------------------- |
| **オプション動き**（上半分）    | `behaviorPlugins`  | gaze / blink 等の ON/OFF + スライダー |
| **オプション動き**（拡張 Pack） | `extensions.packs` | 考え込み / 尻尾等の Motion Pack       |
| **Preset Manager**              | 両方               | JSON 直接編集                         |
| **Pipeline**                    | —                  | 各プラグイン段階の出力を表形式で表示  |

関連: [プリセット](presets.md) / [Behavior と Motion Graph](behavior-and-graph.md) / [Motion Extension](motion-extension.md)
