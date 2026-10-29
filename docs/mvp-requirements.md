# Orivox MVP requirements

## Product boundary

Orivox assists during **actual** Windows interviews and meetings. The MVP is a single-user desktop app; interview preparation, mock interviews, team accounts, and hosted collaboration are outside this release. The live assistance mode must respect an interviewer's or meeting's rules. The app does not hide capture or help users evade restrictions.

## Required user flow

1. The user opens Orivox and selects microphone, system audio, or both.
2. Before every session, the app explains capture, remote transcription/AI processing, retention, and the user's responsibility to obtain any required participant consent and follow meeting rules. Capture starts only after explicit confirmation.
3. A persistent in-app indicator shows the active sources, and Stop ends capture and provider streams promptly. Errors also stop or clearly mark affected sources.
4. The app shows live, source-labeled transcript text. “Microphone” and “System audio” are capture sources, not verified speaker identities.
5. The user can request short contextual talking points on demand. Automatic question detection can suggest help after a completed utterance, with deduplication and a cooldown to avoid interruptions.
6. The user can select local TXT, PDF, and DOCX files for context. Retrieved snippets are shown as evidence. Suggestions must not invent credentials, experience, or facts absent from the conversation or selected documents.
7. At session end, Orivox drafts a reviewable summary with key points and action items. The user chooses whether to save it.

## Functional requirements

| ID | Requirement | MVP acceptance |
| --- | --- | --- |
| F1 | Capture Windows system audio and microphone independently | Each selected source can be started and stopped; a missing or denied source has a clear state. Validate on real Windows calls before relying on the capture approach. |
| F2 | Stream transcription | Partial text appears during speech and completed turns replace or finalize it; reconnect and provider failures are visible. |
| F3 | On-demand assistance | A keyboard shortcut or button requests a concise suggestion from recent context. |
| F4 | Automatic question assistance | Completed turns can trigger a suggestion; duplicate or rapid repeat prompts are suppressed; user can disable it. |
| F5 | Document grounding | User-selected local files can be indexed and retrieved; suggestions show source references and state when support is missing. |
| F6 | Session summary | Summary is reviewable before any save; a failed summary does not erase the live transcript in memory. |
| F7 | Local settings and history | SQLite holds settings, document metadata/index, and only sessions the user explicitly saves. A user can delete saved data. |

## Privacy, consent, and security requirements

- Capture is off by default and requires a fresh, explicit choice each session. The app must never auto-start listening on launch or run a covert mode.
- The consent screen names which sources are captured and that audio/transcript context may be sent to the selected AI provider. It reminds the user to notify participants and check interview or meeting rules.
- Raw audio is not persisted by default. Transcripts and summaries stay in memory unless the user explicitly saves them. Saved items have a clear delete path; retention defaults and exact deletion semantics are verified in M6.
- Only relevant snippets from user-selected documents are sent to the model. The UI distinguishes document evidence from suggestions.
- Provider credentials stay in the Electron main process and OS-protected storage; no secret is exposed to the renderer. Renderer access is limited to a typed, validated preload bridge.
- Telemetry is off for the personal MVP unless the user explicitly opts in to a future design.

## Quality gates

- Windows 11 is the initial target. Test with at least one real call each in Teams, Zoom, and browser-based Meet before release; record device, permissions, provider latency, audio routing, and failures.
- Capture and consent correctness take priority over model quality. No milestone advances while Stop, indicator, or permission-denied behavior is unreliable.
- All AI output is assistive text for the user to review and speak in their own words. Unsupported source claims must be absent or clearly marked uncertain.
