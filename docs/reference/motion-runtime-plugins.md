# Motion Runtime Plugin API

`@puppetflow/extension-core` の MotionRuntime プラグイン API は、`MotionSource` /
`MotionFrameFilter` / `MotionFrameAdapter` を既存の Runtime API に接続するための
工場（factory）レジストリです。既存の `MotionState` ベースの
`ExtensionPlugin` とは別です。

```ts
import {
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "@puppetflow/extension-core";
import { PuppetFlowRuntime } from "@puppetflow/runtime";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";
```

## 型定義

```ts
export type MotionRuntimeFactoryConfig = Readonly<Record<string, unknown>>;

export interface MotionSourceFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionSource;
}

export interface MotionFilterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameFilter;
}

export interface MotionFrameAdapterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameAdapter;
}

export interface MotionRuntimePlugin {
  id: string;
  register(registry: MotionRuntimeRegistry): void;
}
```

## API 呼び出しフロー

```text
registerMotionRuntimePlugins()  ->  registry.createSource()
                                -> runtime.attachMotionSource()
                                -> runtime.start()

registerMotionRuntimePlugins()  ->  registry.createFilter()
                                -> createMotionFramePipeline({ sourceFilters/outputFilters })
                                -> runtime.attachMotionPipeline()

registerMotionRuntimePlugins()  ->  registry.createFrameAdapter()
                                -> runtime.attachMotionAdapter()
```

| 製品                        | 作成 API                           | 接続先                                                       |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `MotionSourceFactory`       | `createSource(type, config)`       | `runtime.attachMotionSource()`                               |
| `MotionFilterFactory`       | `createFilter(type, config)`       | `createMotionFramePipeline({ sourceFilters/outputFilters })` |
| `MotionFrameAdapterFactory` | `createFrameAdapter(type, config)` | `runtime.attachMotionAdapter()`                              |

## 重複ルール

- `registerMotionRuntimePlugins()` は `id` を trim して検証し、空文字・重複 `id` は事前エラー
  (`Motion runtime plugin id must be non-empty` / `already registered`) で登録を拒否します。
- `addSourceFactory` / `addFilterFactory` / `addFrameAdapterFactory` は各 capability 毎に
  `type` の trim 文字列をキーに重複を拒否します。
- 同じ `type` は capability 間で同時利用可能です。
  例: `source` の `vmc` と `filter` の `vmc` と `frame adapter` の `vmc` は共存できます。
- `registerMotionRuntimePlugins()` はまずプラグイン ID を事前検査し、重複があると
  どの `register()` も実行しません。

## 設定の所有権

各 `create()` は `MotionRuntimeFactoryConfig` を受け取ります。
スキーマの検証・必須項目の既定値・型チェックはプラグイン側の責務です。

`Runtime` は設定を解釈しません。`create*` への引数だけを受け取ります。

```ts
registry.addSourceFactory({
  type: "synthetic",
  create: (config) => {
    const timestamp = typeof config.timestamp === "number" ? config.timestamp : 0;
    return {
      id: "synthetic",
      start: async (emit) => emit({ timestamp }),
      stop: async () => {},
    };
  },
});
```

## エラー伝播

- `registerMotionRuntimePlugins()`:
  - 空/重複プラグイン `id`
  - 空/重複 factory `type`
    を同期的に `throw` します。
- `createSource` / `createFilter` / `createFrameAdapter`:
  - 未登録 `type` は `throw` します。
  - Factory の `create` 実装が `throw` した例外は捕まえず返します。
- `Runtime` 側:
  - `MotionSource.start` / `MotionFrameAdapter.initialize` / `updateFrame` などの実行時例外は
    既存の Runtime エラーハンドリングで吸収・ログ出力され、`Runtime` ループは継続されます。

## 作成とライフサイクル

1. `registerMotionRuntimePlugins()` でレジストリを作ります。
2. `create*` で実体を生成します（作成のみ、start/initialize なし）。
3. `runtime.attach*` で既存 API に接続します。
4. `runtime.start()` で初めて `initialize` / `start` が動きます。
5. `runtime.stop()` で `dispose` / `stop` が戻ります。

Factory が返す値は「インスタンス作成」だけを担当し、ライフサイクル管理は
既存の `Runtime` が引き続き担います。

## 実装上の非ゴール

- YAML / CLI からの plugin factory 自動起動は未対応です。
- 新しい Runtime を作る意図はなく、既存 `PuppetFlowRuntime` の API を再利用します。
- Registry は transport（socket / network / HTTP）や CLI パイプラインと併走するための
  代替仕様ではありません。

## 例: factory から Runtime へ接続

```ts
import {
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "@puppetflow/extension-core";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const plugin: MotionRuntimePlugin = {
  id: "motion-runtime-example",
  register(registry) {
    registry.addSourceFactory({
      type: "synthetic",
      create: (config) => ({
        id: "synthetic",
        start: async (emit) =>
          emit({
            timestamp: Number(config.timestamp ?? 1000),
            parameters: { value: 2 },
          }),
        stop: async () => {},
      }),
    });
    registry.addFilterFactory({
      type: "double",
      create: () => ({
        id: "double",
        apply: (frame) => ({
          ...frame,
          parameters: {
            ...frame.parameters,
            value: (frame.parameters?.value ?? 0) * 2,
          },
        }),
        reset: () => {},
      }),
    });
    registry.addFrameAdapterFactory({
      type: "capture",
      create: () => ({
        id: "capture",
        initialize: async () => {},
        updateFrame: async (frame) => {
          console.log(frame.parameters?.value);
        },
        dispose: async () => {},
      }),
    });
  },
};

const registry = registerMotionRuntimePlugins([plugin]);
const runtime = new PuppetFlowRuntime()
  .attachMotionSource(registry.createSource("synthetic", { timestamp: 1000 }))
  .attachMotionPipeline(
    createMotionFramePipeline({
      sourceFilters: {
        synthetic: [registry.createFilter("double", {})],
      },
    }),
  )
  .attachMotionAdapter(registry.createFrameAdapter("capture", {}));
```

上記を `runtime.start()` すれば、`capture` 側で `parameters.value` が `4` になります。
