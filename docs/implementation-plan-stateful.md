# 実装計画 — Stateful Node System

> **ステータス: 完了（2026-06）** — M0–M5 + gaze/blink 移行 + Scratch Natural Motion  
> 仕様ソース: [追加仕様.md](追加仕様.md)（Stateful Node System 章）  
> 関連: [behavior-and-graph.md](reference/behavior-and-graph.md) / [pfscript.md](reference/pfscript.md) / [motion-extension.md](reference/motion-extension.md)

---

## 1) ゴール

キャラクターらしい自然な動き（呼吸・慣性・探索・瞬き等）を実現するため、**フレーム間で内部状態を保持する Stateful 関数・ノード**をコア機能として追加する。

```text
State / Channel / Timeline
  ↓
Behavior Plugins
  ↓
Behavior Runtime（PFScript 式評価 — stateful 関数呼び出し）
  ↓
Motion Graph（stateful ノード）
  ↓
merge → Modifiers → Extension Layer → Adapters
         ↑
    StatefulStore（フレーム跨ぎ状態、全層で共有）
```

**設計原則（仕様より）**

- PuppetFlow は「アニメーション再生」ではなく **状態から振る舞いを生成するモーションランタイム**。
- 単発の数式だけでなく **時間・履歴・慣性・ランダム性** を第一級で扱う。
- 特に **Smooth / Oscillator / Spring** を最優先（待機モーションの 8 割をカバー）。

---

## 2) 現状とのギャップ

| 領域 | 現状 | 仕様で必要 |
| ---- | ---- | ---------- |
| **フレーム文脈** | `deltaTime` / `time` は Behavior・Graph・Extension に渡されている | 統一 `FrameContext`（`frameNumber` 追加） |
| **PFScript** | `sin` / `noise(time)` 等の **無状態** 組み込み関数のみ | `oscillator()` / `spring()` / `smooth()` 等、**id 付き状態保持** |
| **Motion Graph** | `sin` / `noise`（毎フレーム乱数）/ `time` 等 | **Stateful** カテゴリ（Oscillator, Spring, Smooth, Blink…） |
| **Extension Pack** | `ctx.time` + `Math.sin` で毎回計算（位相非保持） | Oscillator / Spring 等を内部利用可能に |
| **Behavior Plugins** | `GazePlugin` / `BlinkPlugin` が **個別に** `phase` / `blinkUntil` を保持 | 将来的に stateful 関数へ置換可能な共通基盤 |
| **Modifiers** | `SmoothingModifier` が **Rendered 全体** を低域通過 | 仕様の `smooth(id, value, speed)` は **信号単位**（共存） |
| **再現性** | Graph `noise` は `Math.random()` | Stateful 乱数は **seed + id** で決定論的に |
| **プラグイン API** | `ExtensionPlugin` のみ | `StatefulNodePlugin` + `StatefulRegistry` |

**既存資産の再利用**

| 資産 | 活用方針 |
| ---- | -------- |
| `BehaviorExecutionContext.deltaTime` / `.time` | `FrameContext` の土台 |
| `MotionGraphContext` | 同一 `FrameContext` + `StatefulStore` を注入 |
| `ExtensionContext` | Pack 内から `StatefulStore` を参照 |
| `evaluateExpression()` / `Call` 評価 | stateful 関数の呼び出し口 |
| `GazePlugin` の phase 更新 | Oscillator / Wander 実装の参考 |
| `BlinkPlugin` のタイマー | Blink Generator 実装の参考 |
| `SmoothingModifier` の指数平滑 | `smooth()` アルゴリズムの参考 |

---

## 3) 設計決定（提案・要 ADR）

