# Collaboration, test, and risk log

Concord task: `ORIVOX-ARCH-001`. This file is a readable project record; Concord is the live source for agent messages, claims, and handoffs.

| Date (UTC) | Event | Evidence / outcome |
| --- | --- | --- |
| 2026-10-29 | Codex claimed architecture task. | Concord `start_work`, version 1; no overlapping claims. |
| 2026-10-29 | Codex sent architecture and ownership proposal to Antigravity. | Concord prompt `ced1f56d-091e-4bf7-8aa7-13ec1a76be4d`, delivered. |
| 2026-10-29 | Antigravity explicitly agreed and requested synthetic fixtures. | Concord message `53d8df8d-6299-41d0-9708-76ce81402aac`; Codex accepted in reply `220f964a-b236-4e48-ba27-fb75e9d49b61`. |
| 2026-10-29 | Codex proposed the detailed M0 shared contract; Antigravity approved it before edits. | Concord prompt `56cd1fad-e9b2-4c06-b318-952562b7108d`; approval `72f0e0cf-caae-43a9-bed5-5223dfb3702c`. |
| 2026-10-29 | Antigravity confirmed it will hold renderer implementation until the skeleton and contracts are handed off. | Concord message `4793266b-df1b-4f67-8353-7398451e81ee`. |
| 2026-10-29 | Codex handed off the renderer-only M0 shell. | Concord prompt `edd82968-e503-4dc7-a5b7-ddad52af2db2`; Antigravity claimed `ORIVOX-M0-RENDERER` and completed it, reporting through message `f9be9c6a-2946-4d24-8145-a4b68262cb00`. |
| 2026-10-29 | Built app initially showed an unavailable preload bridge. | Production build emitted ESM `index.mjs`, which a sandboxed preload cannot load. Codex changed preload output to CommonJS `index.cjs`; launch then showed bridge available. |
| 2026-10-30 | User corrected the desktop side-dock architecture after an in-app panel was presented. | Codex sent the correction verbatim to Antigravity via Concord prompt `a89b125a-dc9c-47a7-b373-cbfc2088e5ee` and recorded ADR-008. The independent Electron window/tray/shortcut remain future cross-agent work; M1 capture work continues. |
| 2026-10-30 | Codex and Antigravity agreed on the M1 bridge extension before shared edits. | Concord agreement `1a52b3ab-f97c-44e7-b03a-5169c19421ec`, then handoff `25366df5-4683-48ea-8b44-44309c5629bc`. |
| 2026-10-30 | Antigravity completed M1 renderer controls and later a main-app redesign. | Concord tasks `ORIVOX-M1-RENDERER`, `ORIVOX-UI-REDESIGN-DOCK`, and `ORIVOX-UI-REDESIGN-PREMIUM`; Codex independently ran the merged checks and found in-app dock/tray wording that needed correction. |
| 2026-10-30 | Side-dock correction reached Antigravity. | Concord receipt for prompt `a89b125a-dc9c-47a7-b373-cbfc2088e5ee` is delivered. Antigravity claimed renderer correction task `ORIVOX-DOCK-ARCHITECTURE-ALIGNMENT`; Codex retains future Electron window/tray/shortcut ownership. |
| 2026-10-30 | Antigravity's renderer correction paused on provider quota. | Antigravity edited `SideDock.tsx` and `HomeView.tsx` to label the in-app panel as a preview, then its UI reported “Individual quota reached” before tests, Concord reply, or `finish_work`. Codex attempted a scoped Concord reassignment; Concord denied it because only the current owner can force-reassign. The remaining misleading copy is tracked as a risk. |

## Test results

| Milestone | Result | Evidence |
| --- | --- | --- |
| M0 dependency setup | Pass. | `npm install --no-audit --no-fund` added 81 packages; `npm exec -- install-electron` installed the pinned Windows runtime. |
| M0 type and build | Pass. | `npm run typecheck` passed; `npm run build` bundled main, CommonJS preload, and renderer. Antigravity also reported independent node/web type checks and build. |
| M0 launch | Pass. | `npm exec -- electron .` and `npm run dev` each opened the Orivox shell on Windows with “Bridge status: available.” Both test processes were stopped afterward. |
| M1 merged checks | Pass. | `npm run typecheck`, `npm test` (28/28), and `npm run build` passed on 2026-10-30. |
| M1 Windows controlled call | Pass with documented limitations. | Production Electron build captured microphone only, system only, and both simultaneously. A local two-peer WebRTC call supplied system audio; separate frame counts advanced and Stop returned idle in every case. Detailed observations are in [m1-test-plan.md](m1-test-plan.md). |

## Current risks and handoffs

- Live native track/AudioContext states were not introspected after Stop; unit tests assert all tracks stop, both contexts close, and processing timers cease. The live app returned to idle and could reacquire both sources. A real OS permission denial was not exercised.
- Cloud provider transcription and AI introduce latency, ongoing cost, and remote data processing. Consent, cost visibility, and failure states are required before a usable live session.
- The independent desktop side dock, tray controls, and OS-wide shortcut are not implemented in M1. The in-app panel is only a reusable UI preview; future Electron lifecycle work requires a separate agreed milestone.
- Antigravity's quota interrupted the renderer wording cleanup. `LiveSessionView.tsx` still describes tray controls as available; its active Concord claim prevents Codex from editing that file until ownership is released or reassigned by its owner. This UI copy must be corrected before presenting the main app as a finished desktop docking experience.
