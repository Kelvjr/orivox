# Incremental development plan

Every milestone ends with a recorded demo or test result in Concord. A later milestone starts only after its acceptance gate passes. Features are added in order, with the audio feasibility test early.

| Milestone | Scope and owner | Acceptance gate |
| --- | --- | --- |
| **M0 — agreement and skeleton** | Codex: architecture, requirements, repo skeleton, typed bridge contract and synthetic fixtures. Antigravity: review the contracts and accept renderer ownership. | Concord records explicit agreement; source boundaries are documented; package scripts and type checks pass where dependencies are available; no product feature is implemented. |
| **M1 — consent and capture proof** | Codex: per-session capture state, system loopback and mic adapters, stop/permission behavior. Antigravity: consent and active-state UI against the mock bridge, then integrated bridge. | On Windows, each selected source can be captured separately in a real call; indicator and Stop match actual state; denied permission and lost device are handled. |
| **M2 — live transcription** | Codex: streaming provider adapter, turn normalizer, reconnect/error paths. Antigravity: live partial/final transcript UI. | Source-labeled partial/final text appears during a real call; no speaker identity is implied; latency and failure results are logged. |
| **M3 — on-demand help** | Codex: recent-context prompt and grounded suggestion service; shortcut. Antigravity: suggestion view and manual request UI. | A manual request returns concise talking points with clear evidence/uncertainty; no unsupported credentials are generated in representative tests. |
| **M4 — automatic question detection** | Codex: final-turn trigger, toggle, cooldown, deduplication. Antigravity: settings and unobtrusive notification. | Questions trigger once; repeated/non-question turns do not spam; automatic mode can be disabled. |
| **M5 — document grounding** | Codex: TXT/PDF/DOCX import, local parse/chunk/index/retrieval. Antigravity: document selection and source references. | Selected snippets are retrievable, citations identify the source, unselected documents are excluded from provider context, unsupported files show errors. |
| **M6 — summary and privacy** | Codex: summary generation, opt-in SQLite saves, delete/retention controls. Antigravity: review/save/delete flow. | No raw audio is saved; unsaved transcript/summary does not persist after session exit; saved data can be inspected and deleted. |
| **M7 — Windows release validation** | Codex leads integration and packaging; Antigravity verifies UI/accessibility. | Tests cover Teams, Zoom, browser Meet, audio devices, minimized/floating window, hotkeys, failure recovery, installer launch, and privacy controls. Known limitations are documented. |

## Working cadence

For each milestone: agree the contract and acceptance criteria in Concord; claim nonoverlapping paths; implement the smallest vertical slice; run targeted checks; record evidence and risks; offer a review handoff; resolve findings; then advance. Shared type changes are proposed before either agent edits against them.

The independent desktop side dock has been implemented as a separate Electron `BrowserWindow` (`DockWindowManager`) anchored to the right display edge, fully collapsible via global shortcut (`CommandOrControl+Shift+O`), ✕, Escape, and system tray (`TrayManager`), and verified natively on the Windows desktop alongside minimized and external application windows.
