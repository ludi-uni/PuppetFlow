import { DEFAULT_MOTION_STATE, type MotionState } from "@puppetflow/core";
import { useEffect, useState } from "react";

const DEFAULT_WS_URL = "ws://127.0.0.1:3939";

const FIELDS: Array<{ key: keyof MotionState; label: string }> = [
  { key: "mouthX", label: "mouthX" },
  { key: "facePitch", label: "facePitch" },
  { key: "headTilt", label: "HeadTilt" },
  { key: "bodyLean", label: "BodyLean" },
  { key: "lookX", label: "LookX" },
  { key: "lookY", label: "LookY" },
];

export function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [connected, setConnected] = useState(false);
  const [motion, setMotion] = useState<MotionState>(DEFAULT_MOTION_STATE);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "motion" in parsed &&
          typeof (parsed as { motion?: unknown }).motion === "object"
        ) {
          setMotion({
            ...DEFAULT_MOTION_STATE,
            ...(parsed as { motion: MotionState }).motion,
          });
        }
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => socket.close();
  }, [wsUrl]);

  return (
    <main className="viewer">
      <header>
        <h1>PuppetFlow Viewer</h1>
        <p>Receives rendered motion from @puppetflow/adapter-websocket</p>
      </header>

      <label className="row">
        <span>WebSocket URL</span>
        <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />
      </label>

      <p className={connected ? "status online" : "status offline"}>
        {connected ? "Connected" : "Disconnected"}
      </p>

      <section className="face">
        <div
          className="eyes"
          style={{
            transform: `translate(${(motion.lookX - 0.5) * 24}px, ${(motion.lookY - 0.5) * 16}px)`,
          }}
        >
          <div className="eye" style={{ height: `${motion.eyeOpen * 28 + 6}px` }} />
          <div className="eye" style={{ height: `${motion.eyeOpen * 28 + 6}px` }} />
        </div>
        <div
          className="mouth"
          style={{
            width: `${40 + motion.smile * 30}px`,
            height: `${8 + motion.mouthOpen * 20}px`,
            borderRadius: motion.smile > 0.3 ? "999px" : "8px",
          }}
        />
        <div
          className="body"
          style={{ transform: `rotate(${motion.bodyLean * 8 - 4}deg)` }}
        />
      </section>

      <section>
        <h2>Motion</h2>
        {FIELDS.map((field) => (
          <label key={field.key} className="row">
            <span>{field.label}</span>
            <meter min={0} max={1} value={motion[field.key]} />
            <span>{motion[field.key].toFixed(2)}</span>
          </label>
        ))}
      </section>
    </main>
  );
}
