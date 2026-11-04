import { useState } from 'react'
import type { FC } from 'react'
import type {
  CaptureSource,
  CaptureSourceState,
  TranscriptTurn,
  TranscriptionSourceState,
} from '../../../shared/contracts'
import { AudioMeters } from '../AudioMeters'
import { LiveTranscript } from '../LiveTranscript'
import type { InterimTurn } from '../LiveTranscript'

export interface LiveSessionViewProps {
  isCapturing: boolean
  sessionId: string | null
  activeSources: CaptureSource[]
  sourceStates: Record<CaptureSource, CaptureSourceState>
  transcript?: TranscriptTurn[]
  interimTurns?: Record<string, InterimTurn>
  transcriptionMode?: 'off' | 'cloud'
  transcriptionStates?: Record<CaptureSource, TranscriptionSourceState>
  isStopping: boolean
  onStop: () => void
  onNavigateHome: () => void
}

export const LiveSessionView: FC<LiveSessionViewProps> = ({
  isCapturing,
  sessionId,
  activeSources,
  sourceStates,
  transcript = [],
  interimTurns = {},
  transcriptionMode = 'off',
  transcriptionStates,
  isStopping,
  onStop,
  onNavigateHome,
}) => {
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)

  if (!isCapturing) {
    return (
      <div className="view-container session-idle-view" data-testid="live-session-idle">
        <header className="view-header">
          <h1 className="view-title">Live Session Hub</h1>
          <p className="view-subtitle">Monitor real-time audio streams, live transcriptions, and AI suggestions.</p>
        </header>

        <div className="card idle-state-card">
          <div className="idle-state-icon" aria-hidden="true">
            ⏹️
          </div>
          <h2 className="card-title">No Active Capture Session</h2>
          <p className="card-description" style={{ maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            Select your audio sources and confirm session consent on the Home view to launch an audio capture session.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={onNavigateHome}
            data-testid="idle-goto-home-button"
          >
            Go to Session Setup →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="view-container live-session-view" data-testid="live-session-active">
      <header className="view-header session-active-header">
        <div>
          <div className="live-badge-row">
            <span className="indicator-pulse" aria-hidden="true" />
            <span className="live-status-pill" data-testid="capture-active-title">
              RECORDING IN PROGRESS — LIVE CAPTURE ACTIVE
            </span>
          </div>
          <h1 className="view-title" style={{ marginTop: '0.4rem' }}>
            Active Audio Session
          </h1>
          <div className="sources-pills" aria-label="Active capture sources" style={{ margin: '0.4rem 0' }}>
            {activeSources.map((source) => (
              <span key={source} className="source-pill">
                {source === 'microphone' ? 'Microphone' : 'System Audio'}
              </span>
            ))}
          </div>
          <p className="view-subtitle">
            Session ID: <code className="session-id-tag">{sessionId ?? 'Initializing...'}</code>
          </p>
        </div>

        <button
          type="button"
          className="btn-stop btn-large"
          onClick={onStop}
          disabled={isStopping}
          aria-label={isStopping ? 'Stopping capture session' : 'Stop capture session'}
          data-testid="stop-capture-button"
        >
          {isStopping ? (
            <>
              <span className="spinner-inline" aria-hidden="true" />
              Stopping Session...
            </>
          ) : (
            'Stop Capture Session'
          )}
        </button>
      </header>

      {/* 1. Real-Time Audio Activity Section */}
      <section className="live-section" aria-labelledby="audio-activity-heading">
        <AudioMeters activeSources={activeSources} sourceStates={sourceStates} />

        {/* Minimized Tray Guidance Banner */}
        <div className="card tray-guidance-card">
          <div className="tray-guidance-header">
            <span className="tray-icon" aria-hidden="true">
              📥
            </span>
            <h3 className="card-title" style={{ fontSize: '0.95rem', margin: 0 }}>
              Background Capture & System Tray Integration
            </h3>
            <span className="future-tag">Roadmap — Electron Main</span>
          </div>
          <p className="card-description" style={{ margin: '0.5rem 0 0 0' }}>
            In M1, capture runs inside this application window. An independent desktop side-dock window, Windows
            system tray controls, and OS-level global shortcuts are not yet active and will be implemented in
            Electron Main by Codex in a future milestone.
          </p>
        </div>

        {/* Expandable Technical Diagnostics Accordion */}
        <div className="advanced-diagnostics-card">
          <button
            type="button"
            className="advanced-details-toggle"
            onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
            aria-expanded={isDiagnosticsOpen}
            aria-controls="audio-diagnostics-panel"
          >
            <span>{isDiagnosticsOpen ? '▼' : '▶'} Technical Stream Diagnostics</span>
            <span className="accordion-hint">{isDiagnosticsOpen ? 'Hide Diagnostics' : 'Show Diagnostics'}</span>
          </button>

          {isDiagnosticsOpen && (
            <div id="audio-diagnostics-panel" className="diagnostics-content">
              <div className="diagnostics-grid">
                <div className="diagnostic-stat">
                  <span className="stat-label">FFT Buffer Size:</span>
                  <span className="stat-value">2048 samples</span>
                </div>
                <div className="diagnostic-stat">
                  <span className="stat-label">RMS Polling Rate:</span>
                  <span className="stat-value">250ms interval</span>
                </div>
                <div className="diagnostic-stat">
                  <span className="stat-label">Active AudioContexts:</span>
                  <span className="stat-value">{activeSources.length} instances</span>
                </div>
                <div className="diagnostic-stat">
                  <span className="stat-label">Raw Audio Persistence:</span>
                  <span className="stat-value highlight-green">0 bytes (volatile memory only)</span>
                </div>
                <div className="diagnostic-stat">
                  <span className="stat-label">Carrier Video Frame Storage:</span>
                  <span className="stat-value highlight-green">Disabled (never inspected or stored)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. Real-Time Transcript Stream */}
      <section className="live-section" aria-labelledby="live-transcript-heading">
        <LiveTranscript
          transcript={transcript}
          interimTurns={interimTurns}
          transcriptionMode={transcriptionMode}
          transcriptionStates={transcriptionStates}
          activeSources={activeSources}
        />
      </section>

      {/* 3. AI Grounded Suggestions Reserved Area */}
      <div className="future-modules-grid">
        <section className="card future-module-card" aria-label="AI Talking Points Preview">
          <div className="future-module-header">
            <div className="module-title-group">
              <span className="module-icon" aria-hidden="true">
                💡
              </span>
              <h2 className="module-title">AI Grounded Talking Points</h2>
            </div>
            <span className="future-tag">Milestone 3+ Preview</span>
          </div>

          <div className="future-empty-body">
            <p className="future-empty-text">
              Automatic interview question detection, portfolio document grounding, and concise talking points will
              generate in this panel.
            </p>
            <div className="future-disclaimer">
              AI provider integration is offline in Milestone 1. Grounding documents remain strictly on your device.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
