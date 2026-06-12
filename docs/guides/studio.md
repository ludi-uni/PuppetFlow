# Studio ガイド

`apps/studio` は PuppetFlow の **メイン制作・監視ツール** です。  
キャラの描画は外部 Viewer で行い、Studio ではパイプラインの編集と OSC 送出設定を行います。

## 起動

```bash
pnpm dev:studio
```

Tauri ウィンドウ（`puppetflow-studio.exe`）から開いてください。ブラウザで `http://localhost:1422` を直接開くと OSC 送信が無効になる場合があります。

## 画面構成

### 適用済み設定サマリー

画面上部に、現在ランタイムに適用されている Preset・Plugins・Behavior Builtins・Sources・Mapper 設定を表示します。

### Pipeline

State を手動入力し、パイプライン全体の出力を監視するタブです。

| パネル                     | 内容                                                      |
| -------------------------- | --------------------------------------------------------- |
| State Inputs               | interest / energy / stress スライダー                     |
| State Inspector            | State Store の JSON スナップショット                      |
| Motion (merged → rendered) | Target / Rendered を **表形式** で比較                    |
| Pipeline Outputs           | `rule` / `gaze` / `behavior` / `graph` 各段階（マージ前） |

外部 Source が有効な場合、Source からの値が State に反映されます。

### Scratch (Blockly)

条件分岐と Builtin をブロックで編集します。操作音は無効です。

| ブロック | 説明                                     |
| -------- | ---------------------------------------- |
| If       | State 比較（interest / energy / stress） |
| Assign   | Motion キーへの代入                      |
| Builtin  | attention, gaze, blink, idle             |

- 「behavior を Preset に適用」で `behavior` のみ更新（`rules` / `behaviorPlugins` / `graph` / `modifiers` は保持）
- 画面上部に **有効なプラグイン** を表示

数値マッピングは Graph Editor、固定の動き追加は Plugins タブまたは Preset の `behaviorPlugins` を使います。

### Graph Editor

React Flow による **数値グラフ** 編集です（If ノードなし）。

```text
State Input → Multiply → Motion Output (mouthX 等)
```

- Preset 切替時に `graph`（または `rules`）を **自動読み込み**
- 「Export to Preset JSON」は **既存 Preset にマージ**（plugins / behavior / modifiers を保持）
- 「エクスポートをランタイムに適用」で即反映
- 有効なプラグインをパネル表示

### Preset Manager

- 組み込み Preset **6 種**の適用
- 分割 JSON エディタ: `rules` / `behaviorPlugins` / `behavior` / `graph`
- フル Preset JSON（`modifiers` 含む）
- `.pfpreset` のダウンロード / ファイルインポート

### Plugins

Preset に含まれないプラグインをランタイムへ **追加** します。

| プラグイン | 効果       |
| ---------- | ---------- |
| Gaze       | 視線ゆらぎ |
| Blink      | まばたき   |
| Idle       | 待機視線   |
| Attention  | 注目姿勢   |
| Emotion    | 感情表情   |

変更後は **Apply Plugins** で反映。Preset 内の `rules` / `behaviorPlugins` とは独立して追加されます。

### State Sources

| 種別      | 設定               |
| --------- | ------------------ |
| HTTP      | ポーリング URL     |
| WebSocket | 接続 URL           |
| MQTT      | Broker URL + Topic |

変更後は **Apply Sources** でランタイムに反映します。

### Motion Mapper

**Rendered Motion**（plugins + behavior + graph + modifiers 適用後）を各モデル形式に変換して OSC 送信します。

| ターゲット | 用途                   |
| ---------- | ---------------------- |
| VMC        | 汎用 VMC プロトコル    |
| Live2D     | Live2D パラメータ名    |
| VRM        | VRM ブレンドシェイプ名 |

モデルごとに Host / Port / パラメータマッピング / 値変換（identity / centered）を設定できます。有効なプラグインをパネル表示します。

## 典型的な作業フロー

1. **Pipeline** でスライダーを動かし、各段階の出力を確認
2. 外部 Viewer を起動し、**Motion Mapper** で OSC 送信先を設定
3. 固定の gaze / blink → **Plugins** または Preset の `behaviorPlugins`
4. 条件分岐 → **Scratch**
5. interest → mouthX 等の数値マッピング → **Graph Editor**
6. まとめて保存・共有 → **Preset Manager**
7. 外部アプリから State → **State Sources**

## Playground / Editor との関係

| App        | 関係                                             |
| ---------- | ------------------------------------------------ |
| Playground | Studio の軽量版（スライダー + VMC、Preset 6 種） |
| Editor     | Studio の Graph Editor のスタンドアロン版        |

本格的な作業は Studio に集約することを推奨します。

関連: [Behavior Plugins](../reference/plugins.md) / [プリセット](../reference/presets.md)
