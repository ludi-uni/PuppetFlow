# PuppetFlow 2.0 migration plan

**Scope:** `PuppetFlow`の既存実装を保持しながら、`v2` branchで責務境界を段階的に切り替える。
**Current status:** Phase B完了。Phase CはNode Host内のone-Runtime ownershipとcanonical Control公開まで完了。Phase 4AでStudio Acting/Expressionをcanonical Controlへ移行し、Phase 4BでUI/hook/editor utilityから生Runtime取得口を除去した。Studio Runtime ownership、共有Host接続、CLI、AITuber、MCP Phase F全体は未完了。

ローカル再現はPuppetFlowで`pnpm --filter '@puppetflow/runtime-launcher...' build`、
隣接`PuppetFlow_Acting_MCP`で`pnpm install --frozen-lockfile`と`pnpm build`を実行し、
`PUPPETFLOW_ROOT`をこのcheckoutへ設定します。既存の
`node dist/main.js --host-module hosts/puppetflow-runtime-host.mjs`をMCP clientから起動します。
MCPは公開Host exportを解決し、古いbuildにHostがなければ起動を失敗させます。
`pnpm test:integration`は実entrypointからControl・Runtime・UDP capture・終了を検証します。
Viewer目視は別の受入項目です。

## Migration principles

1. `main`はPuppetFlow 1.xのstable/maintenanceとして変更しない。2.0のbreaking changeは`v2`で行う。
2. 既存のMotionFrame、Acting、Expression、PFScript、Preset、Motion Pipeline、VMC encoderは、同じ挙動を新しいownershipへ接続できるかを先に確認する。
3. 互換layerは「2.0完成後にも維持価値がある」ものだけ残す。テストが壊れることだけを理由にlegacy architectureを温存しない。
4. ただし移行途中のspeech、lip-sync、VMC visible acceptanceを壊さない。各段階でold/new senderが同時に動かないことを確認する。
5. 外部clientからRuntime内部を直接見えなくする。Control DTO、Host lifecycle、Runtime internalsを明確に分ける。

## Phases

| Phase | 内容                                     | 主な成果物                                                                                       | Exit gate                                                                                                     |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **A** | Architecture + inventory                 | `docs/v2/inventory.md`, `architecture.md`, `migration.md`、分類とownership決定                   | Runtime owner、Control boundary、AITuber timing、MCP責務が文書上で一意になる。                                |
| **B** | PuppetFlowControl contract               | `@puppetflow/control`のDTO、uniform result/error、capabilities、focused tests                    | **完了:** HTTP/MCP/Studioが共有できる型があり、direct motion/bone/VMC入力を含まない。                         |
| **C** | PuppetFlow Host ownership                | Host bootstrap、one Runtime、lifecycle、adapter/source attachment、canonical Control             | **Node Host内で完了:** 一つのRuntimeを生成しcanonical Controlだけを公開する。共有実行先へのclient統一は未完。 |
| **D** | Studio → Control / facade migration      | Acting ControlとStudio内部の設定・入力・snapshot・購読を既存facadeへ集約                         | **内部カプセル化完了:** UI/hook/utilityはRuntime/store/engineを取得しない。Runtime ownershipはStudioに残る。  |
| **E** | AITuber → Control transport migration    | `ActingSession`を維持し、ActingTransportをControl client化。speech anchor/timingを維持           | semantic action/expressionだけが送られ、bone/VMCは送られない。旧supervisorと新Hostが二重送信しない。          |
| **F** | MCP thin adapter化                       | sibling logicを`apps/mcp`またはworkspace packageへ段階的に統合、host moduleからRuntime生成を除去 | MCPはshape validation → Control call → result serializationだけ。capabilitiesはHostから取得する。             |
| **G** | legacy transport / duplicate API cleanup | 旧Behavior HTTP、重複acting HTTP、旧pf.exe/WS bridgeを受入条件に沿って整理                       | 使われているcompatibility pathだけが残り、semantic contractの分岐がない。                                     |
| **H** | Studio 2.0 UX cleanup                    | Simple/Preset、Timeline、PFScript中心。Blocklyをoptional editor/pluginへ隔離                     | Block Editorがcore前提でなく、削除・plugin維持の判断根拠がある。                                              |
| **I** | v2 stabilization                         | contract golden tests、runtime lifecycle、adapter/motion output、docs更新                        | one Host/one Runtime/one semantic Control、Focused checksと必要なlive gateがpass。                            |

## Dependency and sequencing notes

### B before C

Hostを作る前にControl DTOを固定します。ただしControl実装を先に大きく作らず、Runtimeの既存APIを呼ぶ小さなfake/contract testsから始めます。これによりHostが新しい内部frameworkへ膨張するのを防ぎます。

### C before D/E/F

Studio、AITuber、MCPを同時に移行すると、Runtimeの所有者が不明なままprotocolだけが増えます。先にHostが一つのRuntimeと出力を所有する証拠を作り、そのHostへ各clientを順番に接続します。

