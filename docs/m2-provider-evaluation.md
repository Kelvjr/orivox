# M2 live transcription: provider evaluation and proposed architecture

Status: **Deepgram Nova-3 approved by the user on 2026-11-02; shared contract awaiting Antigravity agreement.** An incremental Main/preload implementation is in progress. No API key or paid usage has been configured, and no live provider request has been made.

## M1 starting point

- `CaptureSession` in preload owns separate microphone (`getUserMedia`) and Windows system loopback (`getDisplayMedia`) `MediaStream`s and `AudioContext`s. Its 250 ms analyser poll measures levels; it does **not** provide contiguous audio suitable for transcription.
- Electron Main validates source selection and session authorization. The existing `remoteProcessingAccepted` checkbox was explained to users as **local-only M1 processing**; it must not authorize cloud audio transmission.
- The existing typed bridge has `transcript.delta` and `transcript.final` placeholders, but no live transcription status or explicit cloud consent. `transcript.delta` is ambiguous for a provider that revises its interim hypothesis.
- M1 controlled Windows tests passed for microphone, system audio, and both in a local WebRTC call. They did not test transcription. Existing uncommitted M1 and dock work must be preserved.

## Provider comparison

Prices are USD public pay-as-you-go rates observed on 2026-11-01; Deepgram was rechecked on 2026-11-03. Two independently streamed sources normally create two billable streams. Accuracy and end-to-end latency are **unmeasured on Orivox calls**; vendor claims are not acceptance evidence.

| Option | Live fit and latency | Price per source | Privacy and integration notes |
| --- | --- | --- | --- |
| **Deepgram Nova-3 monolingual streaming** | WebSocket supports interim results, final segments, and configurable pause endpointing. Measured Orivox latency remains unknown. | **$0.0077/min** ($0.462/hour) on the current official pricing page. | `mip_opt_out=true` is a per-request control for zero audio/transcript retention after processing; request metadata and usage logs remain. Main owns the API key and two independent WebSockets. |
| **AssemblyAI Universal-Streaming** | WebSocket real-time English transcription; latency and accuracy require the same Orivox call benchmark. | **$0.15/hour of WebSocket session** per source ($0.30/hour for two). | Streaming zero content retention is available when the **account** is opted out of model training; metadata remains. Account-level privacy configuration and session-duration billing need explicit verification before use. |
| **Google Cloud Speech-to-Text V2 standard** | Real-time interim/final streaming via gRPC. The five-minute stream limit needs restart/continuity logic for meetings. | **$0.016/min** at initial tier ($0.96/hour per source), billed by processed audio with one-second rounding. | Requires Google Cloud project, billing and credentials; gRPC and stream rollover add implementation work. Regional/data-use choices require separate review. |
| **OpenAI `gpt-live-transcribe`** | Dedicated low-latency live transcription over Realtime WebSocket; accuracy and latency require local measurement. | **$0.017/min** estimated ($1.02/hour per source). | API key and Realtime session protocol required. Provider data controls need an account-specific review. It is substantially dearer than the Deepgram candidate for two always-on routes. |

