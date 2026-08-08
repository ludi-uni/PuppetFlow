# MotionFrame

`@puppetflow/core` の `MotionFrame` は、入力元に依存しない 1 フレームの正規形です。

```ts
interface MotionFrame {
  timestamp: number; // milliseconds; source-relative unless metadata.clock is "unix"
  sequence?: number;
  bones?: Record<
    string,
    {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number; w: number };
      scale?: { x: number; y: number; z: number };
      confidence?: number;
    }
  >;
  blendShapes?: Record<string, number>;
  parameters?: Record<string, number>;
  metadata?: {
    sourceId?: string;
    sourceType?: string;
    coordinateSpace?: "local" | "world";
    clock?: "relative" | "monotonic" | "unix";
    [key: string]: unknown;
  };
}
```

`normalizeMotionFrame()` は有限値を検証し、未知の骨名と partial transform を保持します。`cloneMotionFrame()` は adapter が入力を変更しても source の最新値に影響しないようネストしたレコードを複製します。

Phase 1 の Runtime は Mixer を持たず、source の attachment 順に各 latest frame を frame-capable adapter へ渡します。既存の `MotionState` / `Adapter` path はそのまま利用できます。
