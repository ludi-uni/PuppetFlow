# 実装計画 — Micro Behavior (Phase 1)

> **ステータス: Phase 1 実装済み（2026-06）**  
> 仕様: [追加仕様.md](追加仕様.md)（Phase 1: Micro Behavior 対応）  
> 前提: vNext パイプライン（Runtime / Adapters / Playground）が稼働していること

[追加仕様.md](追加仕様.md) の Phase 1 に基づく実装計画です。Animation Layer / Blend Tree / Motion Graph は **Phase 2 以降**（本計画の非目標）。

---

## 確定した設計決定

| #   | 論点                     | 決定                                                                                      |
| --- | ------------------------ | ----------------------------------------------------------------------------------------- |
| D1  | Behavior API の配置      | **PuppetFlow 内蔵 HTTP サーバー**（`POST /behavior` 等）。CLI `--behavior-port` で起動   |
| D2  | Pipeline 合成方式        | Micro Behavior が**触ったキーのみ絶対値上書き**（`addMotionState` 加算は使わない）         |
| D3  | blink プラグイン共存     | Micro Behavior **実行中は blink を一時停止**（完了後に再開）                               |
| D4  | デバッグ UI の配置       | **Playground + Studio Pipeline タブ**（かんたん / エキスパート両方）                       |
| D5  | パラメータマップ         | 仕様の `eyeY` → `lookY`、`eyeOpen` → `eyeYaw`（[motion-state.md](reference/motion-state.md)） |
| D6  | motionOverride 優先順位  | **motionOverride > micro-behavior > pipeline**（HTTP motion 上書きが最優先）               |
| D7  | パッケージ名             | **`@puppetflow/micro-behavior`**（既存 `@puppetflow/behavior` = PFScript と区別）        |
| D8  | strength 拡張            | Phase 1 では JSON パースのみ（未指定 = 1.0）。振幅スケールは Phase 1 末 or Phase 2       |

---

## 1) Summary of the goal

- 外部 Micro Behavior Engine から Behavior 名（`look_up` 等）を **内蔵 HTTP API** で受信し、VMC 向けモーションを実行する
- **Behavior Registry / Executor / Queue** でタイムライン再生・FIFO 直列実行・Cooldown・ランダム化を実現する
- Runtime パイプラインでは Extension 後に **触ったキーのみ絶対値上書き**、blink は実行中一時停止
- **Playground** に Behavior Debug パネル（状態表示 + 手動実行ボタン）を追加する
- Phase 1 完了時点で 6 Behavior（look_up / look_left / look_right / head_tilt / small_nod / long_blink）が動作する

**目標パイプライン:**

```text
Micro Behavior Engine（外部）
        ↓ POST {"behavior":"look_up"}
PuppetFlow 内蔵 HTTP API
        ↓
MicroBehaviorEngine（Registry + Queue + Executor）
        ↓ 触ったキーのみ絶対値上書き（blink 一時停止）
Motion Override（HTTP motion — 最優先）
        ↓
Adapters → VMC
```

---

## 2) Assumptions

- 上位 Behavior Engine / Micro Behavior Engine は別プロセス（PuppetFlow は HTTP クライアントから POST を受ける側）
- HTTP サーバーは **127.0.0.1 バインド**（認証なし、ローカル開発・同ホスト連携想定）
- 1 Issue ≒ 0.5〜2 日、テストは vitest
- `@puppetflow/behavior`（PFScript AST）とは無関係の独立レイヤー

---

## 3) Milestones

| #   | 名称                         | 目標                                                         | 期間目安  |
| --- | ---------------------------- | ------------------------------------------------------------ | --------- |
| M1  | **Micro Behavior Core**      | Registry・Easing・Executor（6 Behavior）                       | 1〜1.5 週 |
| M2  | **Queue & Policy**           | FIFO・maxConcurrent:1・Cooldown・ランダム化                  | 0.5〜1 週 |
| M3  | **Runtime & HTTP API**       | tick 統合（絶対値上書き・blink 停止）、内蔵 HTTP、CLI       | 1〜1.5 週 |
| M4  | **Playground Debug**         | Behavior Debug パネル、手動実行                              | 0.5 週    |
| M5  | **E2E 検証**                 | 完了条件 6 項目の達成確認                                    | 0.5 週    |

