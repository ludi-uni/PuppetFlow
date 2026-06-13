# 実装計画 — PFScript（Behavior Language）

> **ステータス: M1–M6 完了（2026-06）**  
> 仕様ソース: [追加仕様.md](追加仕様.md)（PFScript 章）  
> 関連: [behavior-and-graph.md](reference/behavior-and-graph.md) / [motion-extension.md](reference/motion-extension.md) / [presets.md](reference/presets.md)

---

## 1) ゴール

PFScript を **Scratch / Graph と並ぶ上級者向け Behavior 記述 DSL** として実装する。

```text
State / Channel / Timeline / Plugin Functions
  ↓
PFScript（.pfscript）
  ↓
Parser → PFScript AST
  ↓
Lowering → Behavior AST（拡張）
  ↓
executeBehavior()
  ↓
merge → Modifiers → Extension Layer → Adapters
```

**設計原則（仕様より）**

- Lua VM は使わない。パース → AST → 既存 Runtime 実行。
- ループ・モジュール・I/O は **最初から禁止**（言語処理系の肥大化を防ぐ）。
- PFScript は「Lua 互換」ではなく **キャラ振る舞い専用の小さな DSL** に留める。

---

## 2) 現状とのギャップ

| 領域                        | 現状                                                  | 仕様で必要                                                                |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `@puppetflow/pfscript-core` | 関数呼び出し 1 行の正規表現パースのみ                 | 全文 Lexer / Parser / AST                                                 |
| Behavior AST                | `If` / `Assign`（**数値リテラルのみ**）/ `MotionPack` | 式・文字列比較・`elseif`・カスタムキー代入                                |
| Behavior Runtime            | State 比較のみ。Channel / Timeline 未参照             | `volume`, `currentPhoneme`, `time`, `eventActive()`                       |
| Motion キー                 | 16 標準 + `custom`                                    | 仕様上の `smile`, `mouthOpen`, `MouthA` 等（**エイリアス設計が必要**）    |
| Preset v3                   | `behavior` JSON のみ                                  | `.pfscript` ソースの保存・コンパイル経路                                  |
| Studio                      | PFScript タブなし                                     | エキスパート向けエディタ + コンパイルプレビュー                           |
| Graph                       | 数値パイプラインは独立                                | PFScript の `interest * 0.5` は Behavior 式として実行（Graph とは別経路） |

**既存資産の再利用**

- `MotionPack` / `registry.addFunction()` — PFScript の `thinking(intensity=0.8)` は **MotionPack 文または Call 文** に lower 可能。
- Extension Layer — PFScript 内 Pack 呼び出しと `extensions.packs` の二重実行に注意（Graph と同様の重複警告）。

---

## 3) 設計決定（提案・要 ADR）

| #   | 論点                         | 提案                                                                                                                                              |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | PFScript AST と Behavior AST | **2 段 AST**。PFScript AST → Lowering → Behavior AST（Scratch/Blockly と同じ出口）                                                                |
| D2  | Graph との関係               | Graph は **現状維持**（数値 UI）。PFScript は Behavior 式を担い、Graph へ自動 lower しない（Phase 1）                                             |
| D3  | 仕様の Motion 名             | **エイリアス表**（`smile` → `mouthX` 等）を `pfscript-core` に定義。未マップは `custom` へ                                                        |
| D4  | Preset への格納              | `behaviorPfScript?: string`（ソース）+ `behavior`（コンパイル結果キャッシュ）。Studio Export 時に両方更新                                         |
| D5  | ローカル変数                 | **Phase 1 非対応**（`lerp(smile, targetSmile, 0.1)` の `targetSmile` は仕様例だが state 変数が無い）。Phase 2 で `let` 検討 or ドキュメントで禁止 |
| D6  | `elseif`                     | Lowering で nested `If` チェーンに変換                                                                                                            |
| D7  | 文字列比較                   | BehaviorCondition を拡張（`StringCompare`: `currentPhoneme == "A"`）                                                                              |

---

## 4) マイルストーン

