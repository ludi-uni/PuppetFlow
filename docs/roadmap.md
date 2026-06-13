# ロードマップ

Phase 1 を完了したうえで、OSS として段階的に拡張する計画です。  
**実装状況** は 2026-06 時点のリポジトリに基づきます。

凡例: ✅ 完了 / 🔶 一部 / ⬜ 未着手

---

## Phase 1〜5 — 基盤 ✅

| Phase | 内容                                       | 状況                   |
| ----- | ------------------------------------------ | ---------------------- |
| 1     | StateStore → Motion → VMC → Viewer         | ✅                     |
| 2     | Adapter システム（複数同時出力）           | ✅                     |
| 3     | Motion Modifier（smooth / noise / breath） | ✅                     |
| 4     | Preset システム                            | ✅ → **v2 に移行済み** |
| 5     | Playground（Tauri デモ）                   | ✅                     |

---

## Phase 6〜8 — vNext（Behavior + Graph） ✅

| 項目                                                 | 状況 |
| ---------------------------------------------------- | ---- |
| `@puppetflow/behavior`（AST / Runtime / Builtins）   | ✅   |
| `@puppetflow/motion-graph`（数値ノード、Logic なし） | ✅   |
| Preset v2 のみ（v1 廃止）                            | ✅   |
| `@puppetflow/behavior-packs`（6 種）                 | ✅   |
| Studio Graph Editor                                  | ✅   |
| Studio Scratch（Blockly）                            | ✅   |
| MotionState 14 キー整理                              | ✅   |
| Modifier 自然動作チューニング                        | ✅   |

---

## Phase 6b — Behavior Plugins 再統合 ✅

vNext MVP 後、Preset v2 へプラグイン層を再統合しました。

| 項目                                                                   | 状況 |
| ---------------------------------------------------------------------- | ---- |
| `@puppetflow/plugin-rule`                                              | ✅   |
| `@puppetflow/plugin-gaze` / `blink` / `idle` / `attention` / `emotion` | ✅   |
| Preset v2 の `rules` / `behaviorPlugins`                               | ✅   |
| Studio Plugins タブ                                                    | ✅   |
| Scratch / Graph / Mapper での plugin 保持・表示                        | ✅   |

---

## Phase 7 — State Sources ✅

| Source    | パッケージ                     | 状況            |
| --------- | ------------------------------ | --------------- |
| HTTP      | `@puppetflow/source-http`      | ✅              |
| WebSocket | `@puppetflow/source-websocket` | ✅              |
| MQTT      | `@puppetflow/source-mqtt`      | ✅              |
| Discord   | `@puppetflow/source-discord`   | ✅（Node のみ） |

---

## Phase 9 — PuppetFlow Studio ✅

`apps/studio` — デスクトップ制作・監視ツール

| 機能                                      | 状況 |
| ----------------------------------------- | ---- |
| Pipeline（段階別表形式表示）              | ✅   |
| Scratch（Blockly、操作音オフ）            | ✅   |
| Graph Editor（Preset マージエクスポート） | ✅   |
| Plugins タブ                              | ✅   |
| Preset Manager（分割 JSON エディタ）      | ✅   |
| State Sources                             | ✅   |
| Motion Mapper（Rendered Motion 送出）     | ✅   |

キャラ描画は外部 Viewer 連携を前提としています。

---

## Phase 11 — Input Channel & Timeline 🔶

[追加仕様.md](追加仕様.md) / [implementation-plan-input-timeline.md](implementation-plan-input-timeline.md) に基づく拡張。

| 項目                                                            | 状況    |
| --------------------------------------------------------------- | ------- |
| ChannelStore（sticky）/ TimelineStore                           | ✅      |
| runtime.channels / runtime.timeline API                         | ✅      |
| Graph: channelInput / timeline / volumeToMouth / phonemeToShape | ✅      |
| あいうえお phoneme テーブル（A/I/U/E/O + N + Rest）             | ✅      |
| plugin-emotion → Channel 移行                                   | ✅      |
| Source ペイロード（channels / timeline）                        | ✅      |
| Studio Pipeline 監視 + Graph ノード                             | ✅      |
| Timeline Sources（Rhubarb / VOICEVOX 等）                       | ⬜ 将来 |

**確定事項:** Channel は sticky、Timeline は global clock のみ、Preset v2 に channels/timeline は含めない。

---

## Phase 10 — Ecosystem 🔶

- `examples/ecosystem` による複数アダプタ同時デモ ✅
- Live2D / VRM アダプタ ✅
- npm 公開形態・コミュニティ Preset 配布 ⬜

**目標:** イベント駆動型キャラクターランタイムとしての完成形。DOLL はその上の実装例の一つ。

---

## 将来の検討（未計画）

- Home Assistant / LLM 連携 Source
- 追加 Graph ノード（Divide, Min, Max 等）
- Blockly ブロックの拡充
- コミュニティ Preset マーケットプレイス