---

## 4) Epics and Issues

### Epic E1 — `@puppetflow/micro-behavior` コア

- **Objective:** Behavior 定義とタイムライン実行の独立パッケージ
- **Scope (in):** Registry、Easing、6 Behavior Executor、ユニットテスト
- **Scope (out):** Runtime 統合、HTTP、UI
- **Key risks:** 仕様 `eyeY: 0.4` と MotionState `lookY: 0.5` 中心の差 → `param-map.ts` で固定

**Issues:**

- **I1 パッケージ雛形と型定義** (size: S, priority: P0)
  - Description: `packages/micro-behavior/` 作成
  - Deliverables: `BehaviorId`, `BehaviorDefinition`, `BehaviorKeyframe`, `BehaviorRequest`, `BehaviorStatus`
  - Acceptance criteria: `pnpm build` / vitest 通過
  - Dependencies: なし

- **I2 Easing ユーティリティ** (size: S, priority: P0)
  - Description: 線形補間禁止。Ease In / Ease Out + オーバーシュート（eyeYaw 用）
  - Deliverables: `src/easing.ts`, `src/easing.test.ts`
  - Acceptance criteria: 中間点が線形と異なる、1.0→1.15→1.0 の overshoot 再現
  - Dependencies: I1

- **I3 Behavior Registry** (size: M, priority: P0)
  - Description: YAML/JSON — duration / cooldown / randomization 範囲
  - Deliverables: `behaviors/registry.yaml`, `src/registry.ts`, `src/registry.test.ts`
  - Acceptance criteria: 仕様の cooldown（look_up: 5s 等）が読み込める
  - Dependencies: I1

- **I4 Behavior Executor** (size: L, priority: P0)
  - Description: Keyframe → 経過時間 `t` に対する `Partial<MotionState>`（絶対値）
  - Deliverables: `src/executor.ts`, `src/param-map.ts`, `src/behaviors/*.ts`, テスト
  - Acceptance criteria:
    - `look_up`: lookY 上→維持→戻る（Ease In/Out）
    - `look_left` / `look_right`: lookX
    - `head_tilt`: headTilt
    - `small_nod`: nod 波形
    - `long_blink`: eyeYaw ゆっくり閉開
  - Dependencies: I2, I3
  - Notes: 仕様 JSON の相対値 → MotionState 絶対値変換を `param-map.ts` に集約

- **I5 ランダム化** (size: S, priority: P1)
  - Description: 実行開始時に amplitude / duration をレンジ内 jitter
  - Deliverables: `src/randomize.ts`, テスト
  - Acceptance criteria: 10 回実行で全同一にならない（seed 固定時は再現）
  - Dependencies: I3, I4

---

### Epic E2 — Queue & Cooldown

- **Objective:** 衝突防止と連続実行抑制
- **Scope (in):** FIFO、maxConcurrent:1、Cooldown discard
- **Scope (out):** 優先度 Queue、並列実行

**Issues:**

- **I6 BehaviorQueue** (size: M, priority: P0)
  - Description: 実行中は Queue へ、完了後 FIFO で次を開始
  - Deliverables: `src/queue.ts`, テスト
  - Acceptance criteria: 3 件 enqueue → 直列、maxConcurrent:1
  - Dependencies: I4

- **I7 Cooldown 管理** (size: S, priority: P0)
  - Description: Cooldown 中はリクエスト破棄（Queue にも入れない）
  - Deliverables: `src/cooldown.ts`, 統合テスト
  - Acceptance criteria: look_up 5s 内の再 POST が無視
  - Dependencies: I3, I6

- **I8 MicroBehaviorEngine ファサード** (size: M, priority: P0)
  - Description: `request()`, `tick(deltaTime)`, `getStatus()`, `getQueueStatus()`, `getActiveKeys()`
  - Deliverables: `src/engine.ts`, テスト
  - Acceptance criteria: 仕様 JSON 形式の status / queueLength が返る
  - Dependencies: I5, I6, I7