| #      | 名称                     | 目標                                                   | 期間目安  |
| ------ | ------------------------ | ------------------------------------------------------ | --------- |
| **M1** | **Language Core**        | Lexer / Parser / PFScript AST / 単体テスト             | 1.5〜2 週 |
| **M2** | **Lowering & Runtime**   | PFScript AST → Behavior AST、式評価 Runtime            | 2〜2.5 週 |
| **M3** | **Builtins & Context**   | State/Channel/Timeline/time/標準関数/Plugin 関数       | 1.5〜2 週 |
| **M4** | **Preset & CLI**         | `.pfscript` 読込、Preset v3 フィールド、コンパイル API | 1 週      |
| **M5** | **Studio PFScript タブ** | エディタ、コンパイルプレビュー、behavior 反映          | 1.5〜2 週 |
| **M6** | **Docs & 公式サンプル**  | リファレンス、サンプル `.pfscript`、移行ガイド         | 0.5 週    |

**合計目安: 8〜10 週**（1 人フルタイム相当。Graph/Extension 並行開発時は +バッファ）

---

## 5) Epics と Issues

### Epic E1 — PFScript Language Core（`@puppetflow/pfscript-core`）

**Objective:** 仕様どおりの構文をパースし、PFScript AST を生成する。

**Scope (in):** 代入、算術/比較/論理、if/else/elseif、コメント `--`、識別子、リテラル（number/boolean/string）、関数呼び出し  
**Scope (out):** while/for、table、require、実行

| ID  | Issue                 | Size | Priority | 受け入れ条件                                                   |
| --- | --------------------- | ---- | -------- | -------------------------------------------------------------- |
| I1  | PFScript AST 型定義   | S    | P0       | `Assign`, `If`, `Expr`, `Call`, `Block` の discriminated union |
| I2  | Lexer（トークナイザ） | M    | P0       | 識別子、数値、文字列、`then/end/and/or/not`、演算子、コメント  |
| I3  | Parser（再帰下降）    | L    | P0       | 追加仕様のサンプル全文がパース可能                             |
| I4  | 禁止構文の検出        | S    | P0       | `while`/`for`/`goto`/`require` で parse error                  |
| I5  | パーサテストスイート  | M    | P0       | 正常系 20+、エラー系 10+（スナップショット可）                 |

**Deliverables:** `packages/pfscript-core/src/lexer.ts`, `parser.ts`, `ast.ts`, `parse-pfscript.ts`

---

### Epic E2 — Lowering（PFScript AST → Behavior AST）

**Objective:** 既存 `@puppetflow/behavior` が実行できる形へ変換。

| ID  | Issue                                               | Size | Priority | 受け入れ条件                                                  |
| --- | --------------------------------------------------- | ---- | -------- | ------------------------------------------------------------- |
| I6  | Behavior AST 拡張：`Expr` / `ExprAssign`            | M    | P0       | `smile = interest * 0.5` が AST 化                            |
| I7  | Behavior AST 拡張：`StringCompare` / `elseif` lower | M    | P0       | `currentPhoneme == "A"`、`elseif` チェーン                    |
| I8  | `lowerPfScriptToBehavior(root)`                     | M    | P0       | サンプル PFScript → 既存 executor で実行可能                  |
| I9  | Motion エイリアス表                                 | S    | P1       | `smile`→`mouthX`, `mouthOpen`→`mouthY` 等（要プロダクト確認） |
| I10 | `Call` → `MotionPack` / Extension 関数              | M    | P1       | `thinking(intensity=0.8)` → `MotionPack` 文                   |
| I11 | Lowering テスト                                     | M    | P0       | サンプル全文の golden AST テスト                              |

**Dependencies:** E1 完了

---

### Epic E3 — Behavior Runtime 拡張（式評価）

**Objective:** PFScript が参照するデータソースを Runtime で解決。

