# MotionFrameGraph Reference

Canonical frame-level graphの v1 文書スキーマと Runtime/パイプライン接続仕様を定義します。既存の `MotionState` 系 Graph とは独立です。

## Schema (version must be 1)

```ts
interface MotionFrameGraph {
  version: 1;
  initialState: string;
  states: MotionFrameGraphStateDefinition[];
  transitions?: MotionFrameGraphTransition[];
}

interface MotionFrameGraphStateDefinition {
  id: string;
  sources?: Record<string, MotionSourcePolicyOverride>;
}

interface MotionSourcePolicyOverride {
  enabled?: boolean;
  priority?: number;
  weight?: number;
}

type MotionGraphSignalValue = string | number | boolean;

type MotionFrameGraphCondition =
  | {
      type: "signal";
      key: string;
      operator: "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte";
      value: MotionGraphSignalValue;
    }
  | { type: "source"; sourceId: string; field: "connected" | "stale"; equals: boolean }
  | { type: "elapsed"; minimumMs: number };

interface MotionFrameGraphTransition {
  from: string;
  to: string;
  when: MotionFrameGraphCondition;
}
```

### 厳密な検証ルール

- `version` は `1` のみ。
- `initialState` は空文字不可、`states` 内の既知 state id であること。
- `states` は空配列不可。`id` 重複は不可。
- `transitions` は `state.id` に対してのみ。
- `weight` は `0` 以上 `1` 以下の有限数。
- `priority` は有限数。
- `minimumMs` は有限かつ `>= 0`。
- `signal key` と `state.id / sourceId` は非空文字。
- `signal value` は `string | number | boolean`、数値は有限数のみ。

`state.sources` のキーはプロパティ名として保存されます。`Object.hasOwnProperty()` ベースの取り扱いを採用しているため、`"__proto__"` を含むソースキーでも独自エントリとして保持され、パースは失敗しません。

`parseMotionFrameGraph()` / `createMotionFrameGraphController()` は入力をクローンして保存するため、実行時の `document` 破壊には影響しません。

## Controller 仕様

```ts
const controller = createMotionFrameGraphController(document, { now: () => clockMs });

controller.setSignal("tracking", true);
const snapshot = controller.evaluate({
  sources: { tracker: { connected: true, stale: false } },
});
snapshot.stateId; // 現在状態
snapshot.enteredAt; // 状態遷移時刻
snapshot.policy; // 次の pipeline に渡す source policy overlay
```

- `setSignal(key, value)`:
  - `key` 空文字列は例外 (`Motion graph signal key must be non-empty`)。
  - 既存値を上書きする。
- `evaluate(context)`:
  - `context.sources` の状態に対して `transitions` を左から順に検査し、`from === 現在state` かつ条件成立のものを**最初の1件だけ**採用。
  - 条件成立しなければ現在状態維持。
  - 条件成立で遷移した場合、`enteredAt` を `now()` へ更新。
- 条件評価:
  - `signal`:
    - 不存在のシグナルは `undefined` で false として扱う。
    - `equals/notEquals` は厳密比較。
    - `gt/gte/lt/lte` は双方が有限数のときのみ比較（片方が非数値なら false）。
  - `source`:
    - `context.sources[sourceId]` が未存在なら false。
    - 指定フィールドが未存在でも false。
  - `elapsed`:
    - `minimumMs <= (now() - enteredAt)` のとき true。
- `snapshot()`:
  - 現在状態の深いクローン。
- `reset()`:
  - `signals` を空にし、状態を `initialState`、`enteredAt` を `now()` に戻す。

## Runtime 連携と overlay semantics

`PuppetFlowRuntime.attachMotionFrameGraph(graph)` は上記 controller を組み込み、`attachMotionPipeline()` と組み合わせることで canonical flow を実行します。

- `setMotionGraphSignal(key, value)` で runtime へシグナルを注入。
- 毎 tick、`dispatchMotionFrames()` で最新フレームから graph を評価。
- `evaluate` の戻り値 `policy` は `MotionLayerPolicy` として pipeline に渡され、既存 layer ルールへ overlay されます。
- `priority` と `weight` は、各キーが与えられた場合のみ既存 layer の同名フィールドを置換します。`enabled` は明示指定時のみ候補可否に適用されます。
- overlay で未指定のフィールドは layer の既定値を維持します。
- layer は immutable 扱いです。pipeline 内で `layerMap` のコピーへ安全に merge され、入力の `layers` を破壊しません。
- `policy[sourceId].enabled === false` は `mixer` 側の候補除外を行います。
- raw adapter 送信（`motionPipeline` 未接続時）は `enabled` フィルタのみで除外し、`priority`/`weight` は無視されます。

## Runtime API / fail-safe / stop reset

- `configureMotionFailSafe(options)`:
  - `timeoutMs`、`action` (`hold-last-frame` / `blend-to-neutral` / `disable-source`)、`transitionMs?`。
  - `applyMotionFailSafe()` は受信時刻からの age で判定。
  - タイムアウト未満: フレームをそのまま複製して配送。
- stop 挙動:
  - `stop()` が呼ばれた時点で `tickInProgress` なら最大 200 回スピンし、超えると警告を出して destroy をスキップ。
  - タイムアウト経路でも graph は `reset()` され、`getMotionFrameGraphState()` は idle / リセット済み policy を返す。
  - 正常終了時は source の latest frame も clear し、graph/inspect/health を初期化。
- `getMotionFrameGraphState()` は snapshot の defensive clone を返す。
- Graph 評価例外は `PuppetFlowRuntime` で catch され、`evaluate` が失敗しても pipeline は従来経路（policy undefined）で進行する（fail-open）。

## 既知 source / 評価境界

- `state.sources` には任意 source id を含められる（`""` は不可）。
- `evaluate` 時の `context.sources` は runtime が保持する接続済み `motionSource` から組み立てるため、定義されていない id は既定 false。
- `source` 条件の missing field は false。
- 評価は runtime 上の接続/health 状態を読んだのみで、frame 内 `timestamp` ではなく受信時刻ベースで fail-safe を判定。

## 運用互換・移行

- 既存の `MotionState` パイプライン、既存 preset / behavior / adapter 互換 API に変更はありません。
- 新規導入は `MotionFrameGraph` を明示的に attach した Runtime のみが有効で、既存設定はそのまま実行可能です。`Migration` は不要です。
