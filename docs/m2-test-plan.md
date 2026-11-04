# M2 Windows live transcription verification

Status: M2 functional acceptance passed on 2026-11-04 for live microphone-only, system-only, and dual-source transcription in an authorized controlled Windows call. The user configured the Deepgram API key privately and reported that `GET /v1/auth/token` returned “Deepgram key accepted.” Codex did not see or store the key. Live network-outage and device-permission stress cases remain unverified; automated failure-path tests passed.

Coordination note: Antigravity explicitly agreed to the M2 shared contract through Concord and marked `ORIVOX-M2-RENDERER` review-ready. Codex marked `ORIVOX-M2-CONTRACT-BRIDGE` review-ready and recorded the live test evidence under `ORIVOX-M2-BACKEND`.

## Secure local key setup for controlled tests

Do not paste the key into chat, a tracked file, a PowerShell command line, or a screenshot. In a **new local PowerShell window**, run:

```powershell
Set-Location 'C:\Renaissance\Portfolio\orivox'
$orivoxSecureKey = Read-Host 'Deepgram API key' -AsSecureString
$env:DEEPGRAM_API_KEY = [System.Net.NetworkCredential]::new('', $orivoxSecureKey).Password
Remove-Variable orivoxSecureKey
C:\nvm4w\nodejs\npm.cmd run dev
```

The key is entered without echo and inherited only by Orivox launched from that PowerShell process. The app reads it in Electron Main; it is not sent through the preload bridge or stored in the repository. After quitting Orivox, clear the shell variable with `Remove-Item Env:DEEPGRAM_API_KEY` and close that PowerShell window. Do not use `setx`, which would persist the key in the user environment. A future in-app save option can use Electron `safeStorage` async encryption backed by Windows DPAPI; no plaintext persistence is permitted.

## Automated evidence so far

| Check | Result |
| --- | --- |
| M1 regression plus M2 tests | 63/63 passing on 2026-11-04. Includes source-separated Deepgram socket and PCM routing, `mip_opt_out=true`, missing/stale consent rejection, Main IPC authorization, auth error, bounded reconnect, Stop termination, empty speech-boundary finalization, 44.1/48 kHz to 16 kHz worklet resampling, protected credential store, and renderer UI tests. |
| Type-check | `npm run typecheck` passed on 2026-11-04. |
| Production build | `npm run build` passed on 2026-11-04; `out/renderer/audio/pcm-worklet.js` is present. |
| Native M1 regression smoke | Production Electron app launched on Windows on 2026-11-02 with no Deepgram key. Local microphone-only capture reached active state; the microphone frame counter advanced past 65,536 with a nonzero RMS level, and Stop returned Ready for Session with consent checkboxes reset. The test process was closed. This did not exercise the M2 cloud path. |
| Provider connection and real speech | Passed in fresh Electron process on 2026-11-04. User observed source-labeled interim and final turns for microphone-only, system-only, and both sources in an authorized controlled call. Both source sockets reached streaming; Stop cleared text and capture state. See detailed evidence below. |

An initial Electron run stayed at **connecting** with no transcript despite an advancing microphone meter. Stop closed the connection. The user then ran `scripts/deepgram-connection-check.mjs` in the same private Windows shell and reported `Deepgram WebSocket check: connected`. A fresh Electron process subsequently streamed successfully; the first run's cause was not established, so startup reliability remains a watch item. The standalone check sends no audio and prints no credential. A sandbox run returned `network ENOTFOUND` because sandbox DNS is restricted; it is not evidence of a user-machine network failure.

In the fresh Electron diagnostic process, a microphone-only cloud session reached **Mic: streaming** and displayed a source-labeled interim hypothesis. That brief observation ended before a confirmed turn. Stop returned Ready for Session, removed the interim text, cleared consent selections, and left Electron Main with no remote port-443 connection. A later microphone-only session produced a confirmed turn per the user.

