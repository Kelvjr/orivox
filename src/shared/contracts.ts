/** Capture routes are not verified speaker identities. */
export type CaptureSource = 'microphone' | 'system'

export type SessionPhase = 'idle' | 'starting' | 'capturing' | 'stopping' | 'error'

export type CaptureSourcePhase = 'inactive' | 'starting' | 'active' | 'error'

export interface CaptureSourceState {
  phase: CaptureSourcePhase
  /** Normalized local audio activity; no samples are exposed. */
  levelRms: number
  peak: number
  processedFrames: number
  errorMessage: string | null
}

export interface SessionStartRequest {
  sources: CaptureSource[]
  consent: {
    remoteProcessingAccepted: true
    conversationPolicyAcknowledged: true
  }
  selectedDocumentIds: string[]
  transcription?: TranscriptionRequest
}

export type TranscriptionRequest =
  | { mode: 'off' }
  | {
      mode: 'cloud'
      provider: 'deepgram'
      cloudConsent: { audioTransferAccepted: true; disclosureVersion: 'm2-v1' }
    }

export type TranscriptionPhase = 'off' | 'connecting' | 'streaming' | 'reconnecting' | 'error'

export interface TranscriptionSourceState {
  phase: TranscriptionPhase
  errorMessage: string | null
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
  sourceStates: Record<CaptureSource, CaptureSourceState>
  transcriptionMode?: 'off' | 'cloud'
  transcriptionStates?: Record<CaptureSource, TranscriptionSourceState>
  startedAtMs: number | null
  transcript: TranscriptTurn[]
  suggestions: Suggestion[]
  errorMessage: string | null
}

export type SessionEvent =
  | { type: 'capture.status'; snapshot: SessionSnapshot }
  | {
      type: 'capture.level'
      sessionId: string
      source: CaptureSource
      levelRms: number
      peak: number
      processedFrames: number
      observedAtMs: number
    }
  | {
      type: 'transcription.status'
      sessionId: string
      source: CaptureSource
      state: TranscriptionSourceState
    }
  | {
      type: 'transcript.interim'
      sessionId: string
      turnId: string
      source: CaptureSource
      text: string
      observedAtMs: number
    }
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
  toggleDock?(options?: { minimizeMain?: boolean }): Promise<boolean | void>
  showDock?(options?: { minimizeMain?: boolean }): Promise<void>
  hideDock?(): Promise<void>
  isDocked?(): Promise<boolean>
  minimizeMainWindow?(): Promise<void>
  restoreMainWindow?(): Promise<void>
  onDockStateChange?(listener: (isDocked: boolean) => void): () => void
}
