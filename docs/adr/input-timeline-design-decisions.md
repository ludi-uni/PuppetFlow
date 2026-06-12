# ADR: Input Channel & Timeline 設計決定

**Status:** Accepted  
**Date:** 2026-06-11

## Context

[追加仕様.md](../追加仕様.md)（Input Channel & Timeline 拡張）に基づく [implementation-plan-input-timeline.md](../implementation-plan-input-timeline.md) の Open Questions を確定する。

## Decisions

### D1 — Channel 寿命は sticky

- Channel 値は **tick ごとにクリアしない**
- 最後に `set` された値を保持し、上書きまたは `delete` まで維持する
- 無音・イベント終了時は **入力側（Source / 外部ブリッジ）** が `volume: 0` や `phoneme: "Rest"` を送る
- `RuntimeChannelStore.set()` は State と同様に tick をスケジュールする

### D2 — Timeline 原点はランタイム global のみ（発話リセットなし）

- `currentMs = runtime.elapsedTime * 1000` を唯一の時刻基準とする
- **発話ごとの `timeline.reset()` は実装しない**（MVP スコープ外）
- 外部から新しい発話を流す場合は、絶対 `startMs` / `endMs` でイベントを push する

### D3 — 口形は mouthX / mouthY のまま、あいうえお別テーブルを用意

- `MotionState` キーは **16 種のまま拡張しない**
- 音素リップシンクは `mouthX` / `mouthY` へのルックアップで表現する
- **あ・い・う・え・お（A / I / U / E / O）を個別エントリ**として `phoneme-shapes` テーブルに定義する
- 併せて `N`（ん・閉口寄り）と `Rest`（中立）も公式エントリとする
- モデル差は Motion Mapper プロファイルで上書き可能にする（将来）

### D4 — Preset v2 に Channel / Timeline は含めない

- `.pfpreset` スキーマに `channels` 初期値や `timeline` シーケンスは **追加しない**
- Channel / Timeline は **ランタイム入力のみ**（API / Source / 外部ブリッジ）
- リップシンクの **変換ロジック（Graph ノード・phoneme テーブル参照）** は Preset の `graph` に含めてよい

### D5 — plugin-emotion は Channel 入力へ移行（当面）

- `plugin-emotion` は `StateStore` の `joy` / `sadness` / `anger` ではなく **Channel** を読む
- 文字列 Channel `emotion`（例: `"curious"`, `"joy"`, `"sadness"`, `"anger"`）を主入力とする
- 数値 Channel（`joy`, `sadness`, `anger`）が併送された場合は数値を優先（後方互換・ブリッジ用）
- Builtin / behavior-packs 内の感情参照も段階的に Channel へ寄せる（E3 の I13 と連動）

## Consequences

- Source 側は「値を止める」責任を持つ（sticky のため）
- 長時間ランタイムでは Timeline イベントの GC が必須
- `plugin-emotion` の breaking change: State の `joy` 等は非推奨。ドキュメントと example を Channel ペイロードに更新
- Preset ファイルは変更不要（graph の phoneme ノード追加のみ）

## References

- [追加仕様.md](../追加仕様.md)
- [implementation-plan-input-timeline.md](../implementation-plan-input-timeline.md)
