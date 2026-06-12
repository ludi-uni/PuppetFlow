# 実装計画 — Input Channel & Timeline

> **ステータス: M1〜M3 完了（2026-06）** — Timeline Sources（M5）は未着手  
> 仕様: [追加仕様.md](追加仕様.md)  
> 設計決定: [adr/input-timeline-design-decisions.md](adr/input-timeline-design-decisions.md)

[追加仕様.md](追加仕様.md)（Input Channel & Timeline 拡張）に基づく実装計画です。  
vNext MVP（[implementation-plan.md](implementation-plan.md)）完了後の Phase 11 相当です。

## 確定した設計決定

| #   | 論点           | 決定                                                                            |
| --- | -------------- | ------------------------------------------------------------------------------- |
| 1   | Channel 寿命   | **sticky**（tick クリアなし。Source が無音時に 0 / Rest を送る）                |
| 2   | Timeline 原点  | **global `elapsedTime` のみ**（発話ごと reset なし）                            |
| 3   | 口形表現       | **mouthX / mouthY** + **あいうえお別 phoneme テーブル**（A/I/U/E/O + N + Rest） |
| 4   | Preset v2      | Channel / Timeline は **含めない**（ランタイム入力のみ）                        |
| 5   | plugin-emotion | **Channel 入力へ移行**（`emotion` 文字列 + 数値 channel 併用可）                |

---

## 1) Summary of the goal

- 入力を **State / Channel / Timeline** の3層に分離し、外部システムは「入力データ」を渡すだけにする
- `runtime.channels.*` / `runtime.timeline.*` API を `@puppetflow/runtime` に追加する
- Behavior / Motion Graph から Channel・Timeline を参照し、**音量リップシンク・音素リップシンク**を MotionState → VMC まで流す
- Timeline Source（SRT / VOICEVOX 変換）は Core 外の将来パッケージとする
- `plugin-emotion` を Channel ベースに移行する

**目標パイプライン:**

```text
State Sources  ──→ StateStore
External I/O   ──→ ChannelStore   (sticky)
Bridge/Script  ──→ TimelineStore   (global clock)
                        ↓
              Plugins → Behavior → Graph → Modifiers → Adapters → VMC
```

---

## 2) Assumptions

- 既存 StateStore / State Sources / Preset v2 スキーマは破壊的変更なし
- Preset に `channels` / `timeline` フィールドは追加しない（graph 内の phoneme ノードのみ可）
- Timeline `currentMs = elapsedTime * 1000`（発話 reset API なし）
- 1 Issue ≒ 0.5〜2 日

---

## 3) Milestones

| #   | 名称                         | 目標                                                    | 期間目安  |
| --- | ---------------------------- | ------------------------------------------------------- | --------- |
| M1  | **Input Core**               | ChannelStore / TimelineStore / 型 / Runtime API         | 1〜1.5 週 |
| M2  | **Pipeline 統合**            | tick 統合、Graph ノード、phoneme テーブル、emotion 移行 | 1.5〜2 週 |
| M3  | **Studio & Sources**         | Pipeline 監視、Graph UI、Channel ペイロード             | 1.5〜2 週 |
| M4  | **LipSync 縦スライス**       | volume + phoneme E2E デモ                               | 1 週      |
| M5  | **Timeline Sources**（将来） | 外部フォーマット → TimelineEvent 変換                   | 2〜3 週   |

---

## 4) Epics and Issues

### Epic E1 — `@puppetflow/core` Input Layer

- **Objective:** Channel / Timeline のデータモデルと Store
- **Scope (in):** 型、Store、subscribe、公式 Channel キー、phoneme 形状テーブル
- **Scope (out):** Runtime tick、Studio
- **Key risks:** なし（D1〜D5 確定済み）

**Issues:**

- **I1 Define input types** (size: S, priority: P0)
  - Description: `ChannelValue`, `TimelineEvent`, `LipSyncEvent`, 公式 Channel 型
  - Deliverables: `packages/core/src/channel.ts`, `timeline.ts`
  - Acceptance criteria: 追加仕様の JSON 例が zod バリデーション可能
  - Dependencies: なし

- **I2 Implement ChannelStore (sticky)** (size: M, priority: P0)
  - Description: `set` / `get` / `getAll` / `subscribe` / `delete` — **tick クリアなし**
  - Deliverables: `channel-store.ts`, テスト 8 件以上
  - Acceptance criteria: set 後、次 tick でも値が残る
  - Dependencies: I1

- **I3 Implement TimelineStore** (size: M, priority: P0)
  - Description: `push`, `getActiveEvents(currentMs)`, 期限切れ GC
  - Deliverables: `timeline-store.ts`, テスト 10 件以上
  - Acceptance criteria: global `currentMs` で active / inactive が正しい
  - Dependencies: I1

- **I4 Phoneme shape table (あいうえお)** (size: S, priority: P0)
  - Description: A / I / U / E / O / N / Rest → `{ mouthX, mouthY }` の個別エントリ
  - Deliverables: `packages/core/src/phoneme-shapes.ts`
  - Acceptance criteria: 7 音素すべて異なる mouthX/Y。`Rest` は中立 (0, 0)
  - Dependencies: I1
  - Notes: モデル別上書きは motion-mapper プロファイル連携（P2）