| ID  | Issue                                        | Size | Priority | 受け入れ条件                                                   |
| --- | -------------------------------------------- | ---- | -------- | -------------------------------------------------------------- |
| I12 | `BehaviorExecutionContext` 拡張              | S    | P0       | `time`, `channels`, `timeline`, `activeTimelineEvents`         |
| I13 | 式 evaluator（`evaluateExpr`）               | L    | P0       | 算術・比較・論理・関数呼び出し                                 |
| I14 | 標準関数: Math / Trig / noise / clamp / lerp | M    | P0       | 仕様記載の組み込み関数                                         |
| I15 | 組み込み変数: State / Channel / time         | M    | P0       | `interest`, `volume`, `time`                                   |
| I16 | Timeline: `currentPhoneme`                   | M    | P1       | アクティブ phoneme イベントから取得                            |
| I17 | `eventActive(name)`                          | M    | P2       | Timeline イベント存在チェック（API 設計要）                    |
| I18 | `custom` キーへの ExprAssign                 | S    | P1       | `tailWag = noise(time)`                                        |
| I19 | Runtime 統合テスト                           | M    | P0       | PFScript コンパイル結果が `executeBehavior` で mouth/look 変化 |

**Dependencies:** E2 完了

---

### Epic E4 — Preset / ファイル I/O

**Objective:** `.pfscript` と Preset v3 の統合。

| ID  | Issue                                            | Size | Priority | 受け入れ条件                                     |
| --- | ------------------------------------------------ | ---- | -------- | ------------------------------------------------ |
| I20 | Preset v3 フィールド `behaviorPfScript?: string` | S    | P1       | load 時に optional。無ければ従来 `behavior` のみ |
| I21 | `compilePresetBehavior(preset)`                  | M    | P1       | PFScript あり → parse → lower → `behavior` 更新  |
| I22 | コンパイルエラーの行番号付き報告                 | S    | P1       | Studio / CLI で表示可能                          |
| I23 | `.pfscript` 単体ファイル API                     | S    | P2       | `readPfScriptFile` + `compileToBehaviorJson`     |
| I24 | load-preset テスト                               | S    | P1       | PFScript 付き Preset の round-trip               |

**Note:** Preset `version` は **3 のまま**（v4 は不要。optional フィールド追加で足りる）。

---

### Epic E5 — Studio PFScript タブ

**Objective:** エキスパートモードで PFScript を編集・コンパイル・適用。

| ID  | Issue                                   | Size | Priority | 受け入れ条件                                              |
| --- | --------------------------------------- | ---- | -------- | --------------------------------------------------------- |
| I25 | PFScript タブ UI（CodeMirror / Monaco） | M    | P1       | シンタックスハイライト（最小）                            |
| I26 | 「コンパイル → behavior プレビュー」    | M    | P1       | JSON AST または read-only 表示                            |
| I27 | 「Preset に適用」                       | S    | P1       | `behaviorPfScript` + コンパイル済 `behavior` を保存       |
| I28 | エラー表示（行・列）                    | S    | P1       | パース / lower 失敗時                                     |
| I29 | Help / サンプル挿入                     | S    | P2       | 追加仕様のサンプルをワンクリック挿入                      |
| I30 | Pack 重複警告連携                       | S    | P2       | PFScript 内 `thinking()` と `extensions.packs` の重複検知 |

**Dependencies:** E1〜E4（M4 まで）完了

---

### Epic E6 — ドキュメント & サンプル

| ID  | Issue                             | Size | Priority | 受け入れ条件                     |
| --- | --------------------------------- | ---- | -------- | -------------------------------- |
| I31 | `docs/reference/pfscript.md` 新規 | M    | P1       | 構文・組み込み関数・禁止事項     |
| I32 | 公式サンプル `examples/pfscript/` | S    | P2       | リップシンク + thinking サンプル |
| I33 | `追加仕様.md` ↔ 実装差分の注記    | S    | P2       | エイリアス表・Phase 外機能を明記 |

---

## 6) 推奨実装順序（スプリント）

```text
Sprint 1 (M1):  I1–I5   Parser 完成、サンプル全文パース
Sprint 2 (M2):  I6–I8, I11  Lowering + Behavior AST 拡張
Sprint 3 (M3):  I12–I15, I18–I19  式評価 + Runtime 統合
Sprint 4 (M3b): I16–I17, I9–I10  Timeline / エイリアス / Pack 呼び出し
Sprint 5 (M4):  I20–I24  Preset 統合
Sprint 6 (M5):  I25–I28  Studio タブ
Sprint 7 (M6):  I29–I33  仕上げ
```

