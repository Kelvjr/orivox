import { useEffect, useState, useCallback } from 'react'
import type { FC } from 'react'
import type {
  CaptureSource,
  CaptureSourceState,
  OrivoxBridge,
  SessionEvent,
  SessionSnapshot,
  SessionStartRequest,
} from '../shared/contracts'
import { Navigation } from './components/Navigation'
import type { NavView } from './components/Navigation'
import { HomeView } from './components/views/HomeView'
import type { SessionMode } from './components/views/HomeView'
import { LiveSessionView } from './components/views/LiveSessionView'
import { HistoryView } from './components/views/HistoryView'
import { SettingsView } from './components/views/SettingsView'
import { ErrorNotice } from './components/ErrorNotice'
import { SideDock } from './components/SideDock'
import type { InterimTurn } from './components/LiveTranscript'
import './styles.css'

export interface AppProps {
  bridge?: OrivoxBridge
  initialDockExpanded?: boolean
  initialView?: NavView
}

const createInitialSnapshot = (): SessionSnapshot => ({
  sessionId: null,
  phase: 'idle',
  activeSources: [],
  sourceStates: {
    microphone: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
    system: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
  },
  transcriptionMode: 'off',
  transcriptionStates: {
    microphone: { phase: 'off', errorMessage: null },
    system: { phase: 'off', errorMessage: null },
  },
  startedAtMs: null,
  transcript: [],
  suggestions: [],
  errorMessage: null,
})

