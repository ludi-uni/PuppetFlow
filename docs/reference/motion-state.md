# MotionState

`@puppetflow/core` が定義する、キャラクター向けの正規化モーションパラメータです。値は原則 **0.0〜1.0**（`clamp01` でクランプ）です。

ソース: `packages/core/src/motion-state.ts`

## キー一覧（12 種）

| カテゴリ     | キー                                 | 説明                                                     |
| ------------ | ------------------------------------ | -------------------------------------------------------- |
| 顔の向き     | `faceYaw`, `facePitch`               | 顔の回転（デフォルト 0.5 = ニュートラル）                |
| 体の向き     | `bodyYaw`, `bodyRoll`                | 体の回転                                                 |
| 視線         | `lookX`, `lookY`                     | 眼球方向（gaze / idle / graph / behavior、デフォルト 0.5） |
| まぶた       | `eyeYaw`                         | まぶたの開き（1 = 開、`ParamEyeOpen`、blink プラグインが使用） |
| 目の笑み     | `eyePitch`                       | 目の笑み（`ParamEyeSmile`）                                |
| 口           | `mouthX`, `mouthY`                   | 口形・開き（デフォルト 0）                               |
| 頭・体       | `headTilt`, `bodyLean`               | 首傾き・体の前後傾き（デフォルト 0.5 = ニュートラル）   |

## 廃止したキー（vNext）

以下は **Motion Mapper 上で他キーと重複** していたため `MotionState` から削除しました。Preset 読み込み時に自動で置き換え先へマイグレーションされます。

| 廃止キー                        | 置き換え                            |
| ------------------------------- | ----------------------------------- |
| `eyeX`, `eyeY`                  | `lookX`, `lookY`                    |
| `faceRoll`（`ParamAngleZ` 重複） | `headTilt`                          |
| `bodyPitch`（`ParamBodyAngleX` 重複） | `bodyLean`                     |
| `smile`（PFScript 別名）        | `mouthX`                            |
| `eyeSmile`（PFScript 別名）     | `eyePitch`                          |
| `mouthOpen`                     | `mouthY`                            |
| `eyeOpen`（PFScript 別名）      | `eyeYaw`                            |
| `browUp`, `browDown`            | `facePitch`（表情の簡略表現）       |

## マージ規則

| API | 用途 | 同一キーの合成 |
| --- | ---- | -------------- |
| `mergeMotionState` | behavior / graph / extension 内部 | **平均** |
| `addMotionState` | **ランタイム**（Plugins → behavior → graph） | **ニュートラルからの加算** |

`addMotionState` は各キーのデフォルト値（`DEFAULT_MOTION_STATE`）をニュートラルとみなし、  
`neutral + Σ(value - neutral)` を `clamp01` します。

例: `mouthX`（neutral=0）で graph=0.4 + behavior=0.3 → 0.7。  
`lookX`（neutral=0.5）で gaze=0.55 + idle=0.48 → 0.5 + 0.05 + (-0.02) = 0.53。

## Adapter への変換

`@puppetflow/motion-mapper` が MotionState をモデル固有の OSC パラメータ名に変換します。視線は `lookX` / `lookY` のみです。マッピングは Studio の **Motion Mapper** タブ、または `profiles/*.json` で定義します。
