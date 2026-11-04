import { contextBridge, ipcRenderer } from 'electron'
import { CaptureSession } from './capture-session'
import type { CaptureSource, OrivoxBridge, SessionEvent, SessionSnapshot, SessionStartRequest, TranscriptTurn, TranscriptionPhase } from '../shared/contracts'

const isDockWindow = process.argv.includes('--window-type=dock')

let bridge: OrivoxBridge

if (isDockWindow) {
  // Remote bridge for the independent Desktop Side Dock window
  bridge = {
    startSession: (request: SessionStartRequest): Promise<SessionSnapshot> =>
      ipcRenderer.invoke('orivox:session:start', request),
    stopSession: (): Promise<void> =>
      ipcRenderer.invoke('orivox:session:stop'),
    requestSuggestion: (): Promise<void> =>
      Promise.reject(new Error('Suggestions are not available in M1')),
    getSnapshot: (): Promise<SessionSnapshot> =>
      ipcRenderer.invoke('orivox:session:get-snapshot'),
    subscribe: (listener: (event: SessionEvent) => void): (() => void) => {
      const handler = (_: unknown, event: SessionEvent) => listener(event)
      ipcRenderer.on('orivox:session:event', handler)
      return () => {
        ipcRenderer.removeListener('orivox:session:event', handler)
      }
    },
    toggleDock: async (options?: { minimizeMain?: boolean }) => {
      await ipcRenderer.invoke('orivox:dock:toggle', options)
    },
    showDock: async (options?: { minimizeMain?: boolean }) => {
      await ipcRenderer.invoke('orivox:dock:show', options)
    },
    hideDock: async () => {
      await ipcRenderer.invoke('orivox:dock:hide')
    },
    minimizeMainWindow: async () => {
      await ipcRenderer.invoke('orivox:window:minimize-main')
    },
    restoreMainWindow: async () => {
      await ipcRenderer.invoke('orivox:window:restore-main')
    },
    isDocked: async (): Promise<boolean> => {
      return (await ipcRenderer.invoke('orivox:dock:is-docked')) as boolean
    },
    onDockStateChange: (listener: (isDocked: boolean) => void): (() => void) => {
      const handler = (_: unknown, state: boolean) => listener(state)
      ipcRenderer.on('orivox:window:dock-state-changed', handler)
      return () => {
        ipcRenderer.removeListener('orivox:window:dock-state-changed', handler)
      }
    },
  }
} else {
  // Main window hosting the live capture session
  const capture = new CaptureSession({
    authorize: (request) => ipcRenderer.invoke('orivox:capture:authorize', request),
    release: (sessionId) => ipcRenderer.invoke('orivox:capture:release', sessionId),
    streamFrame: (sessionId, source, pcm) => ipcRenderer.send('orivox:transcription:frame', { sessionId, source, pcm }),
  })
  let startInProgress = false
  const pendingProviderEvents: unknown[] = []

  const isSource = (value: unknown): value is CaptureSource => value === 'microphone' || value === 'system'
  const isPhase = (value: unknown): value is TranscriptionPhase =>
    value === 'connecting' || value === 'streaming' || value === 'reconnecting' || value === 'error'

  const applyProviderEvent = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return true
    const event = value as Record<string, unknown>
    if (typeof event.sessionId !== 'string') return true
    if (event.type === 'status' && isSource(event.source) && isPhase(event.phase)) {
      if (event.errorMessage !== null && (typeof event.errorMessage !== 'string' || event.errorMessage.length > 500)) return true
      return capture.acceptTranscriptionStatus(event.sessionId, event.source, {
        phase: event.phase, errorMessage: event.errorMessage,
      })
    }
    if (event.type === 'interim' && isSource(event.source) &&
      typeof event.turnId === 'string' && typeof event.text === 'string' && typeof event.observedAtMs === 'number') {
      return capture.acceptInterimTranscript(event.sessionId, event.source, event.turnId, event.text, event.observedAtMs)
    }
    if (event.type === 'final' && event.turn && typeof event.turn === 'object') {
      const turn = event.turn as Partial<TranscriptTurn>
      if (isSource(turn.source) && typeof turn.id === 'string' && typeof turn.text === 'string' &&
        typeof turn.startedAtMs === 'number' && typeof turn.endedAtMs === 'number') {
        return capture.acceptFinalTranscript(event.sessionId, turn as TranscriptTurn)
      }
    }
    return true
  }

  const startSession = async (request: SessionStartRequest): Promise<SessionSnapshot> => {
    if (startInProgress) throw new Error('Session startup is already in progress')
    startInProgress = true
    try {
      await capture.startSession(request)
      for (const event of pendingProviderEvents) applyProviderEvent(event)
      return capture.getSnapshot()
    } finally {
      pendingProviderEvents.length = 0
      startInProgress = false
    }
  }

  // Broadcast session events to the main process so Tray and Dock window stay in sync
  capture.subscribe((event) => {
    ipcRenderer.send('orivox:session:event', event)
  })

  // Listen for remote stop requests from the System Tray or Dock window
  ipcRenderer.on('orivox:session:stop-request', () => {
    capture.stopSession().catch(() => undefined)
  })

  // Listen for remote start requests if forwarded from the dock
  ipcRenderer.on('orivox:session:start-request', (_event, request: SessionStartRequest) => {
    startSession(request).catch(() => undefined)
  })

  ipcRenderer.on('orivox:transcription:event', (_event, value: unknown) => {
    if (!applyProviderEvent(value) && startInProgress && pendingProviderEvents.length < 64) pendingProviderEvents.push(value)
  })

  bridge = {
    startSession,
    stopSession: () => capture.stopSession(),
    requestSuggestion: () => capture.requestSuggestion(),
    getSnapshot: () => capture.getSnapshot(),
    subscribe: (listener) => capture.subscribe(listener),
    toggleDock: async (options?: { minimizeMain?: boolean }) => {
      await ipcRenderer.invoke('orivox:dock:toggle', options)
    },
    showDock: async (options?: { minimizeMain?: boolean }) => {
      await ipcRenderer.invoke('orivox:dock:show', options)
    },
    hideDock: async () => {
      await ipcRenderer.invoke('orivox:dock:hide')
    },
    minimizeMainWindow: async () => {
      await ipcRenderer.invoke('orivox:window:minimize-main')
    },
    restoreMainWindow: async () => {
      await ipcRenderer.invoke('orivox:window:restore-main')
    },
    isDocked: async (): Promise<boolean> => {
      return (await ipcRenderer.invoke('orivox:dock:is-docked')) as boolean
    },
    onDockStateChange: (listener: (isDocked: boolean) => void): (() => void) => {
      const handler = (_: unknown, state: boolean) => listener(state)
      ipcRenderer.on('orivox:window:dock-state-changed', handler)
      return () => {
        ipcRenderer.removeListener('orivox:window:dock-state-changed', handler)
      }
    },
  }
}

contextBridge.exposeInMainWorld('orivox', bridge)
