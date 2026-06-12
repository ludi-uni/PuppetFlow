# 実装計画 — PuppetFlow vNext

> **ステータス: MVP 完了（2026-06）**  
> 日常の利用・開発は [README.md](README.md) → [architecture.md](architecture.md) / [guides/](guides/) / [reference/](reference/) を参照してください。本ドキュメントは Issue 分解の履歴です。
>
> **MVP 後の追記:** Behavior Plugins（`plugin-rule` / `plugin-gaze` 等）を Preset v2 の `rules` / `behaviorPlugins` として再統合済み。現行仕様は [reference/plugins.md](reference/plugins.md) を参照。

[追加仕様.md](追加仕様.md) に基づく実装計画です。  
Phase 1〜5 完了後、**Behavior Script Engine + Motion Graph Runtime** へ移行しました。

**設計決定（確定）:** [adr/vnext-design-decisions.md](adr/vnext-design-decisions.md)

| #   | 論点                  | 決定                                           |
| --- | --------------------- | ---------------------------------------------- |
| 1   | If / 論理演算の置き場 | **Behavior のみ**（Graph に Logic ノードなし） |
| 2   | gaze / blink 等       | **Behavior Pack に AST 埋め込み**              |
| 3   | Scratch UI            | **Blockly**                                    |
| 4   | Preset v1             | **即時廃止**（一度きり移行スクリプトのみ）     |

---

## 1) Summary of the goal

- **Rule Plugin を削除**し、`@puppetflow/behavior`（AST / Runtime / Compiler）をパイプラインの中心に据える
- **Motion Graph Runtime** を新設し、**数値処理のみ**（条件分岐なし）を担わせる
- **Preset v2**（`behavior` + `graph`）のみをランタイムが受け付ける
- **Studio Editor を 3 モード**（Scratch=Blockly / Graph / JSON）に拡張し、条件分岐は全て `behavior` AST へ
- **公式 Behavior Pack** に gaze / blink / idle 等を **埋め込み**、独立 Behavior Plugin を廃止

---

## 2) Assumptions

- キャラ描画は引き続き **外部 Viewer**。Adapter は出力先のまま
- State Sources・Adapters・Motion Modifiers は vNext でも維持
- `plugin-gaze` / `plugin-blink` / `plugin-idle` / `plugin-attention` / `plugin-emotion` は **vNext リリース時にランタイムから削除**（ロジックは Pack AST へ移植）
- Preset `version: 1` は **ランタイム非対応**。repo 内資産は移行スクリプトで一括変換
- Scratch UI は **`blockly`**（`apps/studio` に code-split で組み込み）
- 1 Issue ≒ 0.5〜2 日

---

## 3) Milestones

| #   | 名称                | 目標                                                | 期間目安  |
| --- | ------------------- | --------------------------------------------------- | --------- |
| M1  | **Behavior Core**   | AST + Runtime + Blockly コンパイラ骨格              | 2〜3 週   |
| M2  | **Motion Graph**    | 数値 Graph Runtime（Logic ノードなし）              | 1.5〜2 週 |
| M3  | **Runtime 統合**    | v2 preset のみ、plugin-rule / character plugin 削除 | 1〜2 週   |
| M4  | **Studio 3 モード** | Blockly Scratch + Graph + JSON                      | 2〜3 週   |
| M5  | **Behavior Pack**   | 6 パック（gaze/blink 等を AST 埋め込み）            | 2〜3 週   |

※ 旧 M5（Scratch 単独）は M4 に統合。Logic ノード不要・v1 即廃止により全体 1〜2 週短縮見込み。

---

## 4) Epics and Issues

### Epic E1 — `@puppetflow/behavior` 基盤

- **Objective:** Behavior AST・Runtime・コンパイラ
- **Scope (in):** If / Assign / Block / 比較演算、rules→AST 変換、Blockly→AST コンパイラ
- **Scope (out):** Graph 側の Logic ノード
- **Key risks:** AST 拡張時の Blockly ブロック同期コスト

**Issues:**

