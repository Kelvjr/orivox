import type {
  CaptureSource,
  OrivoxBridge,
  SessionEvent,
  SessionSnapshot,
  SessionStartRequest,
  Suggestion,
  TranscriptTurn,
} from './contracts'

export const FIXTURE_TIME_MS = 1_700_000_000_000

export const fixtureTurn: TranscriptTurn = {
  id: 'turn-1',
  source: 'system',
  text: 'Could you describe a project you led?',
  startedAtMs: FIXTURE_TIME_MS,
  endedAtMs: FIXTURE_TIME_MS + 2_000,
}

export const fixtureSuggestion: Suggestion = {
  id: 'suggestion-1',
  trigger: 'manual',
  text: 'Name the project, your role, the result, and one lesson learned.',
  citations: [{ kind: 'transcript', refId: fixtureTurn.id, label: 'Recent question' }],
  createdAtMs: FIXTURE_TIME_MS + 2_500,
}

export const fixtureEvents: SessionEvent[] = [
  {
    type: 'capture.level',
    sessionId: 'fixture-session',
    source: 'system',
    levelRms: 0.25,
    peak: 0.5,
    processedFrames: 2048,
    observedAtMs: FIXTURE_TIME_MS + 500,
  },
  {
    type: 'transcript.delta',
    sessionId: 'fixture-session',
    turnId: fixtureTurn.id,
    source: fixtureTurn.source,
    delta: 'Could you describe',
    observedAtMs: FIXTURE_TIME_MS + 1_000,
  },
  { type: 'transcript.final', sessionId: 'fixture-session', turn: fixtureTurn },
  { type: 'suggestion.ready', sessionId: 'fixture-session', suggestion: fixtureSuggestion },
]

export interface MockOrivoxBridge extends OrivoxBridge {
  /** Test-only event injection; it has no capture or provider side effects. */
  emit(event: SessionEvent): void
  toggleDockCalls: number
  showDockCalls: number
  hideDockCalls: number
  minimizeMainWindowCalls: number
  restoreMainWindowCalls: number
  lastToggleOptions?: { minimizeMain?: boolean }
  dockState: boolean
  setDockedState(isDocked: boolean): void
}

