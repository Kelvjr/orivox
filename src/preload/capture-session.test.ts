import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent, SessionStartRequest } from '../shared/contracts'
import { CaptureSession } from './capture-session'

const request: SessionStartRequest = {
  sources: ['microphone', 'system'],
  consent: { remoteProcessingAccepted: true, conversationPolicyAcknowledged: true },
  selectedDocumentIds: [],
}

class FakeTrack {
  readyState: 'live' | 'ended' = 'live'
  private ended: (() => void) | null = null
  stop = vi.fn(() => { this.readyState = 'ended' })
  addEventListener(_name: string, listener: () => void): void { this.ended = listener }
  endExternally(): void { this.readyState = 'ended'; this.ended?.() }
}

function fakeStream(audio: FakeTrack[], video: FakeTrack[] = []): MediaStream {
  return {
    getAudioTracks: () => audio,
    getTracks: () => [...audio, ...video],
  } as unknown as MediaStream
}

const contexts: Array<{ close: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn> }> = []
const worklets: FakeWorkletNode[] = []

class FakeWorkletNode {
  port = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: vi.fn() }
  connect = vi.fn()
  disconnect = vi.fn()
  constructor() { worklets.push(this) }
}

class FakeAudioContext {
  close = vi.fn(async () => undefined)
  resume = vi.fn(async () => undefined)
  read = vi.fn((samples: Float32Array) => samples.fill(0.25))
  audioWorklet = { addModule: vi.fn(async () => undefined) }
  destination = {} as AudioDestinationNode
  constructor() { contexts.push(this) }
  createMediaStreamSource(): MediaStreamAudioSourceNode {
    return { connect: vi.fn(), disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode
  }
  createAnalyser(): AnalyserNode {
    return { fftSize: 2048, getFloatTimeDomainData: this.read, disconnect: vi.fn() } as unknown as AnalyserNode
  }
  createGain(): GainNode {
    return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode
  }
}

const port = () => ({
  authorize: vi.fn(async () => ({ sessionId: 'session-test' })),
  release: vi.fn(async () => true),
})

beforeEach(() => {
  contexts.length = 0
  worklets.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)
  vi.stubGlobal('document', { baseURI: 'file:///orivox/index.html' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CaptureSession', () => {
  it('keeps both sources separate and Stop releases every track and analyser', async () => {
    const mic = new FakeTrack()
    const system = new FakeTrack()
    const displayCarrier = new FakeTrack()
    const mediaDevices = {
      getUserMedia: vi.fn(async () => fakeStream([mic])),
      getDisplayMedia: vi.fn(async () => fakeStream([system], [displayCarrier])),
    }
    vi.stubGlobal('navigator', { mediaDevices })
    const channel = port()
    const capture = new CaptureSession(channel)
    const events: SessionEvent[] = []
    capture.subscribe((event) => events.push(event))

    const started = await capture.startSession(request)
    expect(started.phase).toBe('capturing')
    expect(started.activeSources).toEqual(['microphone', 'system'])
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
    expect(mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ audio: true, video: { frameRate: 1 } })
    vi.advanceTimersByTime(500)
    expect(contexts).toHaveLength(2)
    expect(contexts[0].read).toHaveBeenCalled()
    expect(contexts[1].read).toHaveBeenCalled()

    await capture.stopSession()
    await capture.stopSession()
    expect(mic.stop).toHaveBeenCalled()
    expect(system.stop).toHaveBeenCalled()
    expect(displayCarrier.stop).toHaveBeenCalled()
    expect(contexts.every((context) => context.close.mock.calls.length === 1)).toBe(true)
    expect(channel.release).toHaveBeenCalledTimes(1)
    expect((await capture.getSnapshot()).phase).toBe('idle')
    expect((await capture.getSnapshot()).activeSources).toEqual([])
    const readsAfterStop = contexts.map((context) => context.read.mock.calls.length)
    vi.advanceTimersByTime(500)
    expect(contexts.map((context) => context.read.mock.calls.length)).toEqual(readsAfterStop)
    expect(events.some((event) => event.type === 'capture.status' && event.snapshot.phase === 'idle')).toBe(true)
  })

  it('reports denied microphone permission without opening system capture', async () => {
    const mediaDevices = {
      getUserMedia: vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError') }),
      getDisplayMedia: vi.fn(),
    }
    vi.stubGlobal('navigator', { mediaDevices })
    const channel = port()
    const capture = new CaptureSession(channel)
    const events: SessionEvent[] = []
    capture.subscribe((event) => events.push(event))
    await expect(capture.startSession(request)).rejects.toThrow('Microphone permission was denied')
    expect(mediaDevices.getDisplayMedia).not.toHaveBeenCalled()
    expect(channel.release).toHaveBeenCalledOnce()
    expect((await capture.getSnapshot()).phase).toBe('error')
    expect(events.some((event) => event.type === 'session.error' && event.code === 'permission-denied')).toBe(true)
  })

  it('rolls back the microphone when system audio is unavailable', async () => {
    const mic = new FakeTrack()
    vi.stubGlobal('navigator', { mediaDevices: {
      getUserMedia: vi.fn(async () => fakeStream([mic])),
      getDisplayMedia: vi.fn(async () => { throw new DOMException('Missing', 'NotFoundError') }),
    } })
    const channel = port()
    const capture = new CaptureSession(channel)
    await expect(capture.startSession(request)).rejects.toThrow('System audio is unavailable')
    expect(mic.stop).toHaveBeenCalled()
    expect(contexts[0].close).toHaveBeenCalledOnce()
    expect(channel.release).toHaveBeenCalledOnce()
    expect((await capture.getSnapshot()).activeSources).toEqual([])
  })

  it('stops a stream that resolves after Stop was pressed during startup', async () => {
    const mic = new FakeTrack()
    let resolveMic!: (stream: MediaStream) => void
    vi.stubGlobal('navigator', { mediaDevices: {
      getUserMedia: vi.fn(() => new Promise<MediaStream>((resolve) => { resolveMic = resolve })),
      getDisplayMedia: vi.fn(),
    } })
    const channel = port()
    const capture = new CaptureSession(channel)
    const starting = capture.startSession({ ...request, sources: ['microphone'] })
    await Promise.resolve()
    await capture.stopSession()
    resolveMic(fakeStream([mic]))
    await starting
    expect(mic.stop).toHaveBeenCalledOnce()
    expect(channel.release).toHaveBeenCalledOnce()
    expect((await capture.getSnapshot()).phase).toBe('idle')
  })

  it('streams PCM only for a separately consented cloud session and stops the tap', async () => {
    const mic = new FakeTrack()
    vi.stubGlobal('navigator', { mediaDevices: {
      getUserMedia: vi.fn(async () => fakeStream([mic])),
      getDisplayMedia: vi.fn(),
    } })
    const channel = { ...port(), streamFrame: vi.fn() }
    const capture = new CaptureSession(channel)
    const events: SessionEvent[] = []
    capture.subscribe((event) => events.push(event))
    await capture.startSession({
      ...request, sources: ['microphone'],
      transcription: {
        mode: 'cloud', provider: 'deepgram',
        cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' },
      },
    } as SessionStartRequest)
    expect(worklets).toHaveLength(1)
    expect((contexts[0] as FakeAudioContext).audioWorklet.addModule).toHaveBeenCalledOnce()
    worklets[0].port.onmessage?.({ data: { type: 'pcm', pcm: new ArrayBuffer(640) } } as MessageEvent)
    expect(channel.streamFrame).toHaveBeenCalledWith('session-test', 'microphone', expect.any(Uint8Array))
    expect(capture.acceptTranscriptionStatus('session-test', 'system', { phase: 'streaming', errorMessage: null })).toBe(false)
    expect(capture.acceptTranscriptionStatus('session-test', 'microphone', { phase: 'streaming', errorMessage: null })).toBe(true)
    expect(capture.acceptInterimTranscript('session-test', 'microphone', 'turn-1', 'A provisional phrase', 5)).toBe(true)
    expect(events).toContainEqual({ type: 'transcription.status', sessionId: 'session-test', source: 'microphone', state: { phase: 'streaming', errorMessage: null } })
    expect(events).toContainEqual({ type: 'transcript.interim', sessionId: 'session-test', source: 'microphone', turnId: 'turn-1', text: 'A provisional phrase', observedAtMs: 5 })
    expect((await capture.getSnapshot()).transcriptionStates?.microphone.phase).toBe('streaming')
    capture.acceptFinalTranscript('wrong-session', { id: 'ignored', source: 'microphone', text: 'Wrong session', startedAtMs: 1, endedAtMs: 2 })
    capture.acceptFinalTranscript('session-test', { id: 'turn-1', source: 'microphone', text: 'A final utterance', startedAtMs: 1, endedAtMs: 2 })
    expect((await capture.getSnapshot()).transcript.map((turn) => turn.text)).toEqual(['A final utterance'])
    await capture.stopSession()
    expect(worklets[0].port.postMessage).toHaveBeenCalledWith({ type: 'stop' })
    expect(worklets[0].disconnect).toHaveBeenCalledOnce()
    expect(mic.stop).toHaveBeenCalledOnce()
    expect(channel.release).toHaveBeenCalledOnce()
    expect(worklets[0].port.onmessage).toBeNull()
    expect((await capture.getSnapshot()).transcript).toEqual([])
    expect((await capture.getSnapshot()).transcriptionMode).toBe('off')
    expect(capture.acceptInterimTranscript('session-test', 'microphone', 'turn-2', 'Too late', 6)).toBe(false)
    expect(capture.acceptTranscriptionStatus('session-test', 'microphone', { phase: 'streaming', errorMessage: null })).toBe(false)
  })

  it('shows a cloud-consent rejection before opening any capture device', async () => {
    const mediaDevices = { getUserMedia: vi.fn(), getDisplayMedia: vi.fn() }
    vi.stubGlobal('navigator', { mediaDevices })
    const channel = {
      authorize: vi.fn(async () => { throw new Error('Fresh cloud-audio consent is required') }),
      release: vi.fn(),
      streamFrame: vi.fn(),
    }
    const capture = new CaptureSession(channel)
    const events: SessionEvent[] = []
    capture.subscribe((event) => events.push(event))
    await expect(capture.startSession(request)).rejects.toThrow('Fresh cloud-audio consent')
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled()
    expect(mediaDevices.getDisplayMedia).not.toHaveBeenCalled()
    expect(channel.streamFrame).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ type: 'session.error', code: 'cloud-consent-required' }))
  })
})