- **I1 Define Behavior AST schema** (size: M, priority: P0)
  - Description: `If`, `Assign`, `Block`, `Compare`, `And`/`Or`/`Not` の discriminated union
  - Deliverables: `packages/behavior/src/ast.ts`, zod バリデーション
  - Acceptance criteria:
    - 追加仕様の `If` 例がパース・シリアライズ可能
    - **Logic ノードは Behavior AST にのみ存在**（Graph 型に含めない）
  - Dependencies: なし

- **I2 Implement BehaviorRuntime.execute()** (size: M, priority: P0)
  - Description: AST 走査 → `Partial<MotionState>` または中間変数
  - Deliverables: `execute(ast, stateStore, context?)`, テスト 10 件以上
  - Acceptance criteria:
    - `interest=0.8` + `If interest>0.7 → smile+=0.2` で `smile≈0.2`
    - `And` / `Or` / `Not` のネストが動作
  - Dependencies: I1

- ~~**I3 移行スクリプト**~~ — **不要**（未リリースのため preset を v2 で直接作成済み）

- **I4 Blockly → Behavior AST compiler** (size: M, priority: P0)
  - Description: `blockly` ワークスペース XML/JSON → Behavior AST
  - Deliverables: `packages/behavior/src/compile-blockly.ts`, ブロック定義（if / compare / assign）
  - Acceptance criteria:
    - Blockly 上の If ブロックが I1 AST と同一構造にコンパイル
    - 単体テストで XML サンプル → execute まで完走
  - Dependencies: I1, I2
  - Notes: ライブラリ選定スパイクは **不要**（Blockly 確定）

---

### Epic E2 — `@puppetflow/motion-graph` ランタイム

- **Objective:** 純粋数値グラフの実行（**Logic ノードなし**）
- **Scope (in):** Input / Math / Function / Output
- **Scope (out):** If / And / Or / Not（**D1 によりキャンセル**）

**Issues:**

- **I5 Define Motion Graph document format** (size: S, priority: P0)
  - Description: `nodes[]` + `edges[]`。node type に `logic` カテゴリを **含めない**
  - Deliverables: `packages/motion-graph/src/types.ts`
  - Dependencies: なし

- **I6 Implement MotionGraphRuntime.execute()** (size: L, priority: P0)
  - Description: トポロジカル評価 → `Partial<MotionState>`
  - Acceptance criteria:
    - `Interest → Multiply(0.5) → Smile` で `interest=0.8` → `smile=0.4`
    - 循環グラフで検出エラー
  - Dependencies: I5

- **I7 Implement core node types** (size: M, priority: P0)
  - Description: Input(State, Constant, Time), Math(Add, Subtract, Multiply, Divide, Clamp, Min, Max), Output(MotionKey)
  - Dependencies: I6

- ~~**I8 Implement logic node types**~~ — **CANCELLED**（D1: Behavior のみ）

- **I9 Implement function node types** (size: M, priority: P1)
  - Description: Sin, Cos, Noise, Lerp, Curve（pack 埋め込み用のゆらぎ表現にも使用）
  - Dependencies: I7

---

### Epic E3 — Runtime 統合と Preset v2

- **Objective:** v2 のみのランタイム、旧パッケージ削除
- **Scope (in):** loadPreset v2、tick 変更、plugin-rule / character plugin 削除
- **Scope (out):** v1 ランタイム互換、ロールバックフラグ

**Issues:**

- **I10 Define Preset v2 schema (v1 rejected)** (size: S, priority: P0)
  - Description: `{ name, version: 2, behavior, graph, modifiers?, modifierOrder? }`。`behavior` と `graph` は両方必須（空オブジェクト可）
  - Acceptance criteria:
    - `version: 1` または `rules[]` で **即エラー**（移行スクリプトへのリンクをメッセージに含む）
  - Dependencies: I1, I5

- ~~**I11 repo 内 preset 移行**~~ — **完了**（`presets/*.pfpreset` を v2 で直接記述）

