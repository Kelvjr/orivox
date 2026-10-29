# Orivox

Orivox is a Windows desktop copilot for live interviews and meetings. It transcribes an opted-in conversation, offers short contextual suggestions, uses documents the user selects, and drafts a post-session summary. It is not a mock interview application.

Development is staged. **M0 is complete:** architecture, ownership, and a feature-free project skeleton. M1 is the consent and Windows audio-capture proof. See [MVP requirements](docs/mvp-requirements.md), [architecture](docs/architecture.md), [milestones](docs/development-plan.md), and the [collaboration log](docs/collaboration.md).

Codex leads the Electron, service, security, and shared-contract work. Google Antigravity owns the React renderer. The agents coordinate decisions and handoffs in the existing Concord workspace.

No audio capture, transcription, AI suggestion, document import, or persistence feature is enabled by the M0 skeleton.

## Local M0 checks

With Node.js 24 or newer installed:

```powershell
npm install
npm exec -- install-electron
npm run typecheck
npm run build
npm run dev
```

Electron 45 downloads its Windows runtime separately through `install-electron`. The current shell only confirms that the renderer and preload bridge load; its bridge methods are intentional M0 stubs.
