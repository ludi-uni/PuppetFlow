# PuppetFlow 2.0 現行 architecture inventory

**更新状況:** Phase E AITuber shared Host acting/LipSync connection implemented; real shared CLI + actual sessions + fixture playback anchor were accepted through UDP. `/operator/message` real audio playback and external Viewer remain unconfirmed.
**監査日:** 2026-09-05 (JST)
**対象:** `ludi-uni/PuppetFlow` の `v2` branch、および移行境界を確認するための sibling repository

この文書は、既存実装を削除・移動する前の現状監査です。分類は「Phase 1で実際に削除する」という意味ではなく、2.0の最終構造での扱いを示します。

## Audit record

- `v2` は既存ローカル `main` の `97515691ea253689305d22f001c87681a16a5347` を基点に作成した。
- fetch 後の `origin/main` は `0ac2c78c40d9f8cb01462df379b01abd8b42895a`。ローカル `main` は既存コミットを1つ先行しており、`main` と `origin/main` は一致していない。
- このPhaseでは、その既存コミットを `main` へ追加pushせず、`main` 自体も変更しない。
- 作業開始時点の未commit変更（preset関連14ファイル）と未追跡の `docs/superpowers/**` 2ファイルは保持し、今回のcommitには含めない。
- リポジトリの規模は `packages` 40、`apps` 5、`examples` 5。Runtimeの主要実装は `packages/runtime/src`、Studioの主要実装は `apps/studio/src` にある。
- `D:\99.AITuber\PuppetFlow_Acting_MCP` はPhase 3開始時にcleanな`master` / `a525660`で、Hostのcanonical Control化に必要なthin compatibility adapterだけを別commitにする。`D:\99.AITuber\aituber_runtime` はこのPhaseでは変更しない。

## 現行の実行経路

```text
Studio
  └─ apps/studio/src/runtime.ts
       └─ new PuppetFlowRuntime()
            ├─ ActingEngine (Studioがattach)
            ├─ adapters / sources
            └─ runtime lifecycle

CLI
  └─ apps/cli/src/commands/run.ts
       └─ runtime-launcher/buildRuntime()
            └─ new PuppetFlowRuntime()

AITuber legacy path
  └─ avatar-runtime/PuppetFlowSupervisor
       └─ pf.exe run --config puppetflow.yaml

AITuber semantic acting path
  └─ ActingSession
       └─ ActingTransport (HTTP または client-owned stdio MCP)
            └─ PuppetFlow_Acting_MCP host module
                 └─ createPuppetFlowHost()
                      ├─ owns one PuppetFlowRuntime + ActingEngine + VMC
                      └─ exposes canonical Control through a thin MCP adapter
```

MCP経路のRuntime生成・所有はHostへ集約済みです。Studio、CLI、AITuber legacy pathの移行は後続Phaseに残ります。

## Classification table

