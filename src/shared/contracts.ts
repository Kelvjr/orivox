/** Capture routes are not verified speaker identities. */
export type CaptureSource = 'microphone' | 'system'

export type SessionPhase = 'idle' | 'starting' | 'capturing' | 'stopping' | 'error'

export interface SessionStartRequest {
  sources: CaptureSource[]
  consent: {
    remoteProcessingAccepted: true
    conversationPolicyAcknowledged: true
  }
  selectedDocumentIds: string[]
}

export interface TranscriptTurn {
  id: string
  source: CaptureSource
  text: string
  startedAtMs: number
  endedAtMs: number
}

export interface SuggestionCitation {
  kind: 'document' | 'transcript'
  refId: string
  label: string
}

export interface Suggestion {
  id: string
  trigger: 'manual' | 'question'
  text: string
  citations: SuggestionCitation[]
  createdAtMs: number
}

export interface SessionSnapshot {
  sessionId: string | null
  phase: SessionPhase
  activeSources: CaptureSource[]
  startedAtMs: number | null
  transcript: TranscriptTurn[]
  suggestions: Suggestion[]
  errorMessage: string | null
}

export type SessionEvent =
  | { type: 'capture.status'; snapshot: SessionSnapshot }
  | {
      type: 'transcript.delta'
      sessionId: string
      turnId: string
      source: CaptureSource
      delta: string
      observedAtMs: number
    }
  | { type: 'transcript.final'; sessionId: string; turn: TranscriptTurn }
  | { type: 'suggestion.ready'; sessionId: string; suggestion: Suggestion }
  | {
      type: 'session.error'
      sessionId: string | null
      code: string
      message: string
      recoverable: boolean
      source?: CaptureSource
    }

/** The renderer's only session-facing API. Main must validate every invocation. */
export interface OrivoxBridge {
  startSession(request: SessionStartRequest): Promise<SessionSnapshot>
  stopSession(): Promise<void>
  requestSuggestion(): Promise<void>
  getSnapshot(): Promise<SessionSnapshot>
  subscribe(listener: (event: SessionEvent) => void): () => void
}