const emptySnapshot = (): SessionSnapshot => ({
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

const copySnapshot = (value: SessionSnapshot): SessionSnapshot => ({
  ...value,
  activeSources: [...value.activeSources],
  sourceStates: {
    microphone: { ...value.sourceStates.microphone },
    system: { ...value.sourceStates.system },
  },
  transcriptionStates: value.transcriptionStates
    ? {
        microphone: { ...value.transcriptionStates.microphone },
        system: { ...value.transcriptionStates.system },
      }
    : undefined,
  transcript: value.transcript.map((turn) => ({ ...turn })),
  suggestions: value.suggestions.map((suggestion) => ({
    ...suggestion,
    citations: suggestion.citations.map((citation) => ({ ...citation })),
  })),
})

/** Deterministic, Electron-free bridge for renderer tests and preview states. */
export function createMockBridge(initial: SessionSnapshot = emptySnapshot()): MockOrivoxBridge {
  let snapshot = copySnapshot(initial)
  const listeners = new Set<(event: SessionEvent) => void>()
  const dockListeners = new Set<(isDocked: boolean) => void>()

  const publish = (event: SessionEvent): void => {
    for (const listener of listeners) listener(event)
  }

  return {
    async startSession(request: SessionStartRequest): Promise<SessionSnapshot> {
      if (
        request.consent.remoteProcessingAccepted !== true ||
        request.consent.conversationPolicyAcknowledged !== true ||
        request.sources.length === 0
      ) {
        throw new Error('Explicit consent and at least one source are required')
      }
      if (request.transcription?.mode === 'cloud') {
        if (
          request.transcription.provider !== 'deepgram' ||
          request.transcription.cloudConsent?.audioTransferAccepted !== true ||
          request.transcription.cloudConsent?.disclosureVersion !== 'm2-v1'
        ) {
          throw new Error('Explicit Deepgram cloud consent (disclosureVersion m2-v1) is required for cloud transcription')
        }
      }
      const isCloud = request.transcription?.mode === 'cloud'
      snapshot = {
        ...emptySnapshot(),
        sessionId: 'fixture-session',
        phase: 'capturing',
        activeSources: [...new Set<CaptureSource>(request.sources)],
        sourceStates: {
          microphone: {
            ...emptySnapshot().sourceStates.microphone,
            phase: request.sources.includes('microphone') ? 'active' : 'inactive',
          },
          system: {
            ...emptySnapshot().sourceStates.system,
            phase: request.sources.includes('system') ? 'active' : 'inactive',
          },
        },
        transcriptionMode: isCloud ? 'cloud' : 'off',
        transcriptionStates: {
          microphone: {
            phase: isCloud && request.sources.includes('microphone') ? 'streaming' : 'off',
            errorMessage: null,
          },
          system: {
            phase: isCloud && request.sources.includes('system') ? 'streaming' : 'off',
            errorMessage: null,
          },
        },
        startedAtMs: FIXTURE_TIME_MS,
      }
      publish({ type: 'capture.status', snapshot: copySnapshot(snapshot) })
      return copySnapshot(snapshot)
    },
    async stopSession(): Promise<void> {
      snapshot = emptySnapshot()
      publish({ type: 'capture.status', snapshot: copySnapshot(snapshot) })
    },
    async requestSuggestion(): Promise<void> {
      if (snapshot.sessionId === null) throw new Error('No active session')
      this.emit({ type: 'suggestion.ready', sessionId: snapshot.sessionId, suggestion: fixtureSuggestion })
    },
    async getSnapshot(): Promise<SessionSnapshot> {
      return copySnapshot(snapshot)
    },
    toggleDockCalls: 0,
    showDockCalls: 0,
    hideDockCalls: 0,
    minimizeMainWindowCalls: 0,
    restoreMainWindowCalls: 0,
    lastToggleOptions: undefined,
    async toggleDock(options?: { minimizeMain?: boolean }): Promise<void> {
      this.toggleDockCalls += 1
      this.lastToggleOptions = options
    },
    async showDock(options?: { minimizeMain?: boolean }): Promise<void> {
      this.showDockCalls += 1
    },
    async hideDock(): Promise<void> {
      this.hideDockCalls += 1
    },
    async minimizeMainWindow(): Promise<void> {
      this.minimizeMainWindowCalls += 1
    },
    async restoreMainWindow(): Promise<void> {
      this.restoreMainWindowCalls += 1
    },
    dockState: false,
    async isDocked(): Promise<boolean> {
      return this.dockState
    },
    setDockedState(isDocked: boolean): void {
      this.dockState = isDocked
      for (const listener of dockListeners) listener(isDocked)
    },
    onDockStateChange(listener: (isDocked: boolean) => void): () => void {
      dockListeners.add(listener)
      return () => dockListeners.delete(listener)
    },
    subscribe(listener: (event: SessionEvent) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(event: SessionEvent): void {
      if (event.type === 'capture.status') {
        snapshot = copySnapshot(event.snapshot)
      } else if (event.type === 'capture.level' && event.sessionId === snapshot.sessionId) {
        snapshot.sourceStates[event.source] = {
          ...snapshot.sourceStates[event.source],
          levelRms: event.levelRms,
          peak: event.peak,
          processedFrames: event.processedFrames,
        }
      } else if (event.type === 'transcription.status' && event.sessionId === snapshot.sessionId) {
        if (!snapshot.transcriptionStates) {
          snapshot.transcriptionStates = {
            microphone: { phase: 'off', errorMessage: null },
            system: { phase: 'off', errorMessage: null },
          }
        }
        snapshot.transcriptionStates[event.source] = { ...event.state }
      } else if (event.type === 'transcript.final' && event.sessionId === snapshot.sessionId) {
        snapshot.transcript = [...snapshot.transcript.filter((turn) => turn.id !== event.turn.id), event.turn]
      } else if (event.type === 'suggestion.ready' && event.sessionId === snapshot.sessionId) {
        snapshot.suggestions = [...snapshot.suggestions, event.suggestion]
      } else if (event.type === 'session.error' && event.sessionId === snapshot.sessionId) {
        snapshot.errorMessage = event.message
        if (!event.recoverable) snapshot.phase = 'error'
      }
      publish(event)
    },
  }
}