- **I12 Integrate Behavior + Graph into PuppetFlowRuntime tick** (size: L, priority: P0)
  - Description: `State → behavior.execute() → graph.execute() → merge → modifiers → adapters`
  - Deliverables: runtime 変更、Pipeline パネルに behavior / graph 段階の出力表示
  - Acceptance criteria:
    - v2 preset のみで runtime.test 相当がパス
    - `plugin-rule` への参照ゼロ
  - Dependencies: I2, I6, I11
  - Notes: **ロールバックフラグなし**（D4）

- **I13 Remove @puppetflow/plugin-rule and character plugins from runtime** (size: M, priority: P0)
  - Description: `plugin-rule`, `plugin-gaze`, `plugin-blink`, `plugin-idle`, `plugin-attention`, `plugin-emotion` をランタイム・Studio から削除
  - Deliverables: パッケージ削除または `archive/` へ移動、Studio Plugin Manager タブ削除
  - Acceptance criteria: `pnpm build && pnpm test` 成功、Studio に旧 plugin トグルがない
  - Dependencies: I12, I19（pack 先行マージ or feature flag なしで I19 直後に実施）

- **I14 Document character logic embedding in packs** (size: S, priority: P0)
  - Description: gaze/blink 等の AST 埋め込み方針を [adr/vnext-design-decisions.md](adr/vnext-design-decisions.md) に記載済み。pack 作者向けガイドを追記
  - Deliverables: `docs/reference/behavior-packs.md`
  - Acceptance criteria: 各旧 plugin の Motion 出力がどの AST ノードに対応するか一覧化
  - Dependencies: I1（D2 確定済み）

---

### Epic E4 — Studio Editor 3 モード

- **Objective:** Blockly Scratch + Graph（数値のみ）+ JSON
- **Scope (in):** 3 モード、behavior / graph 分離編集

**Issues:**

- **I15 Graph Mode: Motion Graph ノードパレット** (size: M, priority: P0)
  - Description: I7 ノードのみ（**If ノード UI なし**）。export は preset v2 `graph`
  - Dependencies: I7, I10

- **I16 JSON Mode: behavior + graph エディタ** (size: S, priority: P0)
  - Description: `behavior` と `graph` を別セクションで編集・バリデーション
  - Dependencies: I10

- **I17 Scratch Mode (Blockly)** (size: L, priority: P0)
  - Description: `blockly` 組み込み、If / 比較 / Motion 代入ブロック
  - Deliverables: `apps/studio/src/scratch/`, I4 コンパイラ接続
  - Acceptance criteria:
    - 「もし Interest > 0.7 なら Smile += 0.2」を Blockly のみで作成・適用
    - 出力が JSON Mode の `behavior` と一致
  - Dependencies: I4, I10

- **I18 Tri-mode sync** (size: M, priority: P1)
  - Description: Graph ↔ JSON 双方向。Scratch → JSON（behavior）一方向。JSON behavior → Scratch は v2 後半
  - Dependencies: I15, I16, I17

---

### Epic E5 — 公式 Behavior Pack（AST 埋め込み）

- **Objective:** 6 パックに character ロジックを内包
- **Scope (in):** Curious, Thinking, Happy, Sleepy, Idle, Focused

**Issues:**

- **I19 Create @puppetflow/behavior-packs** (size: L, priority: P0)
  - Description: 各 pack の `behavior` AST に gaze / blink / idle / attention / emotion 相当を **埋め込み**
  - Deliverables: `packages/behavior-packs/presets/*.pfpreset`（v2 のみ）
  - Acceptance criteria:
    - **旧 plugin 無効でも** Idle pack で瞬き・視線ゆらぎが再現
    - Curious pack で注目・前のめりが再現
  - Dependencies: I2, I9, I14

- **I20 Port plugin logic into pack AST** (size: L, priority: P0)
  - Description: 既存 `plugin-*` の `process()` ロジックを AST / graph ノード列へ手動移植
  - Deliverables: 移植マッピング表、回帰テスト（旧 plugin 出力との比較）
  - Dependencies: I19

- **I21 Documentation update** (size: S, priority: P0)
  - Description: v2 only、Blockly、pack 埋め込み、v1 移行手順を docs に反映
  - Dependencies: I11, I19

