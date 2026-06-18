import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import {
  getMicroBehaviorParamDef,
  MICRO_BEHAVIOR_PARAM_DEFS,
} from "../constants/micro-behavior-params";
import {
  addKeyframeAtTime,
  addParamToKeyframe,
  clampParamValue,
  collectKeyframeParamKeys,
  findKeyframeIndexAtTime,
  formatDraftValue,
  removeParamFromKeyframe,
  sortDraftKeyframes,
  updateKeyframeTime,
  type MicroBehaviorDraft,
} from "../utils/micro-behavior-draft";

export interface MicroBehaviorFormEditorProps {
  draft: MicroBehaviorDraft;
  isSimpleMode: boolean;
  onDraftChange: (draft: MicroBehaviorDraft) => void;
}

function updateKeyframeParams(
  draft: MicroBehaviorDraft,
  index: number,
  params: Record<string, number>,
): MicroBehaviorDraft {
  return {
    ...draft,
    keyframes: draft.keyframes.map((frame, frameIndex) =>
      frameIndex === index ? { ...frame, params } : frame,
    ),
  };
}

function timeFromPointer(track: HTMLDivElement, clientX: number, duration: number): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(duration, ratio * duration));
}

export function MicroBehaviorFormEditor({
  draft,
  isSimpleMode,
  onDraftChange,
}: MicroBehaviorFormEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [selectedTime, setSelectedTime] = useState<number>(
    () => sortDraftKeyframes(draft).keyframes[0]?.t ?? 0,
  );
  const [draggingTime, setDraggingTime] = useState<number | null>(null);

  const sortedDraft = useMemo(() => sortDraftKeyframes(draft), [draft]);

  useEffect(() => {
    const exists = findKeyframeIndexAtTime(sortedDraft, selectedTime) >= 0;
    if (!exists) {
      setSelectedTime(sortedDraft.keyframes[0]?.t ?? 0);
    }
  }, [sortedDraft, selectedTime]);

  const selectedIndex = findKeyframeIndexAtTime(sortedDraft, draggingTime ?? selectedTime);
  const selectedFrame =
    selectedIndex >= 0 ? sortedDraft.keyframes[selectedIndex] : sortedDraft.keyframes[0];
  const selectedParamKeys = collectKeyframeParamKeys(selectedFrame);
  const availableParamsForSelected = MICRO_BEHAVIOR_PARAM_DEFS.filter(
    (def) => !selectedParamKeys.includes(def.key),
  );

  const selectTime = useCallback((t: number) => {
    setSelectedTime(Number(t.toFixed(2)));
    setDraggingTime(null);
  }, []);

  const handleTrackPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !trackRef.current) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest(".micro-behavior-timeline-marker")) {
        return;
      }

      const t = Number(timeFromPointer(trackRef.current, event.clientX, sortedDraft.duration).toFixed(2));
      const existingIndex = findKeyframeIndexAtTime(sortedDraft, t);
      if (existingIndex >= 0) {
        selectTime(sortedDraft.keyframes[existingIndex]!.t);
        return;
      }

      const nextDraft = addKeyframeAtTime(sortedDraft, t);
      onDraftChange(nextDraft);
      selectTime(t);
    },
    [onDraftChange, selectTime, sortedDraft],
  );

  const handleMarkerPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, t: number) => {
      event.stopPropagation();
      event.preventDefault();
      selectTime(t);
      setDraggingTime(t);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [selectTime],
  );

  const handleMarkerPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (draggingTime === null || !trackRef.current) {
        return;
      }

      const currentIndex = findKeyframeIndexAtTime(sortedDraft, draggingTime);
      if (currentIndex < 0) {
        return;
      }

      const t = Number(timeFromPointer(trackRef.current, event.clientX, draft.duration).toFixed(2));
      const nextDraft = updateKeyframeTime(sortedDraft, currentIndex, t);
      onDraftChange(nextDraft);
      setDraggingTime(t);
      setSelectedTime(t);
    },
    [draft.duration, draggingTime, onDraftChange, sortedDraft],
  );

  const handleMarkerPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingTime(null);
  }, []);

  const deleteSelectedKeyframe = useCallback(() => {
    if (selectedIndex < 0) {
      return;
    }
    const nextDraft = {
      ...sortedDraft,
      keyframes: sortedDraft.keyframes.filter((_, frameIndex) => frameIndex !== selectedIndex),
    };
    onDraftChange(nextDraft);
    setSelectedTime(nextDraft.keyframes[0]?.t ?? 0);
  }, [onDraftChange, selectedIndex, sortedDraft]);

  return (
    <div className="micro-behavior-form micro-behavior-form-compact">
      <div className="micro-behavior-form-basic micro-behavior-inline-fields">
        <label className="micro-behavior-field">
          <span>{isSimpleMode ? "ID" : "ID"}</span>
          <input
            type="text"
            value={draft.id}
            spellCheck={false}
            onChange={(event) => {
              onDraftChange({ ...draft, id: event.target.value.trim() });
            }}
          />
        </label>
        <label className="micro-behavior-field micro-behavior-field-narrow">
          <span>{isSimpleMode ? "長さ" : "duration"}</span>
          <input
            type="number"
            min={0.2}
            max={30}
            step={0.05}
            value={draft.duration}
            onChange={(event) => {
              onDraftChange({ ...draft, duration: Number(event.target.value) });
            }}
          />
        </label>
        <label className="micro-behavior-field micro-behavior-field-narrow">
          <span>{isSimpleMode ? "CD" : "cooldown"}</span>
          <input
            type="number"
            min={0}
            max={300}
            step={0.5}
            value={draft.cooldown}
            onChange={(event) => {
              onDraftChange({ ...draft, cooldown: Number(event.target.value) });
            }}
          />
        </label>
      </div>

      <div className="micro-behavior-edit-layout">
        <section className="micro-behavior-timeline-pane">
          <div className="micro-behavior-pane-title">
            {isSimpleMode ? "タイムライン" : "Timeline"}
            <span className="hint">クリックで追加 · ドラッグで移動</span>
          </div>
          <div
            ref={trackRef}
            className="micro-behavior-timeline micro-behavior-timeline-interactive"
            onPointerDown={handleTrackPointerDown}
          >
            <div className="micro-behavior-timeline-track">
              {sortedDraft.keyframes.map((frame, index) => {
                const isSelected = Math.abs(frame.t - (draggingTime ?? selectedTime)) < 0.02;
                return (
                  <button
                    key={`${index}-${frame.t}`}
                    type="button"
                    className={`micro-behavior-timeline-marker${isSelected ? " is-selected" : ""}`}
                    style={{
                      left: `${Math.min(100, Math.max(0, (frame.t / draft.duration) * 100))}%`,
                    }}
                    title={`t=${formatDraftValue(frame.t)}`}
                    aria-label={`Keyframe at ${formatDraftValue(frame.t)} seconds`}
                    aria-pressed={isSelected}
                    onPointerDown={(event) => handleMarkerPointerDown(event, frame.t)}
                    onPointerMove={handleMarkerPointerMove}
                    onPointerUp={handleMarkerPointerUp}
                    onPointerCancel={handleMarkerPointerUp}
                  />
                );
              })}
            </div>
            <div className="micro-behavior-timeline-labels">
              <span>0</span>
              <span>{formatDraftValue(draft.duration)}s</span>
            </div>
          </div>
        </section>

        {selectedFrame && selectedIndex >= 0 ? (
          <section className="micro-behavior-keyframe-inspector">
            <div className="micro-behavior-inspector-toolbar">
              <label className="micro-behavior-field micro-behavior-field-narrow">
                <span>t</span>
                <input
                  type="number"
                  min={0}
                  max={draft.duration}
                  step={0.05}
                  value={selectedFrame.t}
                  onChange={(event) => {
                    const nextDraft = updateKeyframeTime(
                      sortedDraft,
                      selectedIndex,
                      Number(event.target.value),
                    );
                    onDraftChange(nextDraft);
                    const movedIndex = findKeyframeIndexAtTime(nextDraft, Number(event.target.value));
                    if (movedIndex >= 0) {
                      setSelectedTime(nextDraft.keyframes[movedIndex]!.t);
                    }
                  }}
                />
              </label>

              {availableParamsForSelected.length > 0 ? (
                <label className="micro-behavior-field micro-behavior-field-grow">
                  <span>+ param</span>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      onDraftChange(addParamToKeyframe(sortedDraft, selectedIndex, value));
                      event.target.value = "";
                    }}
                  >
                    <option value="">追加…</option>
                    {availableParamsForSelected.map((def) => (
                      <option key={def.key} value={def.key}>
                        {isSimpleMode ? def.simpleLabel : def.key}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                className="micro-behavior-btn-compact"
                disabled={sortedDraft.keyframes.length <= 1}
                onClick={deleteSelectedKeyframe}
              >
                削除
              </button>
            </div>

            {selectedParamKeys.length === 0 ? (
              <p className="hint micro-behavior-empty-hint">param がありません</p>
            ) : (
              <table className="micro-behavior-param-table">
                <thead>
                  <tr>
                    <th>{isSimpleMode ? "項目" : "param"}</th>
                    <th>{isSimpleMode ? "値" : "value"}</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {selectedParamKeys.map((paramKey) => {
                    const def = getMicroBehaviorParamDef(paramKey);
                    const value = selectedFrame.params[paramKey] ?? def?.defaultValue ?? 0;
                    const label = isSimpleMode ? def?.simpleLabel ?? paramKey : def?.key ?? paramKey;
                    const hint = isSimpleMode ? def?.simpleHint ?? def?.hint : def?.hint;
                    return (
                      <tr key={paramKey}>
                        <td title={hint}>{label}</td>
                        <td>
                          <input
                            type="number"
                            className="micro-behavior-param-input"
                            step={def?.step ?? 0.01}
                            min={def?.min}
                            max={def?.max}
                            value={value}
                            onChange={(event) => {
                              const nextValue = clampParamValue(paramKey, Number(event.target.value));
                              onDraftChange(
                                updateKeyframeParams(sortedDraft, selectedIndex, {
                                  ...selectedFrame.params,
                                  [paramKey]: nextValue,
                                }),
                              );
                            }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="micro-behavior-btn-compact"
                            title="このポイントから外す"
                            onClick={() => {
                              onDraftChange(
                                removeParamFromKeyframe(sortedDraft, selectedIndex, paramKey),
                              );
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