| # | 論点 | 提案 |
| - | ---- | ---- |
| D1 | **パッケージ配置** | 新規 `@puppetflow/stateful-core`。Extension / Graph / Behavior から依存 |
| D2 | **パイプライン位置** | 独立パス「Behavior → Stateful → Motion」ではなく、**StatefulStore を Runtime が保持**し各層が同一ストアを更新・参照（PFScript は式評価中、Graph はノード評価中） |
| D3 | **状態のスコープ** | `id` 文字列でグローバル（Runtime インスタンス内）。衝突回避: `{presetName}:{id}` または `{source}:{id}` プレフィックス（Phase 1 は素の `id`、Studio が自動付与） |
| D4 | **Preset への永続化** | **ランタイム状態は Preset に保存しない**。`loadPreset` / `runtime.start()` で **リセット**。任意で `extensions.statefulSeed?: number` を将来追加 |
| D5 | **Oscillator 出力レンジ** | 仕様どおり **-1〜+1**。MotionState 代入前は PFScript / Graph 側でスケール（例: `bodyLean = bodyOsc * 0.1 + 0.5`） |
| D6 | **Cooldown の型** | PFScript 条件式向け **boolean** 返却。Graph では `cooldown` ノード → 0/1 出力 |
| D7 | **既存 Plugin との関係** | Phase 1–3 では **共存**（破壊的変更なし）。Phase 4 で `gaze` / `blink` を stateful ベースへ **段階移行**（オプション） |
| D8 | **Graph サイクル** | Stateful ノードも DAG 内。状態更新はノード `id` に紐づけ、トポロジ順に 1 回評価 |
| D9 | **Scratch ブロック** | Phase 3 以降。高レベルブロック（「呼吸する」「ゆっくり追従する」）は内部で stateful ノード / PFScript を生成 |

---

## 4) コア API（案）

### FrameContext

```ts
interface FrameContext {
  deltaTime: number;
  frameNumber: number;
  elapsedTime: number; // PFScript `time` と同一
}
```

### StatefulStore

```ts
interface StatefulStore {
  reset(): void;
  update<T>(
    id: string,
    fn: StatefulFunction<T>,
    input: unknown,
    frame: FrameContext,
  ): number | boolean;
  peek(id: string): unknown;
}
```

### StatefulFunction

```ts
interface StatefulFunction<TState = unknown> {
  id: string; // 組み込み種別 "oscillator" | "spring" | ...
  createState(config: Record<string, number>): TState;
  update(
    frame: FrameContext,
    state: TState,
    config: Record<string, number>,
    input: number, // 配線入力（spring target, smooth value 等）
  ): { value: number | boolean; state: TState };
}
```

### StatefulRegistry / Plugin

```ts
interface StatefulRegistry {
  registerFunction(def: StatefulFunctionDefinition): void;
}

interface StatefulNodePlugin {
  id: string;
  register(registry: StatefulRegistry): void;
}
```

---

## 5) マイルストーン

| # | 名称 | 目標 | 期間目安 |
| - | ---- | ---- | -------- |
| **M0** | **Infrastructure** | `stateful-core` / `StatefulStore` / Runtime 配線 / `FrameContext` | 1 週 |
| **M1** | **Phase 1 — Smooth + Oscillator** | PFScript + Graph + テスト + 公式サンプル | 1.5〜2 週 |
| **M2** | **Phase 2 — Spring + RandomHold** | 同上 + Motion Pack 内部利用開始 | 1.5〜2 週 |
| **M3** | **Phase 3 — Blink + Breath + Wander + Cooldown** | 同上 + Scratch 高レベルブロック（任意） | 2 週 |
| **M4** | **Phase 4 — Physics プラグイン** | TailPhysics / EarPhysics 等 + 既存 Pack リファクタ | 2〜3 週 |
| **M5** | **Studio & Docs** | Graph「Stateful」カテゴリ / PFScript 補完 / デバッグ UI | 1 週 |

**合計目安: 9〜11 週**（1 人フルタイム相当）

---

## 6) Epics と Issues

### Epic E0 — Stateful Core（`@puppetflow/stateful-core`）