The next user-run session selected both sources during an authorized controlled call. Sanitized Main diagnostics showed independent `connecting` then `streaming` provider states for Microphone and System Audio; 10,250 PCM frames were received and 10,250 sent; both routes emitted multiple interim events and at least one `final` event. The user confirmed that the main UI displayed separate source-labeled confirmed turns for both routes, and Stop cleared the transcript and capture indicator back to Ready for Session. Codex did not see or retain the spoken content. An app-data filename audit found no application-created transcript/audio/session files after Stop; Chromium-owned cache and performance databases existed. The code audit found no automatic transcript/audio persistence path. This passes the **dual-source controlled-call gate**.

The user subsequently completed two further fresh-consent Windows sessions and reported **Microphone-only: pass** and **System-Audio-only: pass** against the requested criteria: a confirmed source-labeled turn, the unselected route off, and Stop clearing transcript and capture state. The user also confirmed that silence and interrupted/resumed speech worked without phantom text. These are user-observed results, not direct Codex UI observations. Automated tests cover denied microphone permission, unavailable system capture, consent rejection, silence/empty results, bounded source-specific reconnection, and Stop cleanup. A deliberate live network outage, live device-permission denial, tray Stop during cloud capture, and measured latency were not performed; they remain limits of the acceptance evidence.

## Controlled Windows acceptance checks

Use only a call whose participants have authorized capture and cloud transcription. A local WebRTC call may be used with a second participant or a controlled spoken recording played through the call. Avoid sensitive conversation content in logs or screenshots. Record source labels, status, timestamps, latency, error codes, and resource states; do not retain raw audio or transcript content as test artifacts.

| Check | Procedure | Pass condition |
| --- | --- | --- |
| Local-only M1 | Start without the new cloud consent, mic only/system only/both. | M1 capture, meters, indicator, and Stop still work; no Deepgram connection or PCM IPC is created. |
| Consent | Leave cloud consent unchecked or use an old disclosure version; attempt cloud transcription. Start a fresh session after Stop. | Main rejects cloud processing without the current explicit grant. The grant is not remembered across sessions. |
| Missing/invalid key | Start cloud mode with no key, then with a deliberately invalid local test key. | No audio sent with missing key; clear key/access error with invalid key; no content or credential in logs. |
| Microphone only | Speak distinct short phrases while microphone is the only selected route. | Interim and final text arrives with **Microphone** label; system route remains off. Measure time from speech to first interim/final. |
| System only | Run an authorized connected Windows call and play distinct spoken phrases through system audio. | Interim and final text arrives with **System audio** label; microphone route remains off. Video carrier is not read or sent. |
| Both sources | In a controlled call, speak into microphone while remote speech plays over system output, including some overlap. | Two independent provider states, source labels, and text streams; no inferred speaker identity. Measure latency and note cross-talk/echo. |
| Silence and interruption | Leave both sources silent for at least 30 seconds; then speak, interrupt mid-utterance, and resume. | Connection stays usable, no phantom transcript from silence, interim text may revise, finals remain stable. |
| Permission/device failure | Deny mic permission, remove/unavailable source, end a track during capture. | Explicit source error, no orphan stream, Stop remains available. |
| Network failure | Disconnect and reconnect network during an authorized cloud session; simulate authentication rejection separately. | Affected source shows reconnect/error and possible transcript gap; retry is bounded; auth rejection does not loop. |
| Stop | Stop from main UI and tray while both sources are active; repeat Stop and start again. | Worklets, tracks (including video carrier), contexts, and both WebSockets close; frame counts and provider events stop; transcript/interim memory clears; new session needs fresh cloud consent. |
| Persistence | Inspect app data and repo after an unsaved session and restart. | No audio or transcript files or SQLite session rows were created automatically. Only optional encrypted API credential ciphertext may persist if the user explicitly saves a key later. |

Acceptance needs direct Windows evidence for microphone, system audio, and both during an authorized call. Automated tests and a production build alone do not pass M2. No M3 work follows automatically.
