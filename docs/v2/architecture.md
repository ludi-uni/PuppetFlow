# PuppetFlow 2.0 target architecture

**Status:** Target design; Acting MCP / Control / Node Host path implemented
**Branch:** `v2`
**Principle:** PuppetFlowのmotion実装を残し、外部制御とRuntime ownershipを一本化する。

## Target shape

```text
AI / AITuber → MCP client → Acting MCP → PuppetFlowControl → PuppetFlowRuntime
                                                               │
                                      combined output adapter → Viewer

Application composition root → PuppetFlowHost
                                ├─ owns one Runtime and its lifecycle
                                ├─ exposes that Runtime's Control
                                └─ owns sources and output adapters
```

実装済みの経路は同一プロセスのActing MCPです。`@puppetflow/runtime`の
`createPuppetFlowControl(runtime)`は既存ActingEngineへ委譲し、停止中の操作・観測は
エラーにします。`@puppetflow/runtime-launcher/node`の`createPuppetFlowHost`は
既存`buildRuntime`でRuntimeを一つ生成し、start/stop/disposeを所有します。
ControlにRuntime・store・lifecycle handleは渡しません。

MCPの`hosts/puppetflow-runtime-host.mjs`は公開Host factoryを呼ぶcomposition rootで、
`host.control`だけをtool層へ渡します。従来のsnake_case API・7 toolsを維持し、
独自の演技状態を持ちません。Node HostのVMC出力は旧状態を一時保持し、
Acting frameの骨・表情と合わせて一回送信します。表情は同名の旧blendshapeに優先し、
lip syncは別channelとして保持します。Runtimeの全パイプライン統合は行っていません。

このstandalone起動ではstdin EOF・終了signalでcomposition rootが所有Hostをdisposeします。
MCP adapter単体や他のclientの切断は、注入された他の所有者のRuntimeを停止しません。
Studio・CLI・別processの既存Runtimeへ接続する通信経路は今回追加していません。
同じViewerへの別Studio／旧pf.exe送信は、このstandalone構成と同時に起動しないでください。

`PuppetFlowHost`だけが`PuppetFlowRuntime`を生成・所有・start/stopします。外部clientはRuntime object、store、adapter、socket、tick loopを受け取りません。

## Responsibility boundary

| Layer                          | Owns                                                                                                     | Must not own                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AITuber / caller orchestration | LLM/TTS、utterance、speech playback anchor、speech-relative timing、`WHEN`、semantic `WHAT`              | bone quaternion、VMC packet、character-specific motion math、Runtime lifecycle |
| Studio                         | preset/timeline/semantic controlのUI、状態表示、authoring workflow                                       | Runtime内部storeへの直接アクセス、独自motion scheduler、別semantic contract    |
| AI Agent                       | semantic command selection                                                                               | primitive実装、姿勢計算、VMC                                                   |
| `PuppetFlowControl`            | typed semantic command/query boundary、uniform result、capabilities                                      | transport I/O、骨計算、adapter socket、LLM/TTS                                 |
| `PuppetFlowHost`               | Runtime construction、preset/config、lifecycle、Control implementation、adapter/source attachment        | callerのspeech timing、MCP tool semantics                                      |
| `PuppetFlowRuntime`            | State/Channel/TimelineからRendered Motion、Acting/Expression、PFScript、Graph、Pipeline、output dispatch | HTTP/MCP protocol、client process management                                   |
| adapters                       | protocol translationと外部I/O                                                                            | motion logic、Runtime ownership、semantic validationの複製                     |

## `PuppetFlowControl` contract

現在の実型は既存`ActingRuntimeApi`を継承する`PuppetFlowControl`です。以下は将来の拡張案であり、今回の実装APIではありません。`applyInput`・capabilities・全client移行は未実装です。

```ts
interface PuppetFlowControl {
  act(request: ActRequest): ControlCommandResult;
  sequence(request: SequenceRequest): ControlCommandResult;
  interrupt(): ControlCommandResult;

  setExpression(request: SetExpressionRequest): ControlCommandResult;
  clearExpression(request?: ClearExpressionRequest): ControlCommandResult;

  // State / Channel / Timeline入力。direct motion/bone入力は含めない。
  applyInput(patch: ControlInputPatch): ControlCommandResult;

  getState(): PuppetFlowControlState;
  getCapabilities(): PuppetFlowCapabilities;
}
```

`ControlInputPatch`の初期対象は`state`、`channels`、`timeline`だけです。現行`source-core`の`motion` direct override、bone quaternion、OSC/VMC payloadはControl contractへ持ち込みません。必要性が残る場合は、motion logicをbypassしない明確なRuntime機能として別途設計します。

### Contract rules

