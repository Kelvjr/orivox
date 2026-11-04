# M1 Windows capture acceptance plan

M1 is a local capture proof. It does not transcribe, call an AI provider, or save audio. The [local WebRTC test call](../tests/fixtures/controlled-call.html) creates a generated tone between two peers on this computer; it uses no external server and records nothing.

## Gate checks

| Check | Procedure | Passing evidence |
| --- | --- | --- |
| Consent | Leave one or both source choices empty, then leave either consent checkbox unchecked; try Start. | Capture remains idle. With a valid choice and both acknowledgements, selected sources begin and the active indicator remains visible. |
| Microphone only | Select microphone and start. Speak briefly or play a quiet local test tone. | Microphone track is live, processed frame count increases, and RMS activity rises above silence. System source stays inactive. |
| System audio only | Connect the local WebRTC test call, then select system audio and start. | System audio track is live; processed frame count and RMS rise while the call tone plays. Microphone stays inactive. The required display video carrier is neither read nor saved. |
| Both sources | Keep the local call connected; select both. Provide microphone input. | Both tracks remain live and each source's frame count advances independently. Source labels describe capture routes only. |
| Stop | Press Stop from each of the three cases, including during startup. | Every media track reports `ended`, every AudioContext closes, frame counts stop advancing, and the app returns to idle. A second Stop is harmless. |
| Failure handling | Use controlled denied-permission and unavailable-device cases in automated tests; exercise a real denied permission where safe. | Clear source-specific error, no partial capture left running, and a retry remains possible. |

## Evidence to record

Record Windows version, Electron version, test-call state, selected sources, active source states, processed frame counts and RMS before and after Stop, track and AudioContext states, error text, and test commands. No raw audio or screen frames are kept. Unverified checks remain open; M2 must not start automatically.

## Verification on 2026-10-30

Environment: Windows NT 10.0.26300.0, Electron 45.1.0, production build launched with `npm exec -- electron .`. A separate Chrome app window ran the local WebRTC fixture. Its two peers reported `Call state: connected`; ending the call reported `Not connected`. No raw audio or screen frames were saved.

| Check | Observed result |
| --- | --- |
| Consent | Start required a selected route and both acknowledgments. After Stop, both acknowledgments reset. Renderer tests cover the rejected combinations. |
| Microphone only | Active microphone route, RMS 9% at first observation, frame count 51,200 and later 210,944; system route remained inactive. Stop returned the app to Ready for Session. |
| System only | Active system route with connected local call; frame count advanced from 40,960 to 428,032. After ending the call, its RMS fell to 0%; resuming the call raised activity again. Microphone route remained inactive. Stop returned to Ready for Session. |
| Both sources | With the call connected, both routes showed active. Microphone frames advanced 36,864 to 79,872; system frames advanced 32,768 to 77,824. Stop returned to Ready for Session. |
| Resource release | Automated lifecycle test verifies microphone, system audio and display-carrier track `stop()`, both AudioContext `close()` calls, no analyser reads after Stop, and harmless repeated Stop. Live Stop returned idle in all three cases and cleared the capture indicator. Native track and AudioContext states were not directly introspected after live Stop. |
| Failure handling | Automated tests cover denied microphone permission, unavailable system audio with microphone rollback, and Stop during a pending microphone acquisition. No real OS-level permission denial was exercised. |
| Build checks | `npm run typecheck`, `npm test` (28 tests across 3 files), and `npm run build` passed. |

M1 demonstrated independent and simultaneous capture during a controlled Windows call. The resource-release conclusion combines live idle/restart behavior with lifecycle tests; direct native post-Stop introspection and a real OS permission denial remain limitations. Do not start M2 automatically.