---

### Epic E3 — Runtime 統合 & 内蔵 HTTP API

- **Objective:** PuppetFlowRuntime 接続と外部 POST 受信
- **Scope (in):** 絶対値上書き合成、blink 一時停止、HTTP サーバー、CLI
- **Scope (out):** WebSocket envelope（P2）、Studio UI

**Issues:**

- **I9 Runtime tick 統合** (size: M, priority: P0)
  - Description:
    - Extension 後、`engine.tick()` の出力を **触ったキーのみ** `renderedMotion` に上書き
    - Micro Behavior 実行中は **blink プラグインをスキップ**（`pluginOutputs` にも inactive 表示）
    - 完了後 blink 再開
  - Deliverables: `packages/runtime/src/runtime.ts`, `runtime.test.ts`
  - Acceptance criteria:
    - long_blink 中 blink が eyeYaw を上書きしない
    - look_up 中 lookY が pipeline 出力を絶対値で置換
  - Dependencies: I8
  - Notes: `motionOverride.applyTo()` は従来どおり最後（D6）

- **I10 内蔵 Behavior HTTP サーバー** (size: M, priority: P0)
  - Description:
    - `POST /behavior` — `{"behavior":"look_up"}` （`strength` パースのみ）
    - `GET /behavior/status` — `{ activeBehavior, remaining }`
    - `GET /behavior/queue` — `{ queueLength }`
    - デフォルト `127.0.0.1:8787`（CLI で変更可）
  - Deliverables: `packages/micro-behavior/src/http-server.ts`（Node `http` モジュール）
  - Acceptance criteria: curl POST で motion 変化、GET で状態取得
  - Dependencies: I8, I9

- **I11 CLI / runtime-launcher 連携** (size: S, priority: P0)
  - Description: `pf run --behavior-port 8787`、YAML `behaviorApi.port`
  - Deliverables: `apps/cli`, `packages/runtime-launcher`, `packages/cli-config`
  - Acceptance criteria: CLI 起動ログに Behavior API URL 表示
  - Dependencies: I10

- **I12 blink 一時停止フック** (size: S, priority: P0)
  - Description: Runtime が `microBehaviorEngine.isActive()` 時 blink plugin の `process` を呼ばない
  - Deliverables: I9 に含めても可。long_blink 専用ではなく **任意 Micro Behavior 実行中** に適用
  - Acceptance criteria: 実行中のみ blink 停止、完了 1 フレーム以内に再開
  - Dependencies: I9

---

### Epic E4 — Playground Behavior Debug

- **Objective:** 仕様「Behavior Debug」を Playground で実現（D4）
- **Scope (in):** 状態表示、6 ボタン手動実行
- **Scope (out):** Studio Pipeline タブ

**Issues:**

- **I13 Runtime スナップショット公開** (size: S, priority: P0)
  - Description: `onMicroBehaviorUpdate` または pipeline snapshot に active / queue / cooldown 残り
  - Deliverables: `packages/runtime` 公開 API
  - Acceptance criteria: Playground hook から購読可能
  - Dependencies: I9

- **I14 Playground MicroBehaviorDebugPanel** (size: M, priority: P1)
  - Description:
    - 表示: 現在 Behavior / Queue 数 / Cooldown 状態
    - ボタン: Look Up, Look Left, Look Right, Head Tilt, Small Nod, Long Blink
    - ボタンは `runtime.microBehavior.request()` を直接呼ぶ（HTTP 経由でも可）
  - Deliverables: `apps/playground/src/components/MicroBehaviorDebugPanel.tsx`, `App.tsx` 統合
  - Acceptance criteria: ボタン押下で VMC 出力変化、状態表示が更新
  - Dependencies: I13

---

### Epic E5 — ドキュメント & E2E

**Issues:**

- **I15 リファレンス** (size: S, priority: P1)
  - Description: `docs/reference/micro-behavior.md` — API、param-map、Registry 編集
  - Dependencies: I10

