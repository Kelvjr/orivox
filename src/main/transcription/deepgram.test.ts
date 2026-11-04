import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { DeepgramTranscription, type DeepgramEvent } from './deepgram'

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.CONNECTING
  bufferedAmount = 0
  sent: Array<{ data: unknown; options: unknown }> = []
  terminate = vi.fn(() => { this.readyState = WebSocket.CLOSED })
  send = vi.fn((data: unknown, options?: unknown) => { this.sent.push({ data, options }) })
  open(): void { this.readyState = WebSocket.OPEN; this.emit('open') }
  result(data: unknown): void { this.emit('message', Buffer.from(JSON.stringify(data))) }
  close(code = 1006): void { this.readyState = WebSocket.CLOSED; this.emit('close', code) }
}

const harness = (sources: Array<'microphone' | 'system'> = ['microphone', 'system']) => {
  const sockets: FakeSocket[] = []
  const urls: string[] = []
  const keys: string[] = []
  const events: DeepgramEvent[] = []
  const adapter = new DeepgramTranscription('session-1', 'secret-key', (event) => events.push(event), (url, key) => {
    const socket = new FakeSocket()
    sockets.push(socket)
    urls.push(url)
    keys.push(key)
    return socket as unknown as WebSocket
  })
  adapter.start(sources)
  return { adapter, sockets, urls, keys, events }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('DeepgramTranscription', () => {
  it('opens one opted-out stream per source and never routes audio across sources', () => {
    const { adapter, sockets, urls, keys, events } = harness()
    expect(sockets).toHaveLength(2)
    expect(urls.every((url) => new URL(url).searchParams.get('mip_opt_out') === 'true')).toBe(true)
    expect(urls.every((url) => new URL(url).searchParams.get('sample_rate') === '16000')).toBe(true)
    expect(keys).toEqual(['secret-key', 'secret-key'])
    sockets.forEach((socket) => socket.open())
    const pcm = new Uint8Array(640)
    expect(adapter.sendFrame('session-1', 'microphone', pcm)).toBe(true)
    expect(sockets[0].send).toHaveBeenCalledOnce()
    expect(sockets[1].send).not.toHaveBeenCalled()
    expect(adapter.sendFrame('session-1', 'system', pcm)).toBe(true)
    expect(sockets[1].send).toHaveBeenCalledOnce()
    expect(adapter.sendFrame('wrong-session', 'microphone', pcm)).toBe(false)
    expect(events.filter((event) => event.type === 'status' && event.phase === 'streaming')).toHaveLength(2)
    adapter.stop()
  })

  it('replaces provisional text and emits source-labeled complete utterances', () => {
    const { adapter, sockets, events } = harness()
    sockets.forEach((socket) => socket.open())
    sockets[0].result({ type: 'Results', start: 0, duration: 0.3, is_final: false, speech_final: false, channel: { alternatives: [{ transcript: 'Hel' }] } })
    sockets[0].result({ type: 'Results', start: 0, duration: 0.8, is_final: true, speech_final: false, channel: { alternatives: [{ transcript: 'Hello' }] } })
    sockets[0].result({ type: 'Results', start: 0.8, duration: 0.5, is_final: true, speech_final: true, channel: { alternatives: [{ transcript: 'world' }] } })
    sockets[1].result({ type: 'Results', start: 0, duration: 0.5, is_final: true, speech_final: true, channel: { alternatives: [{ transcript: 'System response' }] } })
    const interim = events.filter((event) => event.type === 'interim')
    expect(interim.map((event) => event.text)).toEqual(['Hel', 'Hello'])
    expect(interim[0].turnId).toBe(interim[1].turnId)
    const finals = events.filter((event) => event.type === 'final')
    expect(finals.map((event) => [event.turn.source, event.turn.text])).toEqual([
      ['microphone', 'Hello world'], ['system', 'System response'],
    ])
    expect(finals[0].turn.id).toBe(interim[0].turnId)
    adapter.stop()
  })

  it('ignores empty silence results, rejects oversized frames, and drops backpressure', () => {
    const { adapter, sockets, events } = harness(['microphone'])
    sockets[0].open()
    sockets[0].result({ type: 'Results', is_final: true, speech_final: true, channel: { alternatives: [{ transcript: '   ' }] } })
    expect(events.some((event) => event.type === 'final')).toBe(false)
    expect(adapter.sendFrame('session-1', 'microphone', new Uint8Array(6401))).toBe(false)
    sockets[0].bufferedAmount = 256_000
    expect(adapter.sendFrame('session-1', 'microphone', new Uint8Array(640))).toBe(false)
    expect(sockets[0].send).not.toHaveBeenCalled()
    adapter.stop()
  })

  it('flushes accumulated final segments when a speech boundary has no text', () => {
    const { adapter, sockets, events } = harness(['microphone'])
    sockets[0].open()
    sockets[0].result({ type: 'Results', start: 0, duration: 0.5, is_final: true, speech_final: false, channel: { alternatives: [{ transcript: 'Hello' }] } })
    sockets[0].result({ type: 'Results', start: 0.5, duration: 0.1, is_final: true, speech_final: true, channel: { alternatives: [{ transcript: '' }] } })
    expect(events.filter((event) => event.type === 'final').map((event) => event.turn.text)).toEqual(['Hello'])
    adapter.stop()
  })

  it('retries a lost source only and Stop cancels pending reconnects', () => {
    const { adapter, sockets, events } = harness()
    sockets.forEach((socket) => socket.open())
    sockets[0].close()
    expect(events.some((event) => event.type === 'status' && event.source === 'microphone' && event.phase === 'reconnecting')).toBe(true)
    vi.advanceTimersByTime(1_000)
    expect(sockets).toHaveLength(3)
    sockets[2].open()
    expect(adapter.sendFrame('session-1', 'system', new Uint8Array(640))).toBe(true)
    sockets[2].close()
    adapter.stop()
    vi.advanceTimersByTime(10_000)
    expect(sockets).toHaveLength(3)
    expect(sockets[1].terminate).toHaveBeenCalledOnce()
    expect(adapter.sendFrame('session-1', 'system', new Uint8Array(640))).toBe(false)
  })

  it('rejects missing credentials before any connection is created', () => {
    expect(() => new DeepgramTranscription('session-1', '', () => undefined)).toThrow('Deepgram API key is not configured')
  })

  it('does not retry an authentication failure or expose the API key in status', () => {
    const { adapter, sockets, events } = harness(['microphone'])
    sockets[0].emit('unexpected-response', {}, { statusCode: 401 })
    vi.advanceTimersByTime(10_000)
    expect(sockets).toHaveLength(1)
    expect(sockets[0].terminate).toHaveBeenCalledOnce()
    const failure = events.find((event) => event.type === 'status' && event.phase === 'error')
    expect(failure).toMatchObject({ source: 'microphone', errorMessage: 'Deepgram rejected transcription credentials or access.' })
    expect(JSON.stringify(events)).not.toContain('secret-key')
    adapter.stop()
  })

  it('releases the second source even if the first socket throws during Stop', () => {
    const { adapter, sockets } = harness()
    sockets.forEach((socket) => socket.open())
    sockets[0].terminate.mockImplementationOnce(() => { throw new Error('socket already closed') })
    expect(() => adapter.stop()).not.toThrow()
    expect(sockets[1].terminate).toHaveBeenCalledOnce()
    expect(adapter.sendFrame('session-1', 'system', new Uint8Array(640))).toBe(false)
  })
})
