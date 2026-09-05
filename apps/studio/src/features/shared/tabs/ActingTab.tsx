import {
  type ActingSide,
  type ActRequest,
  type SetExpressionRequest,
} from "@puppetflow/control";
import { useMemo, useState } from "react";
import type { UseActingResult } from "../../../hooks/useActing";

const ACCEPTANCE_ACTIONS = [
  "look_left",
  "look_right",
  "head_tilt",
  "small_wave",
  "look_camera",
] as const;

export type ActingTabProps = UseActingResult;

export function ActingTab({
  state,
  capabilities,
  ready,
  status,
  act,
  sequence,
  interrupt,
  setExpression,
  clearExpression,
}: ActingTabProps) {
  const [intensity, setIntensity] = useState(1);
  const [duration, setDuration] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [side, setSide] = useState<ActingSide>("both");
  const [expressionIntensity, setExpressionIntensity] = useState(1);
  const [expressionDuration, setExpressionDuration] = useState(1);
  const [expressionFadeIn, setExpressionFadeIn] = useState(0.15);
  const [expressionFadeOut, setExpressionFadeOut] = useState(0.15);
  const params = useMemo(
    () => ({ intensity, duration, speed, side }),
    [duration, intensity, side, speed],
  );

  const primitiveActions = capabilities.acting.actions.filter(
    (action) => action !== "idle",
  );
  const acceptanceSequence = useMemo<ActRequest[]>(
    () => ACCEPTANCE_ACTIONS.map((action) => ({ action, ...params })),
    [params],
  );
  const missingAcceptanceActions = ACCEPTANCE_ACTIONS.filter(
    (action) => !capabilities.acting.actions.includes(action),
  );
  const acceptanceUnavailableReason =
    missingAcceptanceActions.length > 0
      ? `Missing required actions: ${missingAcceptanceActions.join(", ")}`
      : !capabilities.acting.sequence
        ? "Sequences are unavailable for this configuration"
        : !ready
          ? "Acting controls are unavailable while Studio runtime is starting"
          : null;
  const expressionParams = useMemo<Omit<SetExpressionRequest, "expression">>(
    () => ({
      intensity: expressionIntensity,
      duration: expressionDuration,
      fadeIn: expressionFadeIn,
      fadeOut: expressionFadeOut,
    }),
    [expressionDuration, expressionFadeIn, expressionFadeOut, expressionIntensity],
  );

  return (
    <section className="acting-tab">
      <div className="acting-tab-heading">
        <div>
          <h2>Acting</h2>
          <p className="hint">
            Procedural Humanoid bone controls for the configured VRM.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          disabled={acceptanceUnavailableReason !== null}
          onClick={() => sequence({ actions: acceptanceSequence })}
        >
          Run acceptance sequence
        </button>
      </div>

      <div className="acting-controls">
        <label htmlFor="acting-intensity">
          Intensity
          <input
            id="acting-intensity"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
        </label>
        <label htmlFor="acting-duration">
          Duration (s)
          <input
            id="acting-duration"
            type="number"
            min="0.05"
            max="30"
            step="0.05"
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        <label htmlFor="acting-speed">
          Speed
          <input
            id="acting-speed"
            type="number"
            min="0.1"
            max="4"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
        <label htmlFor="acting-side">
          Side
          <select
            id="acting-side"
            value={side}
            onChange={(event) => setSide(event.target.value as ActingSide)}
          >
            <option value="both">both</option>
            <option value="left">left</option>
            <option value="right">right</option>
          </select>
        </label>
      </div>

      <div className="acting-actions" aria-label="Acting primitives">
        {primitiveActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={!ready}
            onClick={() => act({ action, ...params })}
          >
            {action}
          </button>
        ))}
        {capabilities.acting.actions.includes("idle") ? (
          <button
            type="button"
            disabled={!ready}
            onClick={() => act({ action: "idle", ...params })}
          >
            idle
          </button>
        ) : null}
        <button
          type="button"
          className="ghost-btn"
          disabled={!ready || !capabilities.acting.interrupt}
          onClick={() => interrupt()}
        >
          interrupt
        </button>
      </div>
      {acceptanceUnavailableReason ? (
        <p className="hint">{acceptanceUnavailableReason}</p>
      ) : null}

      <section className="acting-expression" aria-label="Expression controls">
        <h3>Expression</h3>
        <div className="acting-controls">
          <label htmlFor="expression-intensity">
            Intensity
            <input
              id="expression-intensity"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={expressionIntensity}
              onChange={(event) => setExpressionIntensity(Number(event.target.value))}
            />
          </label>
          <label htmlFor="expression-duration">
            Duration (s)
            <input
              id="expression-duration"
              type="number"
              min="0.05"
              max="30"
              step="0.05"
              value={expressionDuration}
              onChange={(event) => setExpressionDuration(Number(event.target.value))}
            />
          </label>
          <label htmlFor="expression-fade-in">
            Fade in (s)
            <input
              id="expression-fade-in"
              type="number"
              min="0"
              max="30"
              step="0.05"
              value={expressionFadeIn}
              onChange={(event) => setExpressionFadeIn(Number(event.target.value))}
            />
          </label>
          <label htmlFor="expression-fade-out">
            Fade out (s)
            <input
              id="expression-fade-out"
              type="number"
              min="0"
              max="30"
              step="0.05"
              value={expressionFadeOut}
              onChange={(event) => setExpressionFadeOut(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="acting-actions" aria-label="Semantic expressions">
          {capabilities.expressions.names.map((expression) => (
            <button
              key={expression}
              type="button"
              disabled={!ready}
              onClick={() => setExpression({ expression, ...expressionParams })}
            >
              {expression}
            </button>
          ))}
          <button
            type="button"
            className="ghost-btn"
            disabled={!ready || !capabilities.expressions.clear}
            onClick={() => clearExpression({ fadeOut: expressionFadeOut })}
          >
            Clear expression
          </button>
        </div>
      </section>

      <dl className="acting-state">
        <div>
          <dt>Active</dt>
          <dd>{state.acting.activeAction?.action ?? "idle"}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{state.acting.elapsed.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{state.acting.remaining.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>Queue: {state.acting.queuedActions}</dd>
        </div>
        <div>
          <dt>Expression</dt>
          <dd>{state.expression.activeExpression?.expression ?? "neutral"}</dd>
        </div>
        <div>
          <dt>Expression remaining</dt>
          <dd>{state.expression.remaining.toFixed(2)} s</dd>
        </div>
      </dl>
      {status ? (
        <p className="acting-status" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