export const App: FC<AppProps> = ({
  bridge = typeof window !== 'undefined' ? window.orivox : undefined,
  initialDockExpanded = false,
  initialView = 'home',
}) => {
  const [currentView, setCurrentView] = useState<NavView>(initialView)
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(createInitialSnapshot)
  const [interimTurns, setInterimTurns] = useState<Record<string, InterimTurn>>({})
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isDockExpanded, setIsDockExpanded] = useState(initialDockExpanded)

  // Settings state
  const [defaultMode, setDefaultMode] = useState<SessionMode>('interview')
  const [autoExpandDock, setAutoExpandDock] = useState(false)

  const toggleDock = useCallback(async () => {
    if (bridge?.toggleDock) {
      const res = await bridge.toggleDock()
      if (typeof res === 'boolean') {
        setIsDockExpanded(res)
        return
      }
    }
    setIsDockExpanded((prev) => !prev)
  }, [bridge])

  const handleRestore = useCallback(async () => {
    if (bridge?.restoreMainWindow) {
      await bridge.restoreMainWindow()
    } else if (bridge?.hideDock) {
      await bridge.hideDock()
    }
    setIsDockExpanded(false)
  }, [bridge])

  // Sync external dock state changes from main process
  useEffect(() => {
    if (!bridge?.onDockStateChange) return
    const unsubscribe = bridge.onDockStateChange((docked: boolean) => {
      setIsDockExpanded(docked)
    })
    return () => unsubscribe()
  }, [bridge])

  // In-window fallback keyboard shortcut listener: Ctrl+Shift+O to toggle desktop dock
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'O' || event.key === 'o')) {
        event.preventDefault()
        void toggleDock()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleDock])

  useEffect(() => {
    if (!bridge) return

    let isMounted = true

    // Retrieve initial snapshot
    bridge
      .getSnapshot()
      .then((initial) => {
        if (isMounted) {
          setSnapshot(initial)
          if (initial.phase === 'capturing') {
            setCurrentView('session')
          }
          if (initial.errorMessage) {
            setError(initial.errorMessage)
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve session state')
        }
      })

    // Subscribe to session events
    const unsubscribe = bridge.subscribe((event: SessionEvent) => {
      if (!isMounted) return

      if (event.type === 'capture.status') {
        setSnapshot(event.snapshot)
        if (event.snapshot.phase === 'capturing') {
          setIsStarting(false)
          setCurrentView('session')
          if (autoExpandDock) {
            setIsDockExpanded(true)
          }
        } else if (event.snapshot.phase === 'idle') {
          setIsStopping(false)
          setIsStarting(false)
          setInterimTurns({})
          setCurrentView('home')
        } else if (event.snapshot.phase === 'error') {
          setIsStarting(false)
          setIsStopping(false)
          if (event.snapshot.errorMessage) {
            setError(event.snapshot.errorMessage)
          }
        }
      } else if (event.type === 'capture.level') {
        setSnapshot((prev) => {
          const currentSourceState: CaptureSourceState = prev.sourceStates[event.source] || {
            phase: 'active',
            levelRms: 0,
            peak: 0,
            processedFrames: 0,
            errorMessage: null,
          }
          return {
            ...prev,
            sourceStates: {
              ...prev.sourceStates,
              [event.source]: {
                ...currentSourceState,
                levelRms: event.levelRms,
                peak: event.peak,
                processedFrames: event.processedFrames,
              },
            },
          }
        })
      } else if (event.type === 'transcription.status') {
        setSnapshot((prev) => {
          const existingStates = prev.transcriptionStates ?? {
            microphone: { phase: 'off', errorMessage: null },
            system: { phase: 'off', errorMessage: null },
          }
          return {
            ...prev,
            transcriptionStates: {
              ...existingStates,
              [event.source]: { ...event.state },
            },
          }
        })
      } else if (event.type === 'transcript.interim') {
        setInterimTurns((prev) => ({
          ...prev,
          [event.turnId]: {
            id: event.turnId,
            source: event.source,
            text: event.text,
            observedAtMs: event.observedAtMs,
          },
        }))
      } else if (event.type === 'transcript.final') {
        setInterimTurns((prev) => {
          if (!prev[event.turn.id]) return prev
          const next = { ...prev }
          delete next[event.turn.id]
          return next
        })
        setSnapshot((prev) => ({
          ...prev,
          transcript: [
            ...prev.transcript.filter((t) => t.id !== event.turn.id),
            event.turn,
          ],
        }))
      } else if (event.type === 'session.error') {
        setError(event.message)
        setIsStarting(false)
        setIsStopping(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [bridge, autoExpandDock])

  const handleStart = async (request: SessionStartRequest) => {
    if (!bridge) {
      setError('Orivox bridge is not available')
      return
    }

    setIsStarting(true)
    setError(null)
    try {
      const result = await bridge.startSession(request)
      setSnapshot(result)
      setCurrentView('session')
      if (autoExpandDock) {
        setIsDockExpanded(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start capture session'
      setError(message)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    if (!bridge) return

    setIsStopping(true)
    try {
      await bridge.stopSession()
      setInterimTurns({})
      setCurrentView('home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop capture session'
      setError(message)
    } finally {
      setIsStopping(false)
    }
  }

  const handleDismissError = () => {
    setError(null)
  }

  const isCapturing = snapshot.phase === 'capturing' || isStarting || isStopping

  return (
    <div className="desktop-app-shell">
      {/* Top Application Bar */}
      <header className="app-topbar">
        <div className="topbar-branding">
          <div className="topbar-logo-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div>
            <div className="topbar-title-row">
              <h1 className="app-title">Orivox</h1>
              <span className="badge-milestone">Milestone 2 — Live Transcripts</span>
            </div>
            <p className="app-subtitle">Personal Live Meeting Copilot</p>
          </div>
        </div>

        <div className="topbar-center-status">
          {isCapturing ? (
            <div className="topbar-live-status" data-testid="topbar-live-status">
              <span className="indicator-pulse" aria-hidden="true" />
              <span className="live-status-text">Active Capture</span>
              <div className="topbar-source-badges">
                {snapshot.activeSources.map((source) => (
                  <span key={source} className="topbar-source-badge">
                    {source === 'microphone' ? 'Mic' : 'System'}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="topbar-idle-status">
              <span className="idle-status-dot" aria-hidden="true" />
              <span>Ready for Session</span>
            </div>
          )}
        </div>

        <div className="topbar-actions">
          {isCapturing && (
            <button
              type="button"
              className="btn-stop btn-stop-topbar"
              onClick={handleStop}
              disabled={isStopping}
              aria-label={isStopping ? 'Stopping capture session' : 'Stop capture session from top bar'}
              data-testid="topbar-stop-button"
            >
              {isStopping ? 'Stopping...' : 'Stop Capture'}
            </button>
          )}

          <button
            type="button"
            className={`btn-dock-toggle ${isDockExpanded ? 'active' : ''}`}
            onClick={isDockExpanded ? handleRestore : toggleDock}
            aria-expanded={isDockExpanded}
            aria-controls="side-dock-panel"
            aria-label={isDockExpanded ? 'Restore window to normal size' : 'Dock window to right 1/3 viewport'}
            title={isDockExpanded ? 'Restore window to normal size (Ctrl+Shift+O)' : 'Dock window to right 1/3 viewport (Ctrl+Shift+O)'}
            data-testid="toggle-dock-button"
          >
            {isDockExpanded ? (
              <>
                <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 'bold' }} aria-hidden="true">
                  🗗
                </span>
                <span>Restore Window</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M15 3v18" />
                </svg>
                <span>Side Dock</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: Switches between 1/3 Dock View and Full App Views */}
      {isDockExpanded ? (
        <div className="docked-window-layout" data-testid="docked-window-layout">
          <SideDock
            isExpanded={true}
            standalone={true}
            isCapturing={isCapturing}
            sessionId={snapshot.sessionId}
            activeSources={snapshot.activeSources}
            sourceStates={snapshot.sourceStates}
            transcript={snapshot.transcript}
            interimTurns={interimTurns}
            transcriptionMode={snapshot.transcriptionMode}
            transcriptionStates={snapshot.transcriptionStates}
            isStopping={isStopping}
            onToggle={handleRestore}
            onStop={handleStop}
            onOpenMain={handleRestore}
          />
        </div>
      ) : (
        <div className="workspace-layout without-dock">
          <Navigation
            currentView={currentView}
            isCapturing={isCapturing}
            isDockExpanded={false}
            onSelectView={setCurrentView}
            onToggleDock={toggleDock}
          />

        <main className="main-content-panel">
          {!bridge && (
            <div className="error-banner" role="alert">
              <div className="error-content">
                <div className="error-title">Bridge Connection Warning</div>
                <p className="error-message">
                  Orivox preload bridge is not available. Please verify context isolation and preload
                  configuration.
                </p>
              </div>
            </div>
          )}

          {error && <ErrorNotice message={error} onDismiss={handleDismissError} />}

          {currentView === 'home' && (
            <HomeView
              isCapturing={isCapturing}
              isStarting={isStarting}
              onStart={handleStart}
              onNavigateToLive={() => setCurrentView('session')}
            />
          )}

          {currentView === 'session' && (
            <LiveSessionView
              isCapturing={isCapturing}
              sessionId={snapshot.sessionId}
              activeSources={snapshot.activeSources}
              sourceStates={snapshot.sourceStates}
              transcript={snapshot.transcript}
              interimTurns={interimTurns}
              transcriptionMode={snapshot.transcriptionMode}
              transcriptionStates={snapshot.transcriptionStates}
              isStopping={isStopping}
              onStop={handleStop}
              onNavigateHome={() => setCurrentView('home')}
            />
          )}

          {currentView === 'history' && (
            <HistoryView onStartSession={() => setCurrentView('home')} />
          )}

          {currentView === 'settings' && (
            <SettingsView
              defaultMode={defaultMode}
              onDefaultModeChange={setDefaultMode}
              autoExpandDock={autoExpandDock}
              onAutoExpandDockChange={setAutoExpandDock}
            />
          )}
        </main>
      </div>
      )}
    </div>
  )
}