---

## 7) テスト戦略

| 層              | 内容                                                                 |
| --------------- | -------------------------------------------------------------------- |
| **Parser**      | 正常系スナップショット、禁止構文エラー、エッジ（空行、コメントのみ） |
| **Lowering**    | PFScript → Behavior AST golden file                                  |
| **Runtime**     | 固定 State/Channel/Timeline で `executeBehavior` 出力 assert         |
| **Integration** | `PuppetFlowRuntime` + PFScript 付き Preset で rendered motion 変化   |
| **Studio**      | コンパイルエラー表示の E2E（手動 QA チェックリスト）                 |

---

## 8) スコープ外（明示的にやらない）

仕様・追加仕様の「柵」に従い、以下は **Phase 1〜2 では実装しない**。

- `while` / `repeat` / `for` / `goto`
- 配列・table・userdata
- `os.*` / `io.*` / `require` / モジュール
- Lua 互換レイヤー
- PFScript から Graph ノードへの自動変換（将来 Epic として分離可）
- ローカル変数 `let`（仕様例の `targetSmile` は Phase 2 以降の ADR）

---

## 9) リスクと緩和

| リスク                               | 影響                     | 緩和                                                 |
| ------------------------------------ | ------------------------ | ---------------------------------------------------- |
| Motion 名の不一致（smile vs mouthX） | Viewer 連携混乱          | D3 エイリアス表 + Adapter ドキュメント               |
| 言語機能の肥大化                     | 保守コスト増             | 禁止リストを Parser で enforce（I4）                 |
| Pack 二重実行                        | モーション過剰           | 既存 `extension-duplicates` を PFScript 解析にも拡張 |
| Behavior AST 破壊的変更              | Scratch/既存 Preset 互換 | ExprAssign は additive。旧 Assign は維持             |
| Timeline API 未整備                  | `currentPhoneme` 遅延    | I16 を P1、eventActive を P2 に分離                  |

---

## 10) 完了定義（Definition of Done）

- [x] 追加仕様の [サンプル PFScript](追加仕様.md) がパース・コンパイル・実行できる
- [x] `pnpm test` に pfscript parser / lower / runtime テストが含まれる（+30 件目安）
- [x] Studio エキスパートモードに PFScript タブがあり、Preset へ適用できる
- [x] `docs/reference/pfscript.md` が索引（`docs/README.md`）に載る
- [x] Preset v3 で `behaviorPfScript` 付き公式サンプル（`examples/pfscript/pfscript-demo.pfpreset`）

---

## 11) 依存パッケージ（変更予定）

```text
packages/pfscript-core/     ← 大幅拡張（lexer, parser, ast, lower, aliases）
packages/behavior/          ← AST + execute 拡張（Expr, StringCompare）
packages/preset/            ← behaviorPfScript フィールド
packages/runtime/           ← load 時コンパイルフック（optional）
apps/studio/                ← PFScriptEditor タブ
docs/reference/pfscript.md  ← 新規
```

---

## 12) オープンクエスチョン（実装前に決定）

1. **Motion エイリアス** — `smile` / `mouthOpen` / `MouthA` を標準 16 キー + custom のどれにマップするか（Live2D 向け命名との整合）。
2. **`thinking()` の実行経路** — Behavior 内 `MotionPack` として即実行 vs Extension Layer 委譲（後者は tick タイミングが異なる）。
3. **PFScript と Graph の役割分担** — 同一 Preset で PFScript 代入と Graph output が同キーを触った場合の merge ルール（平均のままか、優先度か）。
4. **Preset にソースを保存するか** — `behaviorPfScript` のみ vs コンパイル済 `behavior` のみ（推奨: 両方、ソースを正とする）。

---

_本計画は [implementation-plan.md](implementation-plan.md)（vNext 完了）の後続 Epic として位置づける。_
