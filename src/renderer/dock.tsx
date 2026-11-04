import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { FC } from 'react'
import type {
  CaptureSourceState,
  OrivoxBridge,
  SessionEvent,
  SessionSnapshot,
} from '../shared/contracts'
import { SideDock } from './components/SideDock'
import './styles.css'

const createEmptySnapshot = (): SessionSnapshot => ({
  sessionId: null,
  phase: 'idle',
  activeSources: [],
  sourceStates: {
    microphone: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
    system: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
  },
  startedAtMs: null,
  transcript: [],
  suggestions: [],
  errorMessage: null,
})

export interface StandaloneDockAppProps {
  bridge?: OrivoxBridge
}

export const StandaloneDockApp: FC<StandaloneDockAppProps> = ({
  bridge = typeof window !== 'undefined' ? window.orivox : undefined,
}) => {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(createEmptySnapshot)
  const [isStopping, setIsStopping] = useState(false)

  useEffect(() => {
    if (!bridge) return

    let isMounted = true
    let receivedEvent = false

    bridge
      .getSnapshot()
      .then((initial) => {
        if (isMounted && !receivedEvent) setSnapshot(initial)
      })
      .catch(() => undefined)

    const unsubscribe = bridge.subscribe((event: SessionEvent) => {
      if (!isMounted) return
      receivedEvent = true

      if (event.type === 'capture.status') {
        setSnapshot(event.snapshot)
        if (event.snapshot.phase === 'idle' || event.snapshot.phase === 'capturing') {
          setIsStopping(false)
        }
      } else if (event.type === 'capture.level') {
        setSnapshot((prev) => {
          const current = prev.sourceStates[event.source] || {
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
                ...current,
                levelRms: event.levelRms,
                peak: event.peak,
                processedFrames: event.processedFrames,
              },
            },
          }
        })
      } else if (event.type === 'session.error') {
        setIsStopping(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [bridge])

  const handleStop = async () => {
    if (!bridge) return
    setIsStopping(true)
    try {
      await bridge.stopSession()
    } finally {
      setIsStopping(false)
    }
  }

  const handleClose = async () => {
    if (bridge?.hideDock) {
      await bridge.hideDock()
    }
  }

  const handleOpenMain = async () => {
    if (bridge?.restoreMainWindow) {
      await bridge.restoreMainWindow()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void handleClose()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault()
        void handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bridge])

  const isCapturing = snapshot.phase === 'capturing'

  return (
    <div className="standalone-dock-container">
      <SideDock
        isExpanded={true}
        standalone={true}
        isCapturing={isCapturing}
        sessionId={snapshot.sessionId}
        activeSources={snapshot.activeSources}
        sourceStates={snapshot.sourceStates}
        isStopping={isStopping}
        onToggle={handleClose}
        onStop={handleStop}
        onOpenMain={handleOpenMain}
      />
    </div>
  )
}

const container = document.getElementById('dock-root')
if (container) {
  const root = createRoot(container)
  root.render(
    <StrictMode>
      <StandaloneDockApp />
    </StrictMode>
  )
}
