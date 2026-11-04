import type { FC } from 'react'
import type { CaptureSource } from '../../shared/contracts'

export interface CaptureStatusProps {
  sessionId: string | null
  activeSources: CaptureSource[]
  isStopping: boolean
  onStop: () => void
}

export const CaptureStatus: FC<CaptureStatusProps> = ({
  sessionId,
  activeSources,
  isStopping,
  onStop,
}) => {
  return (
    <aside
      className="capture-banner"
      role="region"
      aria-label="Active capture session controls"
      aria-live="polite"
    >
      <div className="capture-indicator">
        <span className="indicator-pulse" aria-hidden="true" />
        <div className="capture-label-group">
          <div className="capture-title" data-testid="capture-active-title">
            RECORDING IN PROGRESS — LIVE CAPTURE ACTIVE
          </div>
          <div className="capture-meta">
            Session ID: {sessionId ?? 'Initializing...'}
          </div>
          <div className="sources-pills" aria-label="Active capture sources">
            {activeSources.map((source) => (
              <span key={source} className="source-pill">
                {source === 'microphone' ? 'Microphone' : 'System Audio'}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="btn-stop"
          onClick={onStop}
          disabled={isStopping}
          aria-label={isStopping ? 'Stopping capture session' : 'Stop capture session'}
          data-testid="stop-capture-button"
        >
          {isStopping ? 'Stopping Session...' : 'Stop Capture Session'}
        </button>
      </div>
    </aside>
  )
}