**Objective:** フレーム跨ぎ状態の保存・更新・リセットを担う共通基盤。

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I0-1 | パッケージ雛形 + 型定義 | S | P0 | `FrameContext`, `StatefulFunction`, `StatefulStore` |
| I0-2 | `StatefulStore` 実装 | M | P0 | id ごとに状態作成・更新・`reset()` |
| I0-3 | `StatefulRegistry` + 組み込み登録 | S | P0 | `registerFunction()` / `getFunction()` |
| I0-4 | Runtime 統合 | M | P0 | `PuppetFlowRuntime` が store を保持、`loadPreset` で reset |
| I0-5 | 単体テスト | M | P0 | 連続フレーム更新・reset・id 分離 |

**Deliverables:** `packages/stateful-core/src/*`

---

### Epic E1 — Phase 1: Smooth + Oscillator

**Objective:** 最重要 2 関数を PFScript / Graph から使えるようにする。

#### Smooth

| 属性 | 内容 |
| ---- | ---- |
| PFScript | `smooth(id = "interest", value = interest, speed = 2.0)` |
| 内部 | 指数平滑（`SmoothingModifier` と同系、`speed` で時定数制御） |
| Graph | 入力 1（value）+ `id`, `speed` 設定 |

#### Oscillator

| 属性 | 内容 |
| ---- | ---- |
| PFScript | `bodyOsc = oscillator(id = "body", frequency = 0.5)` |
| 内部 | `phase += frequency * deltaTime * 2π`、`sin(phase)` → **-1〜+1** |
| 特徴 | **周波数変更しても位相維持** |
| Graph | 出力ノード、設定 `id`, `frequency`, `amplitude?` |

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I1-1 | `smooth` 実装 + テスト | M | P0 | ステップ入力で漸近、speed 変更で応答変化 |
| I1-2 | `oscillator` 実装 + テスト | M | P0 | 連続 sin 出力、frequency 変更後も位相連続 |
| I1-3 | PFScript `Call` 拡張 | M | P0 | named args（`id=`）付き stateful 呼び出し |
| I1-4 | Graph ノード `smooth` / `oscillator` | M | P0 | `executeMotionGraph` + editor bridge |
| I1-5 | Studio Graph「Stateful」カテゴリ | S | P1 | パレット追加、config UI |
| I1-6 | 公式サンプル | S | P1 | `examples/pfscript/breathing.pfscript` 等 |

---

### Epic E2 — Phase 2: Spring + RandomHold

#### Spring

| 属性 | 内容 |
| ---- | ---- |
| PFScript | `earAngle = spring(id = "ear", target = interest)` |
| 状態 | `position`, `velocity` |
| Graph | target 入力 + `id`, `stiffness`, `damping` |

#### RandomHold

| 属性 | 内容 |
| ---- | ---- |
| PFScript | `lookX = randomHold(id = "look", interval = 3.0, min = -0.3, max = 0.3)` |
| 状態 | `currentValue`, `nextChangeAt` |
| 乱数 | `StatefulStore` seed ベース（再現可能） |

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I2-1 | `spring` 実装 + テスト | L | P0 | ターゲット追従・減衰・オーバーシュート |
| I2-2 | `randomHold` 実装 + テスト | M | P0 | interval ごとに値更新、min/max 内 |
| I2-3 | PFScript / Graph 統合 | M | P0 | Phase 1 と同パターン |
| I2-4 | Motion Pack リファクタ（thinking / lookAround） | M | P1 | 内部 sin を Oscillator + Spring に置換（任意） |

---

### Epic E3 — Phase 3: Blink + Breath + Wander + Cooldown

| 関数 | 出力 | 要点 |
| ---- | ---- | ---- |
| `blink(id, averageInterval)` | 0〜1 | ランダム間隔 + 閉眼カーブ |
| `breath(id, rate)` | 0〜1 | sin より自然な呼吸波形（非対称 ease） |
| `wander(id, speed)` | -1〜+1 | 1D Perlin / 平滑ノイズ、Gaze 代替候補 |
| `cooldown(id, duration)` | boolean | 再入禁止タイマー、`if cooldown(...) then` |

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I3-1 | `blink` + `breath` | L | P0 | 目・胸の待機モーションとして視覚確認 |
| I3-2 | `wander` | M | P0 | 連続フレームで滑らか、決定論的 |
| I3-3 | `cooldown` | S | P0 | duration 中 false、経過後 true |
| I3-4 | PFScript / Graph / Studio | M | P0 | 全関数を UI から利用可能 |
| I3-5 | Scratch 高レvel ブロック（任意） | M | P2 | 「一定間隔で瞬き」→ blink ノード生成 |

