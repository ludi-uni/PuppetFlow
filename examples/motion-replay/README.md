# Motion replay example

This example needs no camera, VRM, or VMC Lab. It is a small JSONL recording for checking the canonical frame path and CLI scheduling.

```powershell
pnpm pf replay examples/motion-replay/session.pfmotion --vmc-host 127.0.0.1 --vmc-port 39539
```

Use `--speed`, `--loop`, or `--start-offset` to inspect playback behavior. A VMC receiver is optional; the recording and ReplaySource can be tested without hardware.

Phase 1 keeps multiple sources in attachment order and does not provide Mixer composition. Mixer, filters, retargeting, and fail-safe policy remain follow-up work.
