import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
  transcribers: [] as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; sendFrame: ReturnType<typeof vi.fn> }>,
}))

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/orivox-test-user-data-not-present' },
  safeStorage: { isAsyncEncryptionAvailable: async () => true, encryptStringAsync: async () => Buffer.from(''), decryptStringAsync: async () => ({ result: '', shouldReEncrypt: false }) },
  desktopCapturer: { getSources: vi.fn(async () => []) },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocks.handlers.set(channel, handler),
    removeHandler: (channel: string) => mocks.handlers.delete(channel),
    on: (channel: string, listener: (...args: unknown[]) => unknown) => mocks.listeners.set(channel, listener),
    removeListener: (channel: string) => mocks.listeners.delete(channel),
  },
}))

vi.mock('./transcription/deepgram', () => ({
  DeepgramTranscription: class {
    start = vi.fn()
    stop = vi.fn()
    sendFrame = vi.fn()
    constructor() { mocks.transcribers.push(this) }
  },
}))

import { registerCaptureAuthorization } from './capture-authorization'

const legacy = {
  sources: ['microphone', 'system'],
  consent: { remoteProcessingAccepted: true, conversationPolicyAcknowledged: true },
  selectedDocumentIds: [],
}

function setup() {
  const mainFrame = {}
  const webContents = {
    mainFrame, isDestroyed: () => false, send: vi.fn(),
    session: {
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      setDisplayMediaRequestHandler: vi.fn(),
    },
  }
  const registration = registerCaptureAuthorization({ webContents } as never)
  const sender = { sender: webContents, senderFrame: mainFrame }
  const authorize = mocks.handlers.get('orivox:capture:authorize') as (sender: unknown, request: unknown) => Promise<{ sessionId: string }>
  const release = mocks.handlers.get('orivox:capture:release') as (sender: unknown, sessionId: string) => boolean
  const frame = mocks.listeners.get('orivox:transcription:frame') as (sender: unknown, value: unknown) => void
  return { registration, sender, authorize, release, frame, webContents }
}

beforeEach(() => {
  mocks.handlers.clear()
  mocks.listeners.clear()
  mocks.transcribers.length = 0
  vi.stubEnv('DEEPGRAM_API_KEY', '')
})

afterEach(() => vi.unstubAllEnvs())

describe('Main capture/transcription authorization', () => {
  it('keeps a legacy M1 capture request strictly local', async () => {
    const { registration, sender, authorize, release } = setup()
    const { sessionId } = await authorize(sender, legacy)
    expect(mocks.transcribers).toHaveLength(0)
    expect(release(sender, sessionId)).toBe(true)
    registration.dispose()
  })

  it('rejects cloud mode without fresh consent or a configured key', async () => {
    const { registration, sender, authorize } = setup()
    await expect(authorize(sender, { ...legacy, transcription: { mode: 'cloud', provider: 'deepgram' } })).rejects.toThrow('Fresh cloud-audio consent')
    await expect(authorize(sender, {
      ...legacy,
      transcription: { mode: 'cloud', provider: 'deepgram', cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' } },
    })).rejects.toThrow('Deepgram API key')
    expect(mocks.transcribers).toHaveLength(0)
    registration.dispose()
  })

  it('accepts only authorized session/source PCM and releases both streams on Stop', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'synthetic-key')
    const { registration, sender, authorize, release, frame, webContents } = setup()
    const { sessionId } = await authorize(sender, {
      ...legacy,
      transcription: { mode: 'cloud', provider: 'deepgram', cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' } },
    })
    expect(mocks.transcribers).toHaveLength(1)
    expect(mocks.transcribers[0].start).toHaveBeenCalledWith(['microphone', 'system'])
    const pcm = new Uint8Array(640)
    frame(sender, { sessionId, source: 'microphone', pcm })
    frame(sender, { sessionId, source: 'system', pcm })
    frame({ sender: {}, senderFrame: {} }, { sessionId, source: 'microphone', pcm })
    frame(sender, { sessionId: 'wrong', source: 'microphone', pcm })
    frame(sender, { sessionId, source: 'camera', pcm })
    expect(mocks.transcribers[0].sendFrame).toHaveBeenCalledTimes(2)
    expect(mocks.transcribers[0].sendFrame).toHaveBeenCalledWith(sessionId, 'microphone', pcm)
    expect(mocks.transcribers[0].sendFrame).toHaveBeenCalledWith(sessionId, 'system', pcm)
    expect(release(sender, sessionId)).toBe(true)
    expect(mocks.transcribers[0].stop).toHaveBeenCalledOnce()
    frame(sender, { sessionId, source: 'microphone', pcm })
    expect(mocks.transcribers[0].sendFrame).toHaveBeenCalledTimes(2)
    expect(webContents.send).not.toHaveBeenCalled()
    registration.dispose()
  })
})