---

### Epic E4 — Phase 4: Physics プラグイン + Pack 統合

**Objective:** 尻尾・耳・髪等を `StatefulNodePlugin` として拡張。

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I4-1 | `StatefulNodePlugin` 公開 API | S | P0 | `extension-bundled` と同様の登録 |
| I4-2 | `TailPhysics` / `EarPhysics` サンプル | L | P1 | Spring チェーン or 単 Spring |
| I4-3 | `plugin-tail` / `plugin-animal-ears` 内部刷新 | M | P1 | 位相維持・慣性付き |
| I4-4 | `gaze` / `blink` behaviorPlugin 移行検討 | L | P2 | 設定互換 or deprecation 告知 |

---

### Epic E5 — Studio / デバッグ / ドキュメント

| ID | Issue | Size | Priority | 受け入れ条件 |
| -- | ----- | ---- | -------- | ------------ |
| I5-1 | Pipeline デバッグ: stateful 状態一覧（Expert） | M | P2 | id / 現在値 / 内部 state JSON |
| I5-2 | `docs/reference/stateful.md` | M | P0 | API・出力レンジ・既存 Plugin との関係 |
| I5-3 | `pfscript.md` 更新 | S | P0 | stateful 関数リファレンス |
| I5-4 | `behavior-and-graph.md` 更新 | S | P0 | パイプライン図・ノード一覧 |
| I5-5 | ADR: Stateful vs Modifier vs Plugin | S | P0 | D7 確定 |

---

## 7) 層別統合詳細

### 7.1 Runtime（`packages/runtime`）

```ts
// tick() 内（概略）
const frame: FrameContext = {
  deltaTime,
  frameNumber: this.frameNumber++,
  elapsedTime: this.elapsedTime,
};

// behavior
executeBehaviorWithInvocations(root, {
  ...ctx,
  time: frame.elapsedTime,
  statefulStore: this.statefulStore,
  frame,
});

// graph
executeMotionGraph(graph, {
  ...ctx,
  time: frame.elapsedTime,
  statefulStore: this.statefulStore,
  frame,
});
```

`loadPreset()` / `stop()` → `statefulStore.reset()`

### 7.2 PFScript / Behavior（`packages/behavior` + `pfscript-core`）

1. **Parser**: 既存 `Call` 構文をそのまま利用（`oscillator(id = "body", frequency = 0.5)`）
2. **evaluateCall**: 評価順序  
   `stateful registry` → `PFSCRIPT_BUILTIN_FUNCTIONS` → `extension function`
3. **Identifier**: `deltaTime` を `resolveNumericIdentifier` に追加
4. **禁止**: stateful 関数のネスト代入状態変数（Phase 1 は `id` で暗黙状態のみ）

### 7.3 Motion Graph（`packages/motion-graph`）

| type | 入力 | data |
| ---- | ---- | ---- |
| `oscillator` | — | `id`, `frequency`, `amplitude?` |
| `smooth` | value | `id`, `speed` |
| `spring` | target | `id`, `stiffness?`, `damping?` |
| `randomHold` | — | `id`, `interval`, `min`, `max` |
| `wander` | — | `id`, `speed` |
| `blink` | — | `id`, `averageInterval` |
| `breath` | — | `id`, `rate` |
| `cooldown` | — | `id`, `duration` |

`evaluateNode` の `default` 分支前に stateful 分岐。`output` ノードへの配線は既存と同じ。

### 7.4 Extension Layer（`packages/extension-core`）

- `ExtensionContext` に `statefulStore: StatefulStore` を追加
- Pack `execute()` 内例:

