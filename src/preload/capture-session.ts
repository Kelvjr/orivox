import type { CaptureSource, OrivoxBridge, SessionEvent, SessionSnapshot, SessionStartRequest, TranscriptTurn, TranscriptionSourceState } from '../shared/contracts'
import { PcmCapture } from './pcm-capture'

type Port = {
  authorize(request: SessionStartRequest): Promise<{ sessionId: string }>
  release(sessionId: string): Promise<unknown>
  streamFrame?(sessionId: string, source: CaptureSource, pcm: Uint8Array): void
}

type Resource = {
  stream: MediaStream
  context: AudioContext
  input: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  pcmCapture: PcmCapture | null
  timer: ReturnType<typeof setInterval>
  processedFrames: number
  levelRms: number
  peak: number
}

const idle = (): SessionSnapshot => ({
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

const copy = (snapshot: SessionSnapshot): SessionSnapshot => ({
  ...snapshot,
  activeSources: [...snapshot.activeSources],
  sourceStates: {
    microphone: { ...snapshot.sourceStates.microphone },
    system: { ...snapshot.sourceStates.system },
  },
  transcriptionStates: snapshot.transcriptionStates
    ? {
        microphone: { ...snapshot.transcriptionStates.microphone },
        system: { ...snapshot.transcriptionStates.system },
      }
    : undefined,
  transcript: snapshot.transcript.map((turn) => ({ ...turn })),
  suggestions: [...snapshot.suggestions],
})

function describeError(source: CaptureSource, error: unknown): { code: string; message: string } {
  if (error instanceof Error && error.message.includes('cloud-audio consent')) {
    return { code: 'cloud-consent-required', message: 'Fresh cloud-audio consent is required for this session.' }
  }
  if (error instanceof Error && error.message.includes('Deepgram API key')) {
    return { code: 'transcription-key-missing', message: 'Cloud transcription needs a Deepgram API key configured locally.' }
  }
  if (error instanceof Error && error.message.includes('protected Deepgram credential')) {
    return { code: 'transcription-key-unavailable', message: 'The protected Deepgram credential could not be read. Reconfigure the key and try again.' }
  }
  if (error instanceof Error && error.message === 'Cloud audio transport is unavailable') {
    return { code: 'transcription-unavailable', message: error.message }
  }
  const name = error instanceof DOMException ? error.name : ''
  const label = source === 'microphone' ? 'Microphone' : 'System audio'
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return { code: 'permission-denied', message: `${label} permission was denied. Check Windows and app permissions.` }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { code: 'device-unavailable', message: `${label} is unavailable. Check the device and try again.` }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { code: 'device-busy', message: `${label} could not be opened. Another app or setting may be blocking it.` }
  }
  return { code: 'capture-failed', message: `${label} capture failed. Stop and try again.` }
}

/** Owns local capture resources; cloud PCM tap is opt-in per session. */
export class CaptureSession implements OrivoxBridge {
  private snapshot: SessionSnapshot = idle()
  private readonly listeners = new Set<(event: SessionEvent) => void>()
  private readonly resources = new Map<CaptureSource, Resource>()
  private generation = 0
  private startPending = false
  private releasedSessionId: string | null = null

  constructor(private readonly port: Port) {}

  async startSession(request: SessionStartRequest): Promise<SessionSnapshot> {
    if (this.startPending || this.snapshot.sessionId !== null) throw new Error('Stop the current session first')
    if (
      request.consent?.remoteProcessingAccepted !== true ||
      request.consent?.conversationPolicyAcknowledged !== true ||
      !Array.isArray(request.sources) || request.sources.length === 0
    ) throw new Error('Select an audio source and confirm session consent')

    this.startPending = true
    this.releasedSessionId = null
    const generation = ++this.generation
    this.snapshot = { ...idle(), phase: 'starting' }
    const cloudRequested = request.transcription?.mode === 'cloud'
    if (cloudRequested) {
      this.snapshot.transcriptionMode = 'cloud'
      for (const source of request.sources) {
        this.snapshot.transcriptionStates![source] = { phase: 'connecting', errorMessage: null }
      }
    }
    for (const source of request.sources) this.snapshot.sourceStates[source].phase = 'starting'
    this.publishStatus()
    let sessionId: string | null = null
    let currentSource: CaptureSource = request.sources[0]
    try {
      sessionId = (await this.port.authorize(request)).sessionId
      if (generation !== this.generation) throw new Error('Start cancelled')
      this.snapshot.sessionId = sessionId
      for (const source of request.sources) {
        currentSource = source
        const stream = source === 'microphone'
          ? await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          // Chromium needs a video carrier for display audio. Frames are never read.
          : await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { frameRate: 1 } })
        if (generation !== this.generation) {
          stream.getTracks().forEach((track) => track.stop())
          throw new Error('Start cancelled')
        }
        await this.attach(source, stream, generation, sessionId, cloudRequested)
        this.snapshot.activeSources = [...this.resources.keys()]
        this.snapshot.sourceStates[source].phase = 'active'
        this.publishStatus()
      }
      this.snapshot.phase = 'capturing'
      this.snapshot.startedAtMs = Date.now()
      this.publishStatus()
      return copy(this.snapshot)
    } catch (error) {
      await this.releaseResources()
      if (sessionId !== null) await this.releaseOnce(sessionId)
      if (generation !== this.generation) return copy(this.snapshot)
      const failure = describeError(currentSource, error)
      this.snapshot = { ...idle(), phase: 'error', errorMessage: failure.message }
      this.snapshot.sourceStates[currentSource] = {
        ...this.snapshot.sourceStates[currentSource], phase: 'error', errorMessage: failure.message,
      }
      this.publish({ type: 'session.error', sessionId, source: currentSource, code: failure.code, message: failure.message, recoverable: true })
      this.publishStatus()
      throw new Error(failure.message)
    } finally {
      this.startPending = false
    }
  }

  async stopSession(): Promise<void> {
    ++this.generation
    const sessionId = this.snapshot.sessionId
    this.snapshot.phase = 'stopping'
    this.publishStatus()
    await this.releaseResources()
    if (sessionId !== null) await this.releaseOnce(sessionId)
    this.snapshot = idle()
    this.publishStatus()
  }

  async requestSuggestion(): Promise<void> { throw new Error('Suggestions are not available in M1') }
  async getSnapshot(): Promise<SessionSnapshot> { return copy(this.snapshot) }
  acceptTranscriptionStatus(sessionId: string, source: CaptureSource, state: TranscriptionSourceState): boolean {
    if (this.snapshot.sessionId !== sessionId || this.snapshot.transcriptionMode !== 'cloud') return false
    const current = this.snapshot.transcriptionStates?.[source]
    if (!current || current.phase === 'off') return false
    if (!['connecting', 'streaming', 'reconnecting', 'error'].includes(state.phase)) return false
    if (state.errorMessage !== null && (typeof state.errorMessage !== 'string' || state.errorMessage.length > 500)) return false
    this.snapshot.transcriptionStates![source] = { phase: state.phase, errorMessage: state.errorMessage }
    this.publish({ type: 'transcription.status', sessionId, source, state: { ...state } })
    this.publishStatus()
    return true
  }

  acceptInterimTranscript(sessionId: string, source: CaptureSource, turnId: string, text: string, observedAtMs: number): boolean {
    if (this.snapshot.sessionId !== sessionId || this.snapshot.transcriptionMode !== 'cloud') return false
    if (this.snapshot.transcriptionStates?.[source]?.phase === 'off') return false
    if (!turnId || turnId.length > 200 || !text.trim() || text.length > 10_000 || !Number.isFinite(observedAtMs)) return false
    this.publish({ type: 'transcript.interim', sessionId, source, turnId, text, observedAtMs })
    return true
  }

  acceptFinalTranscript(sessionId: string, turn: TranscriptTurn): boolean {
    if (this.snapshot.sessionId !== sessionId || this.snapshot.transcriptionMode !== 'cloud' || !this.resources.has(turn.source)) return false
    if (
      typeof turn.id !== 'string' || !turn.id ||
      typeof turn.text !== 'string' || !turn.text.trim() || turn.text.length > 10_000 ||
      !Number.isFinite(turn.startedAtMs) || !Number.isFinite(turn.endedAtMs)
    ) return false
    this.snapshot.transcript = [...this.snapshot.transcript.filter((item) => item.id !== turn.id), { ...turn }]
    this.publish({ type: 'transcript.final', sessionId, turn: { ...turn } })
    this.publishStatus()
    return true
  }
  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async attach(
    source: CaptureSource,
    stream: MediaStream,
    generation: number,
    sessionId: string,
    cloudRequested: boolean,
  ): Promise<void> {
    const track = stream.getAudioTracks()[0]
    if (!track || track.readyState !== 'live') {
      stream.getTracks().forEach((item) => item.stop())
      throw new DOMException('No live audio track', 'NotFoundError')
    }
    let context: AudioContext | null = null
    let pcmCapture: PcmCapture | null = null
    try {
      context = new AudioContext()
      const input = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      input.connect(analyser)
      await context.resume()
      if (generation !== this.generation) throw new Error('Start cancelled')
      if (cloudRequested) {
        if (!this.port.streamFrame) throw new Error('Cloud audio transport is unavailable')
        try {
          pcmCapture = await PcmCapture.attach(context, input, (pcm) => {
            if (generation === this.generation && this.snapshot.sessionId === sessionId) {
              this.port.streamFrame?.(sessionId, source, pcm)
            }
          })
        } catch {
          throw new Error('Cloud audio transport is unavailable')
        }
      }
      if (generation !== this.generation) throw new Error('Start cancelled')
      const samples = new Float32Array(analyser.fftSize)
      const resource: Resource = {
        stream, context, input, analyser, pcmCapture,
        processedFrames: 0, levelRms: 0, peak: 0,
        timer: setInterval(() => {
          if (generation !== this.generation || track.readyState !== 'live') return
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          let peak = 0
          for (const sample of samples) { sum += sample * sample; peak = Math.max(peak, Math.abs(sample)) }
          resource.processedFrames += samples.length
          resource.levelRms = Math.sqrt(sum / samples.length)
          resource.peak = peak
          if (this.snapshot.sessionId !== null) {
            this.snapshot.sourceStates[source] = {
              ...this.snapshot.sourceStates[source],
              levelRms: resource.levelRms,
              peak: resource.peak,
              processedFrames: resource.processedFrames,
            }
            this.publish({
              type: 'capture.level', sessionId: this.snapshot.sessionId, source,
              levelRms: resource.levelRms, peak: resource.peak,
              processedFrames: resource.processedFrames, observedAtMs: Date.now(),
            })
          }
        }, 250),
      }
      for (const item of stream.getTracks()) {
        item.addEventListener('ended', () => { if (generation === this.generation) void this.failEnded(source) }, { once: true })
      }
      this.resources.set(source, resource)
    } catch (error) {
      pcmCapture?.stop()
      stream.getTracks().forEach((item) => item.stop())
      if (context) await context.close().catch(() => undefined)
      throw error
    }
  }

  private async failEnded(source: CaptureSource): Promise<void> {
    const sessionId = this.snapshot.sessionId
    ++this.generation
    await this.releaseResources()
    if (sessionId !== null) await this.releaseOnce(sessionId)
    const message = `${source === 'microphone' ? 'Microphone' : 'System audio'} capture ended unexpectedly.`
    this.snapshot = { ...idle(), phase: 'error', errorMessage: message }
    this.snapshot.sourceStates[source] = { ...this.snapshot.sourceStates[source], phase: 'error', errorMessage: message }
    this.publish({ type: 'session.error', sessionId, source, code: 'source-ended', message, recoverable: true })
    this.publishStatus()
  }

  private async releaseResources(): Promise<void> {
    const resources = [...this.resources.values()]
    this.resources.clear()
    for (const resource of resources) {
      clearInterval(resource.timer)
      try { resource.pcmCapture?.stop() } catch { /* Continue releasing devices. */ }
      for (const track of resource.stream.getTracks()) {
        try { track.stop() } catch { /* Continue releasing other tracks. */ }
      }
      try { resource.input.disconnect() } catch { /* Continue releasing devices. */ }
      try { resource.analyser.disconnect() } catch { /* Continue releasing devices. */ }
    }
    await Promise.all(resources.map((resource) => Promise.resolve().then(() => resource.context.close()).catch(() => undefined)))
    this.snapshot.activeSources = []
    this.snapshot.sourceStates.microphone.phase = 'inactive'
    this.snapshot.sourceStates.system.phase = 'inactive'
  }

  private publishStatus(): void { this.publish({ type: 'capture.status', snapshot: copy(this.snapshot) }) }
  private publish(event: SessionEvent): void { for (const listener of this.listeners) listener(event) }

  private async releaseOnce(sessionId: string): Promise<void> {
    if (this.releasedSessionId === sessionId) return
    this.releasedSessionId = sessionId
    await this.port.release(sessionId).catch(() => undefined)
  }
}
