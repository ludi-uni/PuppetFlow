# PuppetFlow CLI

Studio なしで PuppetFlow を常時稼働するヘッドレス CLI です。配信 PC やサーバーで Preset を読み込み、VMC OSC でモーションを送出します。

## インストール（開発）

リポジトリルートで:

```bash
pnpm install
```

## 配布版（GitHub Releases）

[Releases](https://github.com/ludi-uni/PuppetFlow/releases) から `pf-cli-<platform>-<version>-portable.zip` を取得し、展開してください。**Node.js のインストールは不要**です。

```powershell
# Windows
Expand-Archive pf-cli-windows-x64-0.1.0-portable.zip -DestinationPath pf-cli
cd pf-cli
.\pf.exe run --preset Curious
```

```bash
# Linux / macOS
unzip pf-cli-linux-x64-0.1.0-portable.zip -d pf-cli
cd pf-cli
./pf run --preset Curious
```

ZIP 内の `README.txt` にも同じ手順があります。

## 起動

```bash
pnpm pf run --preset Curious
```

外部 Viewer を `127.0.0.1:39539`（VMC 既定）で起動してから実行してください。

## コマンド

### `pf run`

| オプション                    | 説明                                          |
| ----------------------------- | --------------------------------------------- |
| `-c, --config <path>`         | YAML 設定ファイル                             |
| `-p, --preset <name-or-path>` | 公式名（`Curious` 等）または `.pfpreset` パス |
| `--state <key=value>`         | 起動時 State（繰り返し可）                    |
| `--http-url <url>`            | HTTP 入力ソース                               |
| `--ws-url <url>`              | WebSocket 入力ソース                          |
| `--mqtt-broker <url>`         | MQTT ブローカー                               |
| `--mqtt-topic <topic>`        | MQTT トピック                                 |
| `--vmc-host`, `--vmc-port`    | VMC 送出先                                    |
| `--no-vmc`                    | VMC 送出を無効化                              |
| `--live2d`, `--vrm`           | 追加 OSC アダプタ                             |
| `--websocket-port <port>`     | モーション WebSocket ブロードキャスト         |
| `--no-logger`                 | スロットル付きログを無効化                    |

## YAML 設定（`puppetflow.yaml`）

```yaml
version: 1
preset: ./presets/Standard.pfpreset # または presetName: Curious

state:
  interest: 0.6

sources:
  http: http://127.0.0.1:3000/input
  websocket: ws://127.0.0.1:8080/input
  mqtt:
    broker: mqtt://127.0.0.1:1883
    topic: puppetflow/input

adapters:
  vmc:
    enabled: true
    host: 127.0.0.1
    port: 39539
  logger:
    enabled: true
    throttleMs: 5000
```

```bash
pnpm pf run --config puppetflow.yaml
```

`preset` の相対パスは **設定ファイルのディレクトリ** 基準です。CLI フラグは YAML より優先されます。

## Studio からエクスポート

Studio 上部の **適用済み設定** パネルにある **CLI 設定をエクスポート** を押すと、現在適用されている Preset・Sources・Mapper・Pipeline の State が `puppetflow.yaml` になります。保存先はダイアログで選べます（カスタム Preset の場合はフォルダ選択で YAML と `.pfpreset` をまとめて保存）。

| Preset 種別        | ダウンロード内容                                  |
| ------------------ | ------------------------------------------------- |
| 公式（Curious 等） | `puppetflow.yaml` のみ（`presetName` フィールド） |
| カスタム           | `puppetflow.yaml` + 同名の `.pfpreset`            |

両ファイルを同じフォルダに置いて:

```bash
pnpm pf run --config puppetflow.yaml
```

## 停止

`Ctrl+C` で停止します。`PuppetFlow runtime stopped.` と表示されれば VMC 送出も止まっています。

Windows で止まらない場合、以前の `pf run` プロセスが残っていることがあります。タスクマネージャーで `pf.exe` / `node` / `tsx` を終了するか:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*cli.ts*run*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## Studio との関係

| 用途              | ツール          |
| ----------------- | --------------- |
| 制作・編集・監視  | Studio（Tauri） |
| 常時稼働・配信 PC | CLI（`pf run`） |

Studio の Mapper / Sources 設定は **適用済み設定 → CLI 設定をエクスポート** から YAML 化できます。

## 例

- [examples/cli](../../examples/cli/README.md)
- [getting-started](getting-started.md)
