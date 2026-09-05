# PuppetFlow 2.0 target architecture

**Status:** Shared Host Acting/Expression integration implemented for Studio and MCP
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

実装済みの経路は同一プロセスのActing MCPです。
`@puppetflow/runtime-launcher/node`の`createPuppetFlowHost`は既存`buildRuntime`で
Runtimeを一つ生成し、start/stop/disposeを所有します。Hostが公開する`control`は
canonical `@puppetflow/control`型だけです。Runtime・store・lifecycle handleは公開しません。

Phase 2ではcanonicalな外部境界として`@puppetflow/control`を追加しました。
このpackageはcamelCaseのsemantic DTO、safe failure、detached state snapshot、
profile由来capabilitiesを定義し、既存RuntimeのActing APIへ委譲します。Runtimeの
`isRunning()`はread-only availability signalとしてのみ使い、停止中のcommandはsafe resultで
拒否し、stateはempty snapshotを返します。capabilitiesは構成情報なので開始前も取得できます。
既存`@puppetflow/runtime`内Controlはdeprecated compatibility APIとしてPhase Gまで残します。

MCPの`hosts/puppetflow-runtime-host.mjs`は公開Host factoryを呼ぶcomposition rootで、
canonical `host.control`をthin transport adapterで既存snake_case APIへ変換します。7 toolsを維持し、
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

canonicalな実型は`@puppetflow/control`にあります。Phase 2は既存Acting/Expression APIだけを対象にし、transport、Runtime lifecycle、MotionFrame、adapter、input storeを公開しません。

```ts
interface PuppetFlowControl {
  act(request: ActRequest): ControlResult;
  sequence(request: SequenceRequest): ControlResult;
  interrupt(): ControlResult;

  setExpression(request: SetExpressionRequest): ControlResult;
  clearExpression(request?: ClearExpressionRequest): ControlResult;

  getState(): PuppetFlowControlState;
  getCapabilities(): PuppetFlowCapabilities;
}
```

`ActRequest`はaction、side、intensity、speed、duration、blendDurationだけを持ちます。Expression requestはexpression、intensity、duration、fadeIn、fadeOutを持ちます。現行`source-core`の`motion` direct override、bone quaternion、OSC/VMC payloadはControl contractへ持ち込みません。

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

StudioのActing/Expression UIは、Studioが現在所有する一つのRuntimeに対応するcanonical
`@puppetflow/control`をfacade経由で利用します。Runtimeの演技更新通知は接続層で
`control.getState()`のsnapshotへ変換し、再起動時は旧購読を解除して新Controlへ付け替えます。
操作カタログは`getCapabilities()`とStudioのready状態から決定します。

Studio UI、hooks、editor utilitiesはRuntime本体やstoreを取得せず、既存`runtime.ts` facadeの
名前付き設定、入力、snapshot、購読だけを利用します。State、Channel、Timeline、Pipeline観測、
Micro Behavior、Preset、Mapper、SourceのRuntimeアクセスは同facade内へ集約済みです。

Studio自身によるRuntime生成とlifecycle ownershipはまだ残ります。共有Node Hostとの通信方式、
別process化、複数clientの同一実行先は後続Phaseで決定します。Node HostやNode専用VMCをfrontendへ
導入していません。UIの候補は次です。

```text
Simple    Preset + semantic controls
Timeline  visual motion / timeline composition
PFScript  advanced / developer control
```

既存Graph、Preset、Mapper、Pipeline、Actingの知見は維持します。Blockly Block Editorは現状のBehavior AST変換器をすぐ削除せず、coreではなくoptional editor/plugin candidateとして隔離します。Phase 1ではUI rewriteも物理削除もしません。

## Explicit non-goals

Phase 4C adds one loopback-only shared Host service and a browser/Node-safe asynchronous
Control client. Studio shared mode and the MCP shared adapter use the same Host instance;
client disconnect never owns Host shutdown. HTTP exposes only connection metadata,
canonical state/capabilities, and the five canonical commands. Preset, Mapper, Source,
Timeline, and Micro Behavior remain local-only Studio features.

Phase 4D routes shared CLI `launchConfig.adapters.vmc` through the Host's composed VMC
output. MotionState mappings are retained, then Acting/Expression MotionFrame values are
merged once before the single sender; frame values win on a name collision. Output rate,
timestamp mode, destination, standard/custom mappings, and Host-owned cleanup are preserved.
Studio shared tokens are entered after launch and exist only in the current React/client
session; they are no longer read from Vite build-time token variables.

- generic distributed actor framework、message bus、service mesh
- event sourcing、複数RPC standardの同時導入
- MCP専用plugin framework
- 全packageのrename、全presetのrewrite
- production deploy、AITuber本番切替、v2 tag