1. **Semanticは一つ:** HTTP、IPC、MCP、Studio facadeは同じrequest/result DTOを使う。transport固有のaction list、range、成功判定を持たない。
2. **Validationは一つ:** adapterはJSON shape、required field、有限値などtransport boundaryの形だけを検査する。action availability、duration、blend、expression mapping、preset policyはHost/Runtimeで一度だけ検査する。
3. **Non-blocking:** `act`/`sequence`/expressionは受付結果を返し、完了まで待たない。再生完了やspeech lifecycleはcallerとRuntimeの責務を混ぜない。
4. **Stateはsnapshot:** `getState()`はacting/expression、lifecycle、preset、timeline/output healthなどの読み取り用snapshotを返す。内部storeを返さない。
5. **CapabilitiesはHost source of truth:** action/expression、timeline、frame output、available adapters等はHostが実構成から返す。MCPやHTTPにハードコードしない。
6. **No transport privilege:** 「MCPだけできる」「HTTPだけできる」「Studioだけ直接できる」semantic operationを増やさない。

`look_at`のような便利な名前は、2.0のcanonical contractに含めるか、すべてのadapterで同じaliasとして生成する場合だけ残します。MCPだけが`look_at`を持ち、HTTP/Studioが別の表現を持つ状態は最終形にしません。

## Host ownership

`PuppetFlowHost`の内部責務は次の一つのcompositionです。

```text
PuppetFlowHost
  ├─ one PuppetFlowRuntime
  ├─ loaded preset / configuration
  ├─ ActingEngine / Expression profile
  ├─ input sources
  ├─ motion pipeline and output adapters
  ├─ lifecycle and cleanup
  └─ PuppetFlowControl implementation
```

Hostは`@puppetflow/runtime`の既存lifecycleを使い、別のtick loopやservice meshを作りません。現行`runtime-launcher`はHost内部bootstrapへ寄せます。CLI、Studio、MCP host moduleは、同一Host processを起動するか、Hostが提供するControl endpointへ接続します。

### Runtime execution order

2.0で標準にする実行順は次です。

```text
input sources / Control input
  → State / Channel / Timeline
  → behavior plugins
  → PFScript / Behavior
  → Motion Graph
  → target/rendered semantic motion
  → Acting / Expression frame layer
  → MotionFrame Mixer / filters / retarget
  → adapters
  → VMC / other outputs
```

既存の各段階の計算を全面rewriteしません。Phase B/Cで「どの段階がMotionStateを返し、どの段階がMotionFrameを返すか」を実装前に固定し、legacy adapter先行出力とframe adapter後出力が同じtickで競合しないようにします。

## Protocol adapter policy

### HTTP

HTTPは`PuppetFlowControl`を呼び出すserver/client wrapperです。`@puppetflow/source-http`のpollingは入力sourceとして残りますが、Control APIとは別物です。現行`BehaviorHttpServer`はmicro-behaviorのlegacy入口、AITuberの`ActingRuntimeClient`は設定された外部acting endpointのclientとして存在します。これらをControl移行後に同じDTOへ統合し、不要な個別endpointは削除します。

### MCP

MCPはAI Agent向けthin adapterです。

```text
MCP tool
  → transport shape validation
  → PuppetFlowControl method
  → uniform result serialization
```

MCPに置かないもの:

- motion primitive、quaternion、scheduler、blend
- `PuppetFlowRuntime`の生成・所有
- VMC socket/OSC encoding
- character-specific bone/profile math
- Runtimeと重複するsemantic validation

現在の`PuppetFlow_Acting_MCP/src`はこの形に近いので再利用します。一方、`hosts/puppetflow-runtime-host.mjs`はMCP実装ではなくHost実装へ移す対象です。Phase 1ではsibling repositoryを削除・archiveしません。

## AITuber integration boundary

```text
AITuber decides: WHEN / WHAT
  ActingSession
    - utterance lifecycle
    - actual playback anchor
    - start / early / middle / late / end
    - semantic action/expression request

PuppetFlow decides: HOW TO MOVE
  PuppetFlowControl → Host → Runtime
    - action availability and validation
    - scheduling / blending
    - MotionFrame / bone pose generation
    - expression mapping
    - VMC adapter output
```

AITuberの`ActingSession`はKEEPします。`ActingTransport`はControl clientへ整理します。現在のold `pf.exe` supervisorとMCP host moduleが別々のRuntime/outputを起動できる問題は、Host移行後に一つのownership pathへ収束させます。speech、TTS、audio playback、anchor calculationをPuppetFlowへ移しません。

## Studio 2.0 direction

StudioはControl clientとしてRuntime状態を表示・操作します。UIの候補は次です。

```text
Simple    Preset + semantic controls
Timeline  visual motion / timeline composition
PFScript  advanced / developer control
```

既存Graph、Preset、Mapper、Pipeline、Actingの知見は維持します。Blockly Block Editorは現状のBehavior AST変換器をすぐ削除せず、coreではなくoptional editor/plugin candidateとして隔離します。Phase 1ではUI rewriteも物理削除もしません。

## Explicit non-goals

- generic distributed actor framework、message bus、service mesh
- event sourcing、複数RPC standardの同時導入
- MCP専用plugin framework
- 全packageのrename、全presetのrewrite
- production deploy、AITuber本番切替、v2 tag