### D and E are independent clients

Studioはauthoring/state inspection、AITuberはutterance-timed semantic commandです。両方が同じControlを使いますが、AITuberのspeech timingをStudioへ移したり、Studioのeditor stateをAITuberへ持ち込んだりしません。

### F after E contract proof

MCPはAI Agent向けの一adapterです。先にAITuberまたはfake HostでControl semanticsとcapabilitiesを確定し、MCPをsource of truthにしない状態で移行します。

## Compatibility policy

`v2`ではbreaking changesを許可します。次をデフォルトで残しません。

- `PuppetFlowRuntime`を外部clientへ返すこと
- MCP/HTTPごとに異なるaction registry、range、success responseを持つこと
- MCP host moduleがRuntime、ActingEngine、VMCを生成すること
- AITuberのold `pf.exe` supervisorと新Hostが同じviewerへ送信すること
- `source-core`のdirect `motion` overrideをControl semantic APIとして宣伝すること

残す価値がある候補は、1.xの入力source、VMC/Live2D/VRM/WebSocket/Logger adapter、Preset v3、record/replay、既存Action/Expression名です。ただし各候補は2.0のControl/Host契約に接続してから採用を確定します。

## Validation gates

### Contract gate

- 同じrequestをlocal Control、HTTP adapter、MCP adapterで処理した結果のsemantic fieldsが一致する。
- malformed shapeはadapterで拒否し、validだがunsupportedなactionはHost/Runtimeの`command_rejected`になる。
- `getCapabilities()`のaction/expression/output情報が実際のHost構成と一致する。

### Ownership gate

- process/thread構成を含め、Runtime生成箇所がHostに限定される。
- client shutdownはHostのRuntime lifecycleを直接操作せず、Control sessionのcloseとして扱う。
- output adapterはHostが一度だけattachし、VMC portにsenderが一つだけ存在する。

### Motion gate

- Acting primitive、Expression fade、PFScript、Graph、Preset、MotionFrame pipeline、VMC encodingのfocused testsを個別に保持する。
- legacy MotionState pathとcanonical MotionFrame pathを同じtickで意図せず二重送出しない。
- protocol/loopback成功と、VMC receiver/Warudoでのvisible resultを別のacceptance gateとして記録する。

### AITuber gate

- `ActingSession`のactual playback anchorとstart/early/middle/late/endを維持する。
- TTS/audio/lip-syncはActing bridge failureで停止しない。
- semantic payloadにbone quaternion、VMC packet、character-specific mathが無い。

## Major risks and controls

| Risk                            | 影響                                      | Control                                                                                       |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Runtime二重所有                 | VMC競合、状態不一致、停止漏れ             | Phase Cでone Host/one Runtime gate、Phase Eでold supervisorを無効化してから次へ進む。         |
| legacy/frame二重出力            | viewerが後着packetに上書きされる          | adapter registrationとtick orderを明示し、同一senderのfocused integration testを追加する。    |
| Control contractの肥大化        | transport facadeが新しいRuntime APIになる | semantic commandsと必要なinput patchだけを固定し、config/bootstrapをclientの自由APIにしない。 |
| transportごとのvalidation drift | MCPとHTTPで受理範囲が変わる               | Host/Runtimeをvalidation source of truthにし、adapterはshapeだけ検査する。                    |
| AITuber timingの移動            | speechとmotionの同期が崩れる              | `ActingSession`をKEEPし、anchor計算とtiming resolutionを移動しない。                          |
| Preset canonical sourceの破壊   | generated behaviorが再現不能              | `behaviorPfScript`を正本、generated ASTをcacheとして扱い、preset runbookを適用する。          |
| Studio移行の過剰範囲            | editor rewriteがControl設計を隠す         | Dはfacade差し替えに限定し、UX cleanupはHへ延期する。                                          |
| sibling MCPの境界誤認           | MCPが本体化する                           | host moduleをHost移行対象として分類し、MCP本体はprotocol adapterだけにする。                  |

## Recommended first implementation step after Phase 1

`@puppetflow/control`相当の小さなcontract packageを追加し、既存`ActingApi`のsemantic surfaceをDTO化したfocused testsを先に作ることです。最初の実装ではRuntime移動、HTTP listener、MCP移植、Studio変更を同時に行わず、次だけを固定します。

```text
ActRequest / SequenceRequest
SetExpressionRequest / ClearExpressionRequest
ControlCommandResult
PuppetFlowControlState
PuppetFlowCapabilities
```

Phase 4B後の次のownership境界は、browser-safeなStudio facadeと共有Hostの間で必要なcommand、snapshot、subscription、configuration ownership、reconnect semanticsを決めることです。Node Hostをfrontendへ直接importせず、HTTP/IPC等の方式は別途決定します。Phase FのMCP全体migrationはまだ完了扱いにしません。
