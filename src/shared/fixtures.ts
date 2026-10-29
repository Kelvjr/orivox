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
}

const emptySnapshot = (): SessionSnapshot => ({
  sessionId: null,
  phase: 'idle',
  activeSources: [],
  startedAtMs: null,
  transcript: [],
  suggestions: [],
  errorMessage: null,
})

const copySnapshot = (value: SessionSnapshot): SessionSnapshot => ({
  ...value,
  activeSources: [...value.activeSources],
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
      snapshot = {
        ...emptySnapshot(),
        sessionId: 'fixture-session',
        phase: 'capturing',
        activeSources: [...new Set<CaptureSource>(request.sources)],
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
    subscribe(listener: (event: SessionEvent) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(event: SessionEvent): void {
      if (event.type === 'capture.status') {
        snapshot = copySnapshot(event.snapshot)
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