---

### Epic E6 — プラグイン役割の整理

- **Objective:** Plugin = 外部連携（State Source）のみ

**Issues:**

- **I22 Remove Studio Plugin Manager tab** (size: S, priority: P0)
  - Description: タブ削除。State Sources タブに統合。HelpGuide 更新
  - Dependencies: I13

- **I23 Spike: source-llm** (size: M, priority: P2)
  - Description: LLM → StateStore PoC（変更なし）
  - Dependencies: なし

---

## 5) Dependency graph (text)

```text
I1 → I2 → I4 → I17
I1 → I3
I5 → I6 → I7 → I9 → I19
I5 + I6 → I3
I1 + I5 → I10 → I11
I2 + I6 + I11 → I12 → I13 → I22
I1 → I14 → I19 → I20 → I21
I7 + I10 → I15 → I18
I10 → I16 → I18
```

**クリティカルパス:** I1 → I2 → I5 → I6 → I7 → I3 → I10 → I11 → I12 → I19 → I13

---

## 6) Risks & mitigations

| Risk                       | Impact                              | Mitigation                                           |
| -------------------------- | ----------------------------------- | ---------------------------------------------------- |
| gaze/blink の AST 移植工数 | I19/I20 がボトルネック              | 旧 plugin のテストを回帰基準に、1 plugin ずつ移植    |
| Blockly バンドルサイズ     | Studio 起動が重い                   | Scratch タブを dynamic import                        |
| v1 即廃止                  | 外部ユーザーの preset が動かない    | 移行スクリプト + README 冒頭に Breaking Change 明記  |
| Behavior/Graph 境界の混乱  | 編集者が If を Graph に置こうとする | Graph UI に Logic パレットを出さない、Scratch へ誘導 |
| I13 と I19 の順序          | pack 未完了で plugin 削除すると退行 | **I19 を I13 の直前にマージ**（同一 PR でも可）      |

---

## 7) Design decisions（確定 — 再掲）

→ 詳細は [adr/vnext-design-decisions.md](adr/vnext-design-decisions.md)

1. **If / 論理演算 → Behavior のみ**
2. **gaze / blink 等 → Behavior Pack AST 埋め込み**
3. **Scratch UI → Blockly**
4. **Preset v1 → 即時廃止**（ランタイム非対応、移行スクリプトのみ）

**残論点（影響小）:** `behavior` と `graph` の実行順は直列（Behavior → Graph）で固定。追加仕様に従う。

---

## 推奨実装順序（最初の 4 スプリント）

### Sprint 1

- I1, I2, I5, I6

### Sprint 2

- I7, I9, I10, I3（移行スクリプト）, I11（repo 内 preset 置換）

### Sprint 3

- I12, I14, I15, I16, I19（Curious + Idle 先行、gaze/blink 埋め込み）

### Sprint 4

- I4, I17（Blockly）, I20, I13, I22, I21

---

## 完了の定義（vNext MVP）

```text
StateStore
 ↓
Behavior Script Engine   ← If/論理はここだけ（Blockly / JSON）
 ↓
Motion Graph Runtime     ← 数値のみ
 ↓
MotionState
 ↓
Modifiers → Adapters → 外部 Viewer
```

- [x] Preset **v2 のみ**読み書き・適用（v1 はエラー）
- [x] repo 内 preset を v2 に移行済み（`@puppetflow/behavior-packs`）
- [x] Studio Graph で Multiply / Clamp / Output（**If なし**）
- [x] Studio Scratch（Blockly）で If + 比較 + 代入
- [x] 公式 Behavior Pack 6 種（**gaze/blink 等を AST 埋め込み**）
- [x] `plugin-rule` および character plugin **削除済み**

---

## 関連ドキュメント

- [追加仕様.md](追加仕様.md) — vNext 変更仕様
- [adr/vnext-design-decisions.md](adr/vnext-design-decisions.md) — 確定した設計決定
- [architecture.md](architecture.md) — 現行アーキテクチャ（移行前）