- **I16 E2E 検証** (size: M, priority: P0)
  - Description: `examples/micro-behavior/` — CLI + curl 手順
  - Acceptance criteria: [追加仕様.md](追加仕様.md) 完了条件 6 項目すべて ✅
  - Dependencies: I10, I14

---

## 5) Dependency graph

```text
I1 → I2 → I4
I1 → I3 → I4 → I6 → I8 → I9 → I10 → I11
I3 → I5 ────────────────────────┘
I6 → I7 ────────────────────────┘
I9 → I12
I9 → I13 → I14
I10 → I16
I14 → I16
```

---

## 6) 合成ロジック（D2 / D3 詳細）

### 絶対値上書き（D2）

```ts
// packages/runtime — tick 内（概念）
const microOut = microBehaviorEngine.tick(deltaTime);
if (microOut) {
  for (const key of microBehaviorEngine.getActiveKeys()) {
    renderedMotion[key] = microOut[key]!;
  }
  for (const [k, v] of Object.entries(microOut.custom ?? {})) {
    renderedMotion.custom[k] = v;
  }
}
// その後 motionOverride.applyTo(renderedMotion)
```

- 未タッチキーは pipeline + modifiers + extensions の値を維持
- `addMotionState` は **使用しない**

### blink 一時停止（D3）

```ts
for (const plugin of this.plugins) {
  if (plugin.id === "blink" && microBehaviorEngine.isActive()) {
    continue; // スキップ
  }
  // ... process
}
```

- `long_blink` だけでなく **全 Micro Behavior 実行中** に blink 停止（eyeYaw 競合防止）
- 完了フレームから blink の stateful / 内部タイマーはそのまま継続

---

## 7) HTTP API 仕様（D1）

| Method | Path               | Body / Response                                      |
| ------ | ------------------ | ---------------------------------------------------- |
| POST   | `/behavior`        | Request: `{"behavior":"look_up"}` → `204` or `200`   |
| GET    | `/behavior/status` | `{"activeBehavior":"look_up","remaining":0.4}`       |
| GET    | `/behavior/queue`  | `{"queueLength":2}`                                  |

- 未知の behavior → `400`
- Cooldown 中 → `204`（無視、エラーにしない）
- CORS: Playground から別ポート curl 時は `Access-Control-Allow-Origin: *`（ローカルのみ）

---

## 8) Risks & mitigations

| リスク                         | 対策                                           |
| ------------------------------ | ---------------------------------------------- |
| `@puppetflow/behavior` との混同 | パッケージ名・UI ラベル「Micro Behavior」      |
| eyeY / lookY 中心値差          | `param-map.ts` + Executor スナップショットテスト |
| Tauri Playground で HTTP サーバー | Node 側のみ（CLI） vs Playground 内直接 `request()` — Playground ボタンは in-process、外部 Engine は CLI `--behavior-port` |
| motionOverride との境界        | D6 をドキュメント化、integration test          |

---

## 9) Open questions

**None** — D1〜D4 は 2026-06-18 に確定。

---

## 10) Phase 1 完了条件チェックリスト

- [x] Micro Behavior Engine から Behavior 名を POST 受信可能（内蔵 HTTP）
- [x] PuppetFlow で 6 Behavior 実行可能
- [x] Queue 動作（FIFO、maxConcurrent:1）
- [x] Cooldown 動作（連続 look_up 等を無視）
- [x] ランダム化動作（同一 Behavior で微小変動）
- [x] Playground Behavior Debug 動作（状態 + 手動ボタン）

---

## 11) 推奨実装順（Vertical Slice）

```text
Week 1:  I1 → I2 → I3 → I4（look_up + long_blink のみ）
Week 2:  I6 → I7 → I8 → I9 + I12（Runtime 絶対値上書き + blink 停止）
Week 3:  I10 → I11（内蔵 HTTP + CLI）+ 残り 4 Behavior + I5
Week 4:  I13 → I14（Playground Debug）+ I16 E2E + I15 ドキュメント
```