| 対象                                        | 現行 evidence / 位置                                                        | 現在の責務                                                                                      | 2.0分類                              | 理由・移行判断                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@puppetflow/core`                          | `packages/core/src/motion-state.ts`, `motion-frame.ts`, stores              | `MotionState`、`MotionFrame`、State/Channel/Timelineの型とstore                                 | **KEEP**                             | 既存のprotocol-independentなデータモデルを再利用する。外部clientには直接storeを公開しない。                                                                                       |
| `PuppetFlowRuntime`                         | `packages/runtime/src/runtime.ts`                                           | 60 Hz tick、source、plugin、behavior、graph、extension、modifier、adapter、lifecycleの統合      | **KEEP / REWORK**                    | Motion実行の本体として残す。ただしRuntimeを所有し、attach/lifecycleを外部clientに見せる役割はHostへ移す。                                                                         |
| MotionFrame                                 | `packages/core/src/motion-frame.ts`                                         | 骨・blend shape・parameterを含む正規フレーム                                                    | **KEEP**                             | Acting、Mixer、VMC Bone/Blend出力の共通表現として2.0の基礎にする。                                                                                                                |
| Motion Pipeline / Mixer                     | `packages/motion-pipeline/src/pipeline.ts`, `mixer.ts`                      | frame sourceのfilter、mix、retarget、output filter                                              | **KEEP / REWORK**                    | 既存のcanonical pathを再利用する。現状はlegacy MotionState pathに対してopt-inなので、2.0ではRuntimeの標準出力spineにする。                                                        |
| Motion Graph                                | `packages/motion-graph/src/execute.ts`, `frame-graph-controller.ts`         | 数値変換、stateful node、frame source policy                                                    | **KEEP**                             | graphは純粋なmotion計算として維持する。Editor bridgeやsource policyの外部公開はHost/Studio境界の内側に置く。                                                                      |
| ActingEngine / Scheduler                    | `packages/runtime/src/acting/engine.ts`, `scheduler.ts`, `primitives.ts`    | semantic actionを骨rotation offsetへ変換、queue、blend、frame生成                               | **KEEP / REWORK**                    | ここが「HOW TO MOVE」のRuntime実装。現在の任意attachとlegacy adapter先行出力を整理し、canonical frame layerとして実行する。                                                       |
| ExpressionEngine                            | `packages/runtime/src/acting/expression-engine.ts`, `expression-profile.ts` | expressionの名前解決、fade、blend shape値生成                                                   | **KEEP / REWORK**                    | expression timing/mappingはRuntime側に残す。ControlはcamelCaseのsemantic DTOから呼び、transportごとのvalidationを持たせない。                                                     |
| Behavior / PFScript                         | `packages/behavior/src`, `packages/pfscript-core/src`                       | DSL parse/lower/execute、条件、stateful call、MotionPack invocation                             | **KEEP**                             | PFScriptは高度なmotion authoringとして維持し、外部clientが直接実行するAPIにはしない。                                                                                             |
| Preset system                               | `packages/preset/src`, `packages/behavior-packs`                            | Preset v3 parse/load、`behaviorPfScript` materialization、overlap warning、plugin/extension構成 | **KEEP / REWORK**                    | `behaviorPfScript`正本、v3、公式preset資産は維持。load/config ownershipをHostへ集約する。新v4はPhase 1の対象外。                                                                  |
| Studio                                      | `apps/studio/src/runtime.ts`と各hook/editor utility                         | Runtime生成、lifecycle、入力、観測、preset編集、mapper、Acting UI                               | **KEEP / REWORK / PARTIAL**          | UI/hook/utilityからRuntime取得口を除去し、入力・設定・snapshot・購読をfacadeへ集約済み。Studio自身のRuntime ownershipと共有Host接続は後続Phase。                                  |
| CLI                                         | `apps/cli/src/commands/run.ts`, `record.ts`, `replay.ts`                    | headless起動、record/replay、VMC/source設定                                                     | **KEEP / REWORK**                    | ユーザー向けCLIは維持する。通常の実行はHostのbootstrapにし、record/replayも同じownership規則に寄せる。                                                                            |
| `runtime-launcher`                          | `packages/runtime-launcher/src/puppetflow-host.ts`, `build-runtime.ts`      | Hostが一つのRuntime、source/output、lifecycleを所有しcanonical Controlを公開                    | **REWORK / IMPLEMENTED**             | Host public contractはControlとstart/stop/disposeだけ。Studio/CLIなど既存`buildRuntime` consumerの移行は後続Phase。                                                               |
| VMC adapters                                | `packages/adapter-vmc/src`                                                  | MotionState/FrameをOSC/VMCへencode、mapping、UDP/Tauri transport                                | **KEEP / REWORK**                    | encoder、mapping、testsは再利用する。HostがVMC senderを所有し、legacyとframeの二重送出を解消する。                                                                                |
| その他 adapters                             | `adapter-live2d`, `adapter-vrm`, `adapter-websocket`, `adapter-logger`      | Rendered Motion / frameの外部出力、debug                                                        | **KEEP**                             | 出力protocol adapterとして残す。Control commandを実装する場所にはしない。                                                                                                         |
| Source adapters                             | `source-http`, `source-websocket`, `source-mqtt`, `source-discord`          | 外部入力をState/Channel/Timelineへ適用                                                          | **KEEP / REWORK**                    | input sourceとして残す。Hostがattachを所有し、Controlのsemantic commandと混同しない。                                                                                             |
| Plugin system                               | `extension-core`, `extension-bundled`, `plugin-*`                           | Behavior plugin、Motion Pack、generator、runtime registry                                       | **KEEP / REWORK**                    | Runtime extension pointとして維持する。公式 `blink`/`idle` はKEEP、legacy `gaze`/`attention`/`emotion`は既定pathから外し、将来の整理対象とする。MCP用plugin frameworkは作らない。 |
| Micro behavior                              | `packages/micro-behavior/src`, `http-server.ts`                             | 短いkeyframe動作、queue/cooldown、現在は専用HTTP APIも提供                                      | **KEEP / REWORK**                    | 実装は再利用候補。request入口をControlへ統合し、専用HTTPが別semantic contractになる状態とAITuber側の重複engineを整理する。                                                        |
| HTTP control                                | `micro-behavior/http-server.ts`、AITuber `ActingRuntimeClient`              | 現在はmicro-behavior HTTPと別形式のacting HTTPが存在。`source-http`は入力polling                | **REWORK**                           | HTTPはControlを包むadapterにする。`source-http`をcontrol APIと呼ばない。旧個別endpointは受入後に必要性を再評価する。                                                              |
| MCP integration                             | sibling `PuppetFlow_Acting_MCP/src`                                         | MCP schema、tool handler、safe result、stdio protocol                                           | **KEEP / REWORK**                    | thin adapterとして保持し、共有Control contractへ接続する。MCPでsemantic validation・Runtime・VMCを所有しない。                                                                    |
| `PuppetFlow_Acting_MCP` host module         | sibling `hosts/puppetflow-runtime-host.mjs`                                 | 公開Hostを構成しcanonical Controlを既存snake_case tool contractへ変換                           | **REWORK / PARTIAL**                 | Runtime生成はHostへ委譲済み。MCP全体のcanonical contract移行とpackage統合はPhase Fに残る。                                                                                        |
| MCP-owned Runtime                           | sibling host moduleから公開Host factoryを呼び出す                           | composition rootがHost lifecycleを所有し、Runtime objectには触れない                            | **REMOVED FROM MCP**                 | one Runtimeの生成、source/output attachment、cleanupは`PuppetFlowHost`だけが行う。                                                                                                |
| AITuber `ActingSession`                     | `aituber_runtime/apps/avatar-runtime/src/acting/acting-session.ts`          | TTS start/end、実再生anchor、start/early/middle/late/end、utterance cleanup                     | **KEEP**                             | 「WHEN」とcaller orchestrationの責務。PuppetFlowへ移さない。                                                                                                                      |
| AITuber `ActingTransport` / client          | `acting-transport.ts`, `acting-runtime-client.ts`                           | sharedは共通Control client、旧HTTP/MCPは明示compatibility mode                                  | **Phase E shared完了 / legacy KEEP** | sharedではHost世代、timeout、順序、結果不明を共通clientへ委譲し、失敗時にlegacyへfallbackしない。                                                                                 |
| AITuber legacy supervisor / WS state bridge | `puppetflow/supervisor.ts`, `puppetflow/ws-server.ts`                       | sharedではsupervisorを抑止。WSは既存LipSync入力の配信口として使用                               | **REWORK → DELETE候補**              | shared Hostは専用LipSync Sourceでmouth値だけを購読する。Mood/Micro Behavior/Shorts等の全面共有化と旧経路削除は未完了。                                                            |
| Block Editor (Blockly)                      | `apps/studio/src/scratch`, `ScratchEditor`                                  | BlocklyをBehavior ASTへ変換                                                                     | **PLUGIN candidate / REWORK**        | 動く実装と変換器は保存するが、2.0 core requirementにはしない。Simple/Preset、Timeline、PFScriptを主軸にし、必要なら任意editor pluginとして隔離する。                              |
| `PuppetFlowControl`                         | `packages/control`にcanonical contractを実装                                | Acting/Expressionの外部semantic control boundaryとRuntime availability判定                      | **NEW / IMPLEMENTED**                | camelCase DTO、safe result、停止中empty state、開始前capabilitiesを提供する。Runtime lifecycleは所有しない。                                                                      |
| `PuppetFlowHost`                            | `packages/runtime-launcher/src/puppetflow-host.ts`                          | one Runtime、canonical Control、adapters、sources、lifecycleの所有                              | **NEW / IMPLEMENTED**                | public APIはcanonical Controlとstart/stop/disposeだけ。Runtime内部objectは公開しない。                                                                                            |
| Shared Control HTTP / client                | `runtime-launcher/control-http-server`, `@puppetflow/control-client`        | loopback auth、instance identity、canonical command/state通信                                   | **NEW / IMPLEMENTED**                | Studio shared modeとMCP shared adapterが同じHostへ接続。全Studio設定APIの共有化は未実装。                                                                                         |
| Shared CLI VMC output                       | `PuppetFlowHost` launchConfig VMC composition                               | MotionState mappingとActing/Expression frameを一回合成してUDP送信                               | **IMPLEMENTED / ACCEPTED**           | Expressionが同名基底値に優先。口等の非Expression値を保持し、clear後はzero送信から基底値へ復帰する。                                                                               |

## Sibling MCPの責務分解

`PuppetFlow_Acting_MCP` は削除せず、現在の実装を次のように分解します。

| 分類                      | 現状                                                               | 2.0方針                                                                                     |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| MCP-specific logic        | `src/server.ts`, `tools.ts`, `schemas.ts`, `results.ts`, stdio起動 | **KEEP**。本体側の`apps/mcp`またはworkspace packageへ移せるthin adapter。                   |
| PuppetFlow Host ownership | `hosts/puppetflow-runtime-host.mjs`が担当している                  | **REWORK**。HostをPuppetFlow本体側へ移し、MCPから分離する。                                 |
| Runtime creation          | host moduleが`PuppetFlowRuntime`/`ActingEngine`を生成              | **DELETE from MCP**。MCP processはRuntimeを生成しない。                                     |
| protocol translation      | MCP入力、`look_at` alias、結果serialization                        | **KEEP / REWORK**。shared Control DTOへ1回だけ変換し、transport固有のsemanticを増やさない。 |
| semantic validation       | MCPはshape/finite値を検査し、action rangeはRuntimeへ委譲           | **REWORK**。shape以外はHost/Runtimeをsource of truthにする。                                |
| motion logic              | quaternion、scheduler、VMC encoderはMCP本体には無い                | **DELETE from MCP**。今後も追加しない。                                                     |

## AITuber側の責務分解

- `ActingSession`はTTS start/end、実再生anchor、speech-relative offset、stale utterance cleanupを持つため **KEEP**。
- `ActingTransport` / `ActingRuntimeClient`はsemantic payloadだけを送るため、実装を **REWORK** してControl clientにする。
- `PuppetFlowSupervisor`の`pf.exe` spawn、`PuppetFlowWsServer`の独自mood/effect/lip-sync stateは、Host/Control移行後に重複範囲を検証して **DELETE候補** とする。Phase 1では外部repoを変更しない。

## 主要な現行所見

### 残すべき資産

- `MotionFrame` のnormalize/clone、Motion PipelineのMixer/filter/retarget、Actingのprimitive/scheduler、Expressionのfade、PFScript、Preset v3、VMC encoder/mappingは、2.0で再利用する価値が明確です。
- Runtimeのlifecycleはstart/stop競合、source polling、adapter cleanupまで既に実装されており、別のlifecycle frameworkを作る必要はありません。
- sibling MCPは、`src/tools.ts` の形状検証・呼び出し・safe resultに責務を絞っており、protocol adapterの素材として再利用できます。

### 先に境界を直すべき箇所

1. Runtimeを直接生成する入口はStudio、CLIなどに残る。Studio内部のRuntimeアクセスはfacadeへ集約済みだが、Runtime ownership自体はまだStudioにある。
2. `PuppetFlowRuntime`がinternal composition APIと外部操作APIを同じpublic classに載せている。
3. legacy `MotionState` adapter pathとcanonical `MotionFrame` pathが併存し、`NodeVmcAdapter`は両interfaceを実装する。`runtime-launcher`は同じadapterを両pathへattachする。
4. `BehaviorHttpServer`、AITuber HTTP client、MCP toolが異なる入口・結果形状を持つ。HTTP input sourceは別責務なのに同じ「HTTP」と呼ばれる。
5. AITuberは正しくspeech-relative timingを所有している一方、old `pf.exe` supervisorとMCP host moduleが別々のPuppetFlow実行主体になり得る。
6. AITuberの`PuppetFlowWsServer`/Micro Behaviorは、PuppetFlowのsemantic motionとは別にmood、effect、lip-sync stateを保持する。これはPhase 1で削除せず、Control移行後に重複範囲を決める。

## Phase 1で行わないこと

- `PuppetFlow_Acting_MCP` の削除・archive
- `aituber_runtime` の変更やproduction migration
- Studio/Blocklyの全面rewrite・物理削除
- package rename、Preset v4、release/tag、main merge
- Runtime/Host/Controlの実装移動
