import { randomUUID } from 'node:crypto'
import WebSocket, { type RawData } from 'ws'
import type { CaptureSource, TranscriptTurn } from '../../shared/contracts'

export type TranscriptionConnectionPhase = 'connecting' | 'streaming' | 'reconnecting' | 'error'

export type DeepgramEvent =
  | { type: 'status'; source: CaptureSource; phase: TranscriptionConnectionPhase; errorMessage: string | null }
  | { type: 'interim'; source: CaptureSource; turnId: string; text: string; observedAtMs: number }
  | { type: 'final'; turn: TranscriptTurn }

type SocketFactory = (url: string, apiKey: string) => WebSocket

type ResultMessage = {
  type?: string
  is_final?: boolean
  speech_final?: boolean
  start?: number
  duration?: number
  channel?: { alternatives?: Array<{ transcript?: string }> }
}

type Route = {
  source: CaptureSource
  socket: WebSocket | null
  retryTimer: ReturnType<typeof setTimeout> | null
  keepAliveTimer: ReturnType<typeof setInterval> | null
  attempts: number
  generation: number
  connectedAtMs: number
  lastAudioAtMs: number
  turnId: string
  finalSegments: string[]
  turnStartedAtMs: number | null
  turnEndedAtMs: number | null
}

const MAX_FRAME_BYTES = 6_400 // 200 ms of mono 16 kHz signed PCM16.
const MAX_BUFFERED_BYTES = 256_000
const MAX_RETRIES = 3

function endpoint(): string {
  const url = new URL('wss://api.deepgram.com/v1/listen')
  url.searchParams.set('model', 'nova-3')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('encoding', 'linear16')
  url.searchParams.set('sample_rate', '16000')
  url.searchParams.set('channels', '1')
  url.searchParams.set('interim_results', 'true')
  url.searchParams.set('endpointing', '300')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('mip_opt_out', 'true')
  return url.toString()
}

function defaultSocketFactory(url: string, apiKey: string): WebSocket {
  return new WebSocket(url, {
    headers: { Authorization: `Token ${apiKey}` },
    perMessageDeflate: false,
    handshakeTimeout: 10_000,
  })
}

function cleanMessage(value: RawData): ResultMessage | null {
  try {
    const parsed: unknown = JSON.parse(value.toString())
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as ResultMessage
  } catch {
    return null
  }
}

/** Main-process transport only. Never persist samples, transcripts, or the API key. */
export class DeepgramTranscription {
  private readonly routes = new Map<CaptureSource, Route>()
  private stopped = false

  constructor(
    private readonly sessionId: string,
    private readonly apiKey: string,
    private readonly onEvent: (event: DeepgramEvent) => void,
    private readonly socketFactory: SocketFactory = defaultSocketFactory,
  ) {
    if (!sessionId || !apiKey.trim()) throw new Error('Deepgram API key is not configured')
  }

  start(sources: CaptureSource[]): void {
    if (this.stopped || this.routes.size !== 0) throw new Error('Transcription already started or stopped')
    if (sources.length === 0 || new Set(sources).size !== sources.length) throw new Error('Choose distinct transcription sources')
    for (const source of sources) {
      const route: Route = {
        source, socket: null, retryTimer: null, keepAliveTimer: null,
        attempts: 0, generation: 0, connectedAtMs: 0, lastAudioAtMs: 0,
        turnId: randomUUID(), finalSegments: [], turnStartedAtMs: null, turnEndedAtMs: null,
      }
      this.routes.set(source, route)
      this.connect(route)
    }
  }

