# Studio ガイド

`apps/studio` は PuppetFlow の **メイン制作・監視ツール** です。  
キャラの描画は外部 Viewer で行い、Studio ではパイプラインの編集と OSC 送出設定を行います。

## 起動

```bash
pnpm dev:studio
```

Tauri ウィンドウ（`puppetflow-studio.exe`）から開いてください。ブラウザで `http://localhost:1422` を直接開くと OSC 送信が無効になる場合があります。

## 編集モード

画面上部で **かんたん** / **エキスパート** を切り替えられます。次の設定は **ブラウザの localStorage**（キー `puppetflow.studio.config.v1`）に自動保存され、次回起動時に復元されます。

| 保存される項目                                                  | タイミング                |
| --------------------------------------------------------------- | ------------------------- |
| 編集モード（かんたん / エキスパート）                           | 切り替え時                |
| 最後に開いていたタブ（モード別）                                | タブ選択時                |
| Motion Mapper（Viewer プリセット・OSC 設定・custom マッピング） | **Apply Mapper** 後       |
| Input Sources（適用済み + 入力中の下書き）                      | 入力変更時 / **Apply** 後 |

Preset の編集内容（PFScript 下書き等）は **Preset に適用** または `.pfpreset` エクスポートで保存してください。未適用の Preset JSON は再起動で消えます。

**CLI 用設定**は画面上部の「適用済み設定」から **CLI 設定をエクスポート** で `puppetflow.yaml` を保存できます（保存先を選択。カスタム Preset の場合は `.pfpreset` も同時に出力）。Preset Manager のダウンロードも同様に保存先を選べます。詳細は [CLI ガイド](cli.md)。

| モード       | 向いている人          | 主な画面                                                               |
| ------------ | --------------------- | ---------------------------------------------------------------------- |
| かんたん     | 初めての方・配信者    | 動作確認、キャラの雰囲気、動きのつなぎ、オプション動き、キャラへの送信 |
| エキスパート | JSON / Graph を触る人 | 従来の Pipeline、Graph Editor、Input Sources、Preset JSON 編集         |

## 画面構成

### 適用済み設定サマリー

画面上部に、現在ランタイムに適用されている Preset・Plugins・Behavior・Sources・Mapper 設定を表示します。

### Pipeline

State を手動入力し、パイプライン全体の出力を監視するタブです。

| パネル                     | 内容                                                       |
| -------------------------- | ---------------------------------------------------------- |
| State Inputs               | interest / energy / stress スライダー                      |
| State Inspector            | State Store の JSON スナップショット                       |
| Motion (merged → rendered) | Target / Rendered を **表形式** で比較                     |
| Pipeline Outputs           | `blink` / `idle` / `behavior` / `graph` 各段階（マージ前） |

外部 Source が有効な場合、Source からの値が State に反映されます。

### Scratch (Blockly)

条件分岐と Motion Pack をブロックで編集します。操作音は無効です。

| ブロック    | 説明                                     |
| ----------- | ---------------------------------------- |
| If          | State 比較（interest / energy / stress） |
| Assign      | Motion キーへの代入                      |
| Motion Pack | Extension Pack の呼び出し（考え込み等）  |

- 「behavior を Preset に適用」で `behavior` のみ更新（`behaviorPlugins` / `graph` / `extensions` は保持）
- 画面上部に **有効なプラグイン** を表示

数値マッピングは Graph Editor、固定の動き追加は **オプション動き**（`extensions.packs`）または Graph の Motion Pack ノードを使います。同一 Pack を複数経路で有効にしないでください。

### PFScript

エキスパートモード専用。上級者向け DSL で `behaviorPfScript` を編集します。

| 操作           | 説明                                                |
| -------------- | --------------------------------------------------- |
| コンパイル     | behavior AST を JSON プレビュー                     |
| Preset に適用  | `behaviorPfScript` + コンパイル済 `behavior` を保存 |
| サンプルを挿入 | 公式サンプルを読み込み                              |

構文・組み込み関数: [PFScript リファレンス](../reference/pfscript.md)

### Graph Editor

React Flow による **数値グラフ + Extension ノード** 編集です（If ノードなし）。

```text
State Input → Multiply → Motion Output (mouthX 等)
Motion Pack / Generator / ext:* （エッジ不要）
```

- Preset 切替時に `graph` を **自動読み込み**（ノード位置も復元）
- 「Export to Preset JSON」は **既存 Preset にマージ**（behaviorPlugins / extensions 等を保持）
- オプション動きと Graph で同じ Pack が重複している場合、エクスポート時に警告
- 「エクスポートをランタイムに適用」で即反映

### Preset Manager

- 組み込み Preset **6 種**の適用
- 分割 JSON エディタ: `behaviorPlugins` / `behavior` / `graph` / `extensions`
- フル Preset JSON
- `.pfpreset` のダウンロード / ファイルインポート

v3 では `rules` / `modifiers` / behavior 内 `Builtin` は **読み込みエラー** になります。

### Plugins（オプション動き）

公式プリセットは **blink + idle** を基本とします。`gaze` / `attention` / `emotion` はカスタム preset 向けです。

| プラグイン | 効果（公式での役割）             |
| ---------- | -------------------------------- |
| Blink      | まばたき（`eyeYaw`）             |
| Idle       | 低 interest 時の視線 wander      |
| Gaze       | 常時視線ゆらぎ（レガシー例）     |
| Attention  | 注目姿勢（レガシー例）           |
| Emotion    | 感情チャンネル連動（レガシー例） |

Graph / PFScript と同一 Motion キーが重複している場合、Preset 適用時と Next Step バーに警告が表示されます。

変更後は **設定を反映** でランタイムへ適用します。

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
3. まばたき・待機視線 → **オプション動き**（公式は blink + idle）
4. 条件分岐 → **Scratch** または **PFScript**
5. interest → mouthX 等の数値マッピング → **Graph Editor**
6. 上級者向け条件・式 → **PFScript**（エキスパート）
7. まとめて保存・共有 → **Preset Manager**
8. 外部アプリから State → **State Sources**

## Playground / Editor との関係

| App        | 関係                                             |
| ---------- | ------------------------------------------------ |
| Playground | Studio の軽量版（スライダー + VMC、Preset 6 種） |
| Editor     | Studio の Graph Editor のスタンドアロン版        |

本格的な作業は Studio に集約することを推奨します。

関連: [Behavior Plugins](../reference/plugins.md) / [プリセット](../reference/presets.md)
