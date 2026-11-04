import type { FC } from 'react'

export interface HistoryViewProps {
  onStartSession: () => void
}

export const HistoryView: FC<HistoryViewProps> = ({ onStartSession }) => {
  return (
    <div className="view-container history-view" data-testid="history-view">
      <header className="view-header">
        <h1 className="view-title">Session History</h1>
        <p className="view-subtitle">Review past meetings, transcripts, and generated action items.</p>
      </header>

      <div className="card empty-history-card">
        <div className="empty-history-icon" aria-hidden="true">
          🗂️
        </div>
        <h2 className="empty-history-title">No Past Sessions Recorded</h2>
        <p className="empty-history-text">
          In Milestone 1, strict privacy guardrails are enforced. Raw audio and transcripts are never stored on
          disk or retained across sessions.
        </p>

        <div className="history-privacy-callout">
          <div className="callout-header">
            <span className="callout-icon" aria-hidden="true">
              🔒
            </span>
            <strong>Privacy Policy Guarantee:</strong>
          </div>
          <p className="callout-body">
            Persistent local history, transcript search, and post-session summaries will be introduced as an
            explicitly opt-in feature in <strong>Milestone 6</strong>. You will always maintain full control over
            what is saved.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={onStartSession}
          style={{ marginTop: '1.5rem' }}
          data-testid="history-start-session-button"
        >
          Start a New Session →
        </button>
      </div>
    </div>
  )
}