```ts
const wag = ctx.statefulStore.update("tailWag", oscillatorFn, { frequency: 2 + intensity }, frame);
return { custom: { tailWag: wag * 0.5 + 0.5 } };
```

### 7.5 Studio

| UI | 変更 |
| -- | ---- |
| Graph Editor | カテゴリ **Stateful**、ノード定義を registry から列挙 |
| PFScript Editor | stateful 関数の補完（将来） |
| Pipeline（Expert） | 任意: アクティブ stateful id の現在値表示 |
| Scratch | Phase 3: 高レベルブロック → stateful 生成 |

---

## 8) テスト戦略

| レイヤ | 方針 |
| ------ | ---- |
| `stateful-core` | 各関数の **フレームシミュレーション**（100+ フレーム、スナップショット数点） |
| 決定論性 | 同一 seed + 同一 deltaTime 列 → 同一出力 |
| 位相連続性 | Oscillator: frequency 変更前後で sin 波形が途切れない |
| Spring | ターゲットステップ応答・減衰比 |
| Integration | `runtime.test.ts`: PFScript + Graph 経由で `bodyLean` が呼吸する |
| Regression | 既存 Preset（Curious / Thinking）の出力が **大きく変わらない**（Plugin 共存時） |

---

## 9) リスクと緩和

| リスク | 影響 | 緩和 |
| ------ | ---- | ---- |
| Oscillator -1〜+1 と clamp01 MotionState の不一致 | 代入時にクリップされ意図とズレ | ドキュメント + サンプルで `* 0.5 + 0.5` パターンを明示 |
| `id` 衝突（PFScript と Graph） | 状態が混線 | Studio が自動プレフィックス、lint 警告 |
| 既存 Gaze / Blink Plugin との二重適用 | 瞬き・視線が強すぎる | Pipeline ドキュメント + Studio で排他ヒント |
| Graph `noise` との混同 | ユーザー混乱 | Stateful カテゴリを分離、RandomHold / Wander を推奨 |
| スコープ肥大 | 延期 | 仕様 Phase 順を厳守。Scratch は P2 |

---

## 10) 推奨着手順（最初の 2 週間）

```text
Week 1
  E0: stateful-core 骨格 + StatefulStore + Runtime reset 配線
  I1-1 / I1-2: smooth + oscillator 実装と単体テスト

Week 2
  I1-3: PFScript から oscillator / smooth 呼び出し
  I1-4: Graph ノード 2 種
  サンプル preset: 呼吸（bodyLean）+ interest の smooth 追従
  docs/reference/stateful.md ドラフト
```

**完了の Definition of Done（M1）**

- [ ] PFScript で `oscillator` / `smooth` が動作
- [ ] Graph Editor から同一関数が利用可能
- [ ] `pnpm exec vitest run` 全緑
- [ ] Studio Pipeline で `bodyLean` の周期変化が確認できる
- [ ] `loadPreset` で stateful 状態がリセットされる

---

## 11) 参考: 仕様関数一覧（実装チェックリスト）

| 関数 | Phase | PFScript | Graph | Pack 内部 |
| ---- | ----- | -------- | ----- | --------- |
| Smooth | 1 | ✓ | ✓ | ✓ |
| Oscillator | 1 | ✓ | ✓ | ✓ |
| Spring | 2 | ✓ | ✓ | ✓ |
| RandomHold | 2 | ✓ | ✓ | ✓ |
| Blink | 3 | ✓ | ✓ | ✓ |
| Breath | 3 | ✓ | ✓ | ✓ |
| Wander | 3 | ✓ | ✓ | ✓ |
| Cooldown | 3 | ✓ | ✓ | — |
| TailPhysics 等 | 4 | — | ✓ | ✓ |

---

## 12) 関連 ADR（作成予定）

| ADR | 内容 |
| --- | ---- |
| stateful-store-scope | id スコープと reset タイミング |
| stateful-vs-modifier | 信号単位 smooth と SmoothingModifier の使い分け |
| stateful-plugin-migration | gaze/blink Plugin からの移行方針 |
