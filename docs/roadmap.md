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
| 4     | Preset システム                            | ✅ → **v3 に移行済み** |
| 5     | Playground（Tauri デモ）                   | ✅                     |

---

## Phase 6〜8 — vNext（Behavior + Graph） ✅

| 項目                                                 | 状況 |
| ---------------------------------------------------- | ---- |
| `@puppetflow/behavior`（AST / Runtime）              | ✅   |
| `@puppetflow/motion-graph`（数値ノード、Logic なし） | ✅   |
| Preset v3 のみ（v1 / v2 廃止）                       | ✅   |
| `@puppetflow/behavior-packs`（Standard + 6 種）      | ✅   |
| Studio Graph Editor                                  | ✅   |
| Studio Scratch（Blockly）                            | ✅   |
| MotionState キー整理（12 標準 + custom）             | ✅   |
| Modifier 自然動作チューニング                        | ✅   |

---

## Phase 6b — Behavior Plugins ✅

| 項目                                                            | 状況 |
| --------------------------------------------------------------- | ---- |
| `@puppetflow/plugin-blink` / `idle`（**公式**）                 | ✅   |
| `@puppetflow/plugin-gaze` / `attention` / `emotion`（レガシー） | ✅   |
| Preset v3 の `behaviorPlugins`                                  | ✅   |
| Studio オプション動きタブ + overlap / レガシー警告              | ✅   |
| 公式 preset は **blink + idle** に統一                          | ✅   |

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

| 機能                                                         | 状況 |
| ------------------------------------------------------------ | ---- |
| かんたん / エキスパートモード                                | ✅   |
| Pipeline（段階別表示）                                       | ✅   |
| Scratch（Blockly）                                           | ✅   |
| PFScript タブ                                                | ✅   |
| Graph Editor（stateful / motionFunction / Extension ノード） | ✅   |
| Plugins + Extension タブ                                     | ✅   |
| Preset Manager                                               | ✅   |
| State Sources                                                | ✅   |
| Motion Mapper                                                | ✅   |
| hook 分割 + `features/{shared,simple,expert}`（R2）          | ✅   |

キャラ描画は外部 Viewer 連携を前提としています。

---

## Phase 11 — Input Channel & Timeline 🔶

[追加仕様.md](追加仕様.md) / [implementation-plan-input-timeline.md](implementation-plan-input-timeline.md)

| 項目                                                  | 状況    |
| ----------------------------------------------------- | ------- |
| ChannelStore（sticky）/ TimelineStore                 | ✅      |
| Graph: channelInput / volumeToMouth / phonemeToShape  | ✅      |
| PFScript: `volume`, `currentPhoneme`, `eventActive()` | ✅      |
| Studio Pipeline 監視                                  | ✅      |
| Timeline Sources（Rhubarb / VOICEVOX 等）             | ⬜ 将来 |

---

## Phase 12 — PFScript ✅

[implementation-plan-pfscript.md](implementation-plan-pfscript.md) — **M1–M6 完了**

| 項目                                                     | 状況    |
| -------------------------------------------------------- | ------- |
| Lexer / Parser / Lowering（`@puppetflow/pfscript-core`） | ✅      |
| `behaviorPfScript` + Preset コンパイル                   | ✅      |
| Studio PFScript タブ                                     | ✅      |
| 組み込み関数 + stateful 関数                             | ✅      |
| `examples/pfscript/` サンプル                            | ✅      |
| Phase 2（ローカル変数、式中 Pack 呼び出し）              | ⬜ 将来 |

---

## Phase 13 — Motion Extension ✅

| 項目                                                              | 状況 |
| ----------------------------------------------------------------- | ---- |
| `@puppetflow/extension-core` + Extension Layer                    | ✅   |
| Motion Pack（thinking / tail / ears 等）                          | ✅   |
| Graph: motionPack / motionGenerator / ext:\* / **motionFunction** | ✅   |
| PFScript: `thinking()` 等の CallStmt                              | ✅   |
| `extensions` フィールド（Preset v3）                              | ✅   |

---

## Phase 14 — Stateful 関数 ✅

[implementation-plan-stateful.md](implementation-plan-stateful.md) / [stateful.md](reference/stateful.md)

| 項目                                      | 状況    |
| ----------------------------------------- | ------- |
| oscillator / smooth / spring / randomHold | ✅      |
| blink / breath / wander / cooldown        | ✅      |
| Graph + PFScript + Scratch 統合           | ✅      |
| TailPhysics / EarPhysics サンプル         | ⬜ 将来 |

---

## Phase 15 — Standard モデル & リファクタリング ✅

[refactoring-plan.md](refactoring-plan.md)

| フェーズ | 内容                                                       | 状況 |
| -------- | ---------------------------------------------------------- | ---- |
| R0       | overlap 検知、preset CI、`collect-preset-motion-keys`      | ✅   |
| R1       | Preset 正本 ADR、TS ビルド、`Standard.pfpreset`            | ✅   |
| R2       | Studio hook 分割、`features/` 整理                         | ✅   |
| R3       | Plugin overlap、レガシー案内、ADR plugin-layer             | ✅   |
| R4       | PFScript 関数カタログ、`motionFunction` Graph、Mapper 集約 | ✅   |
| R5       | ドキュメント同期（overview / architecture / roadmap 含む） | ✅   |

---

## Phase 10 — Ecosystem 🔶

- `examples/ecosystem` による複数アダプタ同時デモ ✅
- Live2D / VRM アダプタ ✅
- npm 公開形態・コミュニティ Preset 配布 ⬜

---

## Phase 16 — CLI 🔶

[guides/cli.md](guides/cli.md)

| 項目                                  | 状況  |
| ------------------------------------- | ----- |
| `pf run`（Preset + VMC + Sources）    | ✅    |
| YAML 設定（`puppetflow.yaml`）        | ✅    |
| `@puppetflow/runtime-launcher` 共通化 | ✅    |
| `pf validate` / `pf compile`（CI）    | ⬜ C2 |
| Studio → YAML export                  | ✅    |

---

## 将来の検討（未計画）

- `idle` 視線の PFScript `wander()` への完全移行（破壊的変更の評価）
- `plugin-gaze` の Extension / stateful 統合
- `adapter-inochi2d`（[ADR](adr/motion-mapper-inochi2d.md) で live2d 継続を決定済み）
- Home Assistant / LLM 連携 Source
- Preset v4 新フィールド
- コミュニティ Preset マーケットプレイス
