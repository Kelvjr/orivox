import type { FC } from 'react'
import type {
  CaptureSource,
  CaptureSourceState,
  TranscriptTurn,
  TranscriptionSourceState,
} from '../../shared/contracts'
import { LiveTranscript } from './LiveTranscript'
import type { InterimTurn } from './LiveTranscript'

export interface SideDockProps {
  isExpanded: boolean
  isCapturing: boolean
  sessionId: string | null
  activeSources: CaptureSource[]
  sourceStates: Record<CaptureSource, CaptureSourceState>
  transcript?: TranscriptTurn[]
  interimTurns?: Record<string, InterimTurn>
  transcriptionMode?: 'off' | 'cloud'
  transcriptionStates?: Record<CaptureSource, TranscriptionSourceState>
  isStopping: boolean
  onToggle: () => void
  onStop: () => void
  standalone?: boolean
  onOpenMain?: () => void
}

export const SideDock: FC<SideDockProps> = ({
  isExpanded,
  isCapturing,
  sessionId,
  activeSources,
  sourceStates,
  transcript = [],
  interimTurns = {},
  transcriptionMode = 'off',
  transcriptionStates,
  isStopping,
  onToggle,
  onStop,
  standalone = false,
  onOpenMain,
}) => {
  if (!isExpanded && !standalone) {
    return null
  }

  return (
    <aside
      id="side-dock-panel"
      className={`side-dock ${standalone ? 'standalone-dock-window' : ''}`}
      role="complementary"
      aria-label="Orivox Copilot Side Dock"
    >
      <div className="dock-header">
        <div className="dock-title-group">
          <span className="dock-icon" aria-hidden="true">
            📑
          </span>
          <div>
            <h2 className="dock-title">Copilot Dock</h2>
            <span className="dock-header-badge">
              {standalone ? 'Desktop Side Dock' : 'Independent Window Preview'}
            </span>
          </div>
        </div>
        <div className="dock-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {standalone && onOpenMain && (
            <button
              type="button"
              className="dock-header-action-button"
              onClick={onOpenMain}
              aria-label="Open main Orivox window"
              title="Restore / open main Orivox window"
              data-testid="dock-open-main-button"
            >
              🗖
            </button>
          )}
          <button
            type="button"
            className="dock-close-button"
            onClick={onToggle}
            aria-label={standalone ? 'Hide desktop side dock' : 'Collapse side dock'}
            title={standalone ? 'Hide desktop side dock (Escape or Ctrl+Shift+O)' : 'Collapse dock (Ctrl+Shift+O)'}
            data-testid="collapse-dock-button"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="dock-content">
        {standalone ? (
          <div className="dock-preview-banner dock-standalone-banner">
            <div
              className="preview-banner-badge"
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                borderColor: 'rgba(34, 197, 94, 0.4)',
              }}
            >
              Independent Desktop Dock
            </div>
            <p className="preview-banner-text">
              Frameless desktop dock anchored to the right screen edge alongside Microsoft Teams, Zoom, Meet, and browser calls.
            </p>
          </div>
        ) : (
          <div className="dock-preview-banner">
            <div className="preview-banner-badge">Prototype Component</div>
            <p className="preview-banner-text">
              This in-app panel previews the future compact, separate Electron window designed to anchor beside
              video calls (Zoom, Teams, Meet) without keeping the main application open.
            </p>
          </div>
        )}

        {isCapturing ? (
          <section className="dock-section dock-capture-card" aria-label="Dock active capture summary">
            <div className="dock-capture-header">
              <span className="indicator-pulse" aria-hidden="true" />
              <span className="dock-capture-badge">Live Capture Active</span>
            </div>
            <div className="dock-session-info">
              <span className="dock-session-label">Session ID:</span>
              <span className="dock-session-value">{sessionId ?? 'Active'}</span>
            </div>
            <div className="dock-sources-list">
              {activeSources.map((source) => (
                <div key={source} className="dock-source-item">
                  <span className="dock-source-name">
                    {source === 'microphone' ? 'Mic Input' : 'System Loopback'}
                  </span>
                  <span className="dock-source-level">
                    {Math.min(100, Math.round((sourceStates[source]?.levelRms ?? 0) * 100 * 2.5))}% RMS
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-stop btn-stop-dock"
              onClick={onStop}
              disabled={isStopping}
              aria-label={isStopping ? 'Stopping capture session' : 'Stop capture session from side dock'}
              data-testid="dock-stop-button"
            >
              {isStopping ? 'Stopping...' : 'Stop Capture'}
            </button>
          </section>
        ) : (
          <section className="dock-section dock-idle-card" aria-label="Dock idle status">
            <div className="dock-idle-title">Capture Idle</div>
            <p className="dock-idle-desc">
              Select your audio sources and confirm consent in the main window to begin capture.
            </p>
          </section>
        )}

        {/* Milestone 2 Live Transcript in Dock */}
        <section className="dock-section dock-transcript-section" aria-label="Live Transcripts module">
          <LiveTranscript
            transcript={transcript}
            interimTurns={interimTurns}
            transcriptionMode={transcriptionMode}
            transcriptionStates={transcriptionStates}
            activeSources={activeSources}
            compact={true}
          />
        </section>

        <section className="dock-section" aria-label="AI Suggestions module">
          <div className="dock-section-header">
            <h3 className="dock-section-title">AI Grounded Talking Points</h3>
            <span className="dock-future-badge">Milestone 3+</span>
          </div>
          <div className="dock-placeholder-box">
            <p className="dock-placeholder-text">
              Contextual interview hints, document citations, and on-demand answer assistance will appear here.
            </p>
          </div>
        </section>

        <section className="dock-section dock-footer-hints">
          <div className="dock-hint-item">
            <span className="dock-shortcut-kbd">Ctrl</span>+
            <span className="dock-shortcut-kbd">Shift</span>+
            <span className="dock-shortcut-kbd">O</span>
            <span className="dock-hint-text">
              {standalone ? 'Global shortcut to toggle dock' : 'Shortcut to toggle dock'}
            </span>
          </div>
          <div className="dock-hint-note">
            {standalone ? (
              <span>
                <strong>Desktop Controls:</strong> Press Escape or click ✕ to hide without stopping audio capture.
                Use the Windows system tray icon to reopen anytime.
              </span>
            ) : (
              <span>
                <strong>Desktop Controls:</strong> Opens a separate native window on the desktop.
              </span>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