  sendFrame(sessionId: string, source: CaptureSource, pcm: Uint8Array): boolean {
    if (this.stopped || sessionId !== this.sessionId) return false
    const route = this.routes.get(source)
    const socket = route?.socket
    if (!route || !socket || socket.readyState !== WebSocket.OPEN) return false
    if (pcm.byteLength === 0 || pcm.byteLength > MAX_FRAME_BYTES || pcm.byteLength % 2 !== 0) return false
    if (socket.bufferedAmount + pcm.byteLength > MAX_BUFFERED_BYTES) return false
    try {
      socket.send(pcm, { binary: true })
      route.lastAudioAtMs = Date.now()
      return true
    } catch {
      socket.terminate()
      return false
    }
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const route of this.routes.values()) {
      ++route.generation
      if (route.retryTimer) clearTimeout(route.retryTimer)
      if (route.keepAliveTimer) clearInterval(route.keepAliveTimer)
      route.retryTimer = null
      route.keepAliveTimer = null
      route.finalSegments = []
      try { route.socket?.terminate() } catch { /* Continue closing the other source. */ }
      route.socket = null
    }
    this.routes.clear()
  }

  private connect(route: Route): void {
    if (this.stopped) return
    const generation = ++route.generation
    this.onEvent({
      type: 'status', source: route.source,
      phase: route.attempts === 0 ? 'connecting' : 'reconnecting', errorMessage: null,
    })
    let socket: WebSocket
    try {
      socket = this.socketFactory(endpoint(), this.apiKey)
    } catch {
      this.retry(route, generation)
      return
    }
    route.socket = socket
    socket.on('open', () => {
      if (this.stopped || route.generation !== generation) return
      route.connectedAtMs = Date.now()
      route.lastAudioAtMs = 0
      this.onEvent({ type: 'status', source: route.source, phase: 'streaming', errorMessage: null })
      route.keepAliveTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN && Date.now() - route.lastAudioAtMs > 4_000) {
          socket.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 4_000)
    })
    socket.on('message', (data: RawData) => {
      if (this.stopped || route.generation !== generation) return
      const message = cleanMessage(data)
      if (message) this.handleMessage(route, message)
    })
    socket.on('error', () => {
      // The close event follows; do not expose errors that may include request details.
    })
    socket.on('unexpected-response', (_request, response) => {
      if (this.stopped || route.generation !== generation) return
      ++route.generation // Ignore the close event caused by terminate().
      route.socket = null
      socket.terminate()
      if (response.statusCode === 401 || response.statusCode === 403) {
        this.onEvent({ type: 'status', source: route.source, phase: 'error', errorMessage: 'Deepgram rejected transcription credentials or access.' })
      } else {
        this.retry(route, route.generation)
      }
    })
    socket.on('close', (code: number) => {
      if (this.stopped || route.generation !== generation) return
      if (route.keepAliveTimer) clearInterval(route.keepAliveTimer)
      route.keepAliveTimer = null
      route.socket = null
      this.flushFinal(route)
      if (route.connectedAtMs > 0 && Date.now() - route.connectedAtMs >= 30_000) route.attempts = 0
      route.connectedAtMs = 0
      if (code === 1008 || code === 4001 || code === 4401) {
        this.onEvent({ type: 'status', source: route.source, phase: 'error', errorMessage: 'Deepgram rejected transcription credentials or access.' })
        return
      }
      this.retry(route, generation)
    })
  }

  private retry(route: Route, generation: number): void {
    if (this.stopped || route.generation !== generation) return
    if (route.attempts >= MAX_RETRIES) {
      this.onEvent({ type: 'status', source: route.source, phase: 'error', errorMessage: 'Transcription connection failed. Stop and start a new session to retry.' })
      return
    }
    const delay = Math.min(1_000 * 2 ** route.attempts, 4_000)
    ++route.attempts
    this.onEvent({ type: 'status', source: route.source, phase: 'reconnecting', errorMessage: 'Connection interrupted; transcript may have a gap.' })
    route.retryTimer = setTimeout(() => {
      route.retryTimer = null
      this.connect(route)
    }, delay)
  }

  private handleMessage(route: Route, message: ResultMessage): void {
    if (message.type !== 'Results') return
    const text = message.channel?.alternatives?.[0]?.transcript?.trim() ?? ''
    if (!text) {
      if (message.speech_final) this.flushFinal(route)
      return
    }
    const start = typeof message.start === 'number' && Number.isFinite(message.start) ? message.start : 0
    const duration = typeof message.duration === 'number' && Number.isFinite(message.duration) ? message.duration : 0
    const startedAtMs = route.connectedAtMs + Math.max(0, start) * 1_000
    const endedAtMs = startedAtMs + Math.max(0, duration) * 1_000
    if (route.turnStartedAtMs === null) route.turnStartedAtMs = startedAtMs
    route.turnEndedAtMs = endedAtMs
    if (message.is_final) route.finalSegments.push(text)
    if (message.speech_final) {
      this.flushFinal(route)
      return
    }
    const hypothesis = [...route.finalSegments, ...(message.is_final ? [] : [text])].join(' ').trim()
    if (hypothesis) this.onEvent({ type: 'interim', source: route.source, turnId: route.turnId, text: hypothesis, observedAtMs: Date.now() })
  }

  private flushFinal(route: Route): void {
    const text = route.finalSegments.join(' ').trim()
    if (text) {
      const now = Date.now()
      this.onEvent({
        type: 'final',
        turn: {
          id: route.turnId, source: route.source, text,
          startedAtMs: route.turnStartedAtMs ?? now,
          endedAtMs: route.turnEndedAtMs ?? now,
        },
      })
    }
    route.turnId = randomUUID()
    route.finalSegments = []
    route.turnStartedAtMs = null
    route.turnEndedAtMs = null
  }
}