- **I5 Official channel registry** (size: S, priority: P1)
  - Description: `volume`, `phoneme`, `emotion`, `gazeTarget`, `joy`, `sadness`, `anger`
  - Deliverables: `official-channels.ts`
  - Dependencies: I1

---

### Epic E2 — `@puppetflow/runtime` 統合

- **Objective:** `channels` / `timeline` 公開と tick 組み込み
- **Scope (in):** API、Pipeline スナップショット、global clock
- **Scope (out):** 発話 reset API

**Issues:**

- **I6 Expose runtime.channels / runtime.timeline** (size: M, priority: P0)
  - Description: `RuntimeChannelStore`（set → scheduleTick）
  - Deliverables: `runtime.ts` 更新
  - Acceptance criteria: 追加仕様の API シグネチャと一致
  - Dependencies: I2, I3

- **I7 Integrate global timeline clock** (size: M, priority: P0)
  - Description: 毎 tick `currentMs = elapsedTime * 1000` → `getActiveEvents`
  - Deliverables: Graph / Behavior コンテキスト拡張
  - Acceptance criteria: push イベントが endMs 後に inactive
  - Dependencies: I6

- **I8 Extend pipeline snapshot** (size: S, priority: P1)
  - Description: `channels`, `activeTimelineEvents` を Studio へ
  - Dependencies: I6

---

### Epic E3 — Behavior & Graph 拡張

**Issues:**

- **I9 Graph: channelInput** (size: M, priority: P0)
  - Dependencies: I6

- **I10 Graph: timeline nodes** (size: M, priority: P0)
  - Description: `currentPhoneme`, `eventActive`, `currentEventStrength`
  - Dependencies: I7

- **I11 Graph: volumeToMouth** (size: S, priority: P0)
  - Description: volume → mouthY
  - Dependencies: I9

- **I12 Graph: phonemeToShape** (size: M, priority: P0)
  - Description: phoneme 文字列 → I4 テーブル参照 → mouthX / mouthY 出力
  - Dependencies: I4, I10

- **I13 Migrate plugin-emotion to Channel** (size: M, priority: P0)
  - Description: `StateStore` の joy/sadness/anger → `ChannelStore` 読み取りへ
  - Deliverables: `plugin-emotion` 更新、テスト、preset behaviorPlugins ドキュメント更新
  - Acceptance criteria:
    - `channels.set("emotion", "joy")` で従来相当の mouthX 出力
    - 数値 channel `joy` があれば優先
  - Dependencies: I6

- **I14 Behavior: channel string conditions** (size: M, priority: P1)
  - Description: `If channel.emotion == "curious"`
  - Dependencies: I6

- **I15 LipSync example preset (graph only)** (size: S, priority: P1)
  - Description: `lipsync-basic.pfpreset` — graph に volume + phoneme ノード。channels/timeline フィールドなし
  - Dependencies: I11, I12

---

### Epic E4 — Input Sources & 外部連携

**Issues:**

- **I16 Extend payload parser for channels/timeline** (size: M, priority: P0)
  - Description: `{ "channels": {...}, "timeline": [...] }`
  - Dependencies: I6

- **I17 Update source-http / source-websocket** (size: M, priority: P1)
  - Dependencies: I16

- **I18 Example: TTS bridge** (size: M, priority: P1)
  - Description: RMS → `channels.volume`, JSON → `timeline.push`
  - Dependencies: I17, I15

---

### Epic E5 — Studio UX

**Issues:**

- **I19 Pipeline: Channels & Timeline panel** (size: M, priority: P1)
- **I20 Graph Editor: new node palette** (size: M, priority: P1)
- **I21 State Sources UI: channel payload examples** (size: S, priority: P2)
- **I22 Timeline debug injector** (size: M, priority: P2)

---

### Epic E6 — Timeline Sources（将来 M5）

- **I23 TimelineSource interface** (size: S, priority: P2)
- **I24 Rhubarb JSON adapter** (size: M, priority: P2)
- **I25 VOICEVOX timing JSON adapter** (size: L, priority: P2)

---

## 5) Dependency graph

```text
I1 → I2, I3, I4, I5
I2, I3 → I6 → I7
I4 → I12
I6 → I9, I10, I13, I16
I9 → I11
I10 → I12
I11, I12 → I15
I16 → I17 → I18
I6 → I8 → I19
I9–I12 → I20
```

**クリティカルパス:** I1 → I2/I3/I4 → I6 → I7 → I9/I10 → I11/I12 → I15 → I18

---

## 6) Risks & mitigations

| リスク                               | 対策                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| sticky Channel が古い値を保持        | Source 契約で無音時 0 / Rest を必須化。ドキュメントに明記                      |
| Timeline イベント蓄積                | `endMs < currentMs - buffer` で GC                                             |
| emotion 移行の破壊的変更             | 数値 channel 併用で移行期間を確保。State 読み取りは 1 リリース deprecated ログ |
| あいうえおテーブルがモデルに合わない | Mapper プロファイルで phoneme テーブル上書き（P2）                             |

---

## 7) Open questions

**None** — D1〜D5 は [adr/input-timeline-design-decisions.md](adr/input-timeline-design-decisions.md) で確定済み。

---

## 推奨実装順（最初の 2 週間）

| 週     | タスク                                |
| ------ | ------------------------------------- |
| Week 1 | I1–I4 → I6 → I7 → I13（emotion 移行） |
| Week 2 | I9–I12 → I16 → I15 → I8/I19 最小 UI   |