Sources: [Deepgram pricing](https://deepgram.com/pricing), [Deepgram streaming API](https://developers.deepgram.com/reference/speech-to-text/listen-streaming), [Deepgram endpointing/interim guide](https://developers.deepgram.com/docs/understand-endpointing-interim-results), [Deepgram data handling](https://developers.deepgram.com/trust-security/your-data), [Deepgram opt-out pricing update](https://developers.deepgram.com/changelog/2026/3/5), [AssemblyAI pricing](https://www.assemblyai.com/pricing/), [AssemblyAI data retention](https://www.assemblyai.com/docs/data-retention-and-model-training), [Google V2 pricing](https://cloud.google.com/speech-to-text/pricing), [Google streaming and limits](https://docs.cloud.google.com/speech-to-text/docs/streaming-recognize), [OpenAI API pricing](https://developers.openai.com/api/docs/pricing), [OpenAI realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription).

## Selection and remaining gates

The user approved **Deepgram Nova-3 monolingual streaming** for M2. The implementation uses English, `mip_opt_out=true`, `interim_results=true`, punctuation, and 300 ms endpointing pending measured call results. Deepgram has a simple source-per-WebSocket shape and an explicit privacy control on every connection. We must measure it against real microphone and loopback samples before claiming an accuracy or latency advantage.

At the listed rate, two continuously active streams cost about **$0.924/hour**, before taxes or optional add-ons. Silence may still count while a stream is open; Stop must close both immediately. Deepgram's pricing page currently advertises a **$200 free credit and no credit card required** for the free signup, so the recommended M2 test purchase is **$0**. If this account is ineligible for free credit, **$10** would cover about ten hours with both sources at this rate. No account, purchase, payment method, API key, or usage is assumed available.

Integration requires a user-provided **Deepgram API key**. For development, `DEEPGRAM_API_KEY` is read only in Electron Main from a local process environment variable; it is never put in the renderer, preload API, repository, logs, or a bundled `.env`. A Windows-protected `safeStorage` credential store exists but no UI setter is exposed yet. Missing or invalid credentials must show a clear error before any cloud stream opens. The user must configure their own key locally for live verification; no service will be purchased automatically.

## Proposed M2 architecture

1. **Session consent:** Keep M1 source and conversation-policy checks. Add a new M2 cloud option with an unchecked, per-session disclosure naming Deepgram, selected routes, remote audio processing, provider retention/metadata, expected usage cost, and participant authorization. The M1 `remoteProcessingAccepted` flag is treated as legacy local-capture acknowledgement only. Electron Main validates the new consent and never caches it for another session. Local-only capture remains possible when cloud transcription is off.
2. **Continuous audio:** Attach a separate `AudioWorklet` to each M1 `AudioContext`/source. Convert its continuous mono frames to an explicitly declared PCM format and sample rate. Retain the existing analyser and video carrier behavior. Do not connect audio to speakers. Worklet output is bounded, ephemeral, and source-tagged.
3. **Main-process provider boundary:** Preload sends only validated session ID, source, sequence, and short PCM frames over narrow IPC. Electron Main accepts frames only from the authorized main-window sender while that exact session has a fresh cloud consent grant. It opens one WebSocket per selected source with `mip_opt_out=true`; the API key never crosses to preload or renderer. No audio leaves on a local-only session, on a denied grant, or after Stop. Apply frame-size/queue limits and drop stale frames rather than allowing unbounded memory growth.
4. **Result normalization:** Each provider connection maps results to its fixed capture-source label. A provisional hypothesis replaces the prior text for the same turn. Finalized segments accumulate until an end-of-utterance event; then one immutable `TranscriptTurn` is emitted. Ignore empty/silence results, late events from a stopped session, and speaker IDs inferred from route. Keep final turns only in volatile session memory for M2.
5. **Failure and Stop:** Show per-source `connecting`, `streaming`, `reconnecting`, and `error` states. Network failures get bounded exponential retry while consent/session remain active; no silent fallback, and gaps are visibly marked. Authentication or missing-key errors do not retry. Stop invalidates the generation, stops PCM production, closes both sockets and worklets, stops every media track (including the display video carrier), closes both contexts, releases capture authorization, clears interim/final transcript memory, and publishes idle state. App quit/renderer destruction also closes provider sockets. Silent audio/KeepAlive handling follows provider timeout guidance without retaining samples.
6. **No persistence:** No audio files, transcript files, SQLite session rows, crash-log payloads, or telemetry of content in M2. A future opt-in save flow belongs to M6. Provider-side opted-out content handling still leaves usage metadata, which the consent UI must state.

## Proposed shared bridge contract for Antigravity review

The following is **not yet agreed or implemented in `src/shared/**`**. Those files remain untouched by M2 changes until Antigravity explicitly agrees through Concord.

```ts
type TranscriptionRequest =
  | { mode: 'off' }
  | {
      mode: 'cloud'
      provider: 'deepgram'
      cloudConsent: { audioTransferAccepted: true; disclosureVersion: 'm2-v1' }
    }

// Optional on SessionStartRequest; absence means { mode: 'off' } for M1 compatibility.
transcription?: TranscriptionRequest

type TranscriptionPhase = 'off' | 'connecting' | 'streaming' | 'reconnecting' | 'error'
type TranscriptionSourceState = { phase: TranscriptionPhase; errorMessage: string | null }

// Add to SessionSnapshot:
transcriptionMode: 'off' | 'cloud'
transcriptionStates: Record<CaptureSource, TranscriptionSourceState>

// Add to SessionEvent:
{ type: 'transcription.status'; sessionId: string; source: CaptureSource; state: TranscriptionSourceState }
{ type: 'transcript.interim'; sessionId: string; turnId: string; source: CaptureSource; text: string; observedAtMs: number }
// Keep transcript.final for completed utterances and the old transcript.delta for fixture compatibility until consumers migrate.
```

An interim event's `text` is the **complete current hypothesis** for its `turnId`, not characters to append. Final turns use the existing `TranscriptTurn` and capture-source labels. The snapshot contains final turns only, enabling a remounted main view to restore completed text; interim text may be lost on remount. React should use a polite live region for finals, avoid announcing every rapidly changing interim, and only auto-scroll if the user is already near the bottom.

## Incremental gates after approval

1. Agree the contract in Concord, claim nonoverlapping paths, and update contracts/fixtures and consent validation. Prove M1 local capture still runs without an M2 cloud grant.
2. Add the Main provider adapter behind a fake transport and verify opt-out, separate routes, frames, statuses, finalization, retries, and Stop with focused tests.
3. Add AudioWorklet PCM capture per route and bridge wiring; validate no audio or text persistence and no cloud frames without a fresh consent grant.
4. Antigravity completes M1 wording cleanup, then main-app consent and transcript UI/tests using the agreed contract. Reusable transcript components may be prepared under `src/renderer`, but no independent dock work is in M2.
5. With a configured key and authorized controlled Windows call, measure microphone only, loopback only, and both; test silence, interruptions, permissions, network loss/recovery, Stop/resource release, transcript source labeling, and no automatic save. Record latency to interim and final text and representative transcription errors. Run `npm test`, `npm run typecheck`, and `npm run build`. M2 cannot pass from synthetic tests alone.

No M3 work begins automatically.
