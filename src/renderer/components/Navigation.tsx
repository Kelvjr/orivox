import type { FC } from 'react'

export type NavView = 'home' | 'session' | 'history' | 'settings'

export interface NavigationProps {
  currentView: NavView
  isCapturing: boolean
  isDockExpanded: boolean
  onSelectView: (view: NavView) => void
  onToggleDock: () => void
}

export const Navigation: FC<NavigationProps> = ({
  currentView,
  isCapturing,
  isDockExpanded,
  onSelectView,
  onToggleDock,
}) => {
  return (
    <nav className="app-nav-sidebar" aria-label="Main application navigation">
      <div className="nav-brand">
        <div className="nav-brand-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <div className="nav-brand-text">
          <span className="nav-brand-name">Orivox</span>
          <span className="nav-brand-tag">Desktop</span>
        </div>
      </div>

      <div className="nav-links">
        <button
          type="button"
          className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => onSelectView('home')}
          aria-current={currentView === 'home' ? 'page' : undefined}
          data-testid="nav-home"
        >
          <span className="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="nav-label">Home</span>
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'session' ? 'active' : ''}`}
          onClick={() => onSelectView('session')}
          aria-current={currentView === 'session' ? 'page' : undefined}
          data-testid="nav-session"
        >
          <span className="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
          <span className="nav-label">Live Session</span>
          {isCapturing && (
            <span className="nav-live-dot" aria-label="Active recording in progress" title="Active capture" />
          )}
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
          onClick={() => onSelectView('history')}
          aria-current={currentView === 'history' ? 'page' : undefined}
          data-testid="nav-history"
        >
          <span className="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          </span>
          <span className="nav-label">History</span>
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectView('settings')}
          aria-current={currentView === 'settings' ? 'page' : undefined}
          data-testid="nav-settings"
        >
          <span className="nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          <span className="nav-label">Settings</span>
        </button>
      </div>

      <div className="nav-footer">
        <button
          type="button"
          className={`nav-dock-button ${isDockExpanded ? 'active' : ''}`}
          onClick={onToggleDock}
          aria-expanded={isDockExpanded}
          aria-controls="side-dock-panel"
          aria-label={isDockExpanded ? 'Collapse side dock' : 'Expand side dock'}
          title="Toggle Side Dock (Ctrl+Shift+O)"
          data-testid="nav-toggle-dock-button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M15 3v18" />
          </svg>
          <span className="dock-button-text">{isDockExpanded ? 'Hide Dock' : 'Side Dock'}</span>
          <kbd className="dock-shortcut-badge">Ctrl+⇧+O</kbd>
        </button>

        <div className="nav-version-info">
          <span>Orivox v0.1.0</span>
          <span className="nav-milestone-pill">M2 Live Transcripts</span>
        </div>
      </div>
    </nav>
  )
}
