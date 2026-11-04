import { randomUUID } from 'node:crypto'
import {
  app,
  desktopCapturer,
  ipcMain,
  safeStorage,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type MediaAccessPermissionRequest,
} from 'electron'
import type { CaptureSource } from '../shared/contracts'
import { validateStartRequest } from './validate-start'
import { validateCloudTranscriptionChoice } from './transcription/cloud-consent'
import { DeepgramCredentialStore } from './transcription/credentials'
import { DeepgramTranscription } from './transcription/deepgram'

const AUTHORIZE_CHANNEL = 'orivox:capture:authorize'
const RELEASE_CHANNEL = 'orivox:capture:release'
const FRAME_CHANNEL = 'orivox:transcription:frame'
const TRANSCRIPTION_EVENT_CHANNEL = 'orivox:transcription:event'

interface AuthorizedSession {
  id: string
  sources: CaptureSource[]
  transcriber: DeepgramTranscription | null
}

export interface CaptureAuthorization {
  dispose(): void
}

/** Main-process gate for media permissions requested by this one local window. */
export function registerCaptureAuthorization(window: BrowserWindow): CaptureAuthorization {
  let authorized: AuthorizedSession | null = null
  const webContents = window.webContents
  const browserSession = webContents.session
  const credentials = new DeepgramCredentialStore(app.getPath('userData'), safeStorage)
  let disposed = false
  const diagnostic = process.env.ORIVOX_M2_DIAGNOSTICS === '1'
  let firstCloudFrameSeen = false
  let cloudFramesReceived = 0
  let cloudFramesSent = 0

  const assertSender = (event: IpcMainInvokeEvent): void => {
    if (disposed || event.sender !== webContents || event.senderFrame !== webContents.mainFrame) {
      throw new Error('Capture request came from an untrusted frame')
    }
  }

  ipcMain.handle(AUTHORIZE_CHANNEL, async (event, value: unknown) => {
    assertSender(event)
    if (authorized !== null) throw new Error('A session is already authorized')
    const request = validateStartRequest(value)
    const transcription = validateCloudTranscriptionChoice(
      value && typeof value === 'object' ? (value as { transcription?: unknown }).transcription : undefined,
    )
    const id = randomUUID()
    let transcriber: DeepgramTranscription | null = null
    if (transcription.mode === 'cloud') {
      const apiKey = await credentials.get()
      if (!apiKey) throw new Error('Cloud transcription needs a Deepgram API key configured locally.')
      if (diagnostic) console.info('[M2 diag] cloud authorization accepted for', request.sources.join(','))
      transcriber = new DeepgramTranscription(id, apiKey, (providerEvent) => {
        const forward = authorized?.id === id
        if (diagnostic) {
          const marker = providerEvent.type === 'status' ? providerEvent.phase : providerEvent.type
          console.info('[M2 diag] provider', providerEvent.type === 'final' ? providerEvent.turn.source : providerEvent.source, marker, forward ? 'forwarded' : 'discarded')
        }
        if (forward) webContents.send(TRANSCRIPTION_EVENT_CHANNEL, { sessionId: id, ...providerEvent })
      })
    }
    if (disposed || webContents.isDestroyed() || authorized !== null) {
      throw new Error('Capture authorization is no longer available.')
    }
    authorized = { id, sources: request.sources, transcriber }
    firstCloudFrameSeen = false
    cloudFramesReceived = 0
    cloudFramesSent = 0
    try {
      transcriber?.start(request.sources)
    } catch {
      transcriber?.stop()
      authorized = null
      throw new Error('Could not start cloud transcription.')
    }
    return { sessionId: authorized.id }
  })

  ipcMain.handle(RELEASE_CHANNEL, (event, sessionId: unknown) => {
    assertSender(event)
    if (typeof sessionId !== 'string' || authorized?.id !== sessionId) return false
    authorized.transcriber?.stop()
    authorized = null
    return true
  })

  const onFrame = (event: Electron.IpcMainEvent, payload: unknown): void => {
    if (event.sender !== webContents || event.senderFrame !== webContents.mainFrame || !authorized?.transcriber) return
    if (!payload || typeof payload !== 'object') return
    const frame = payload as { sessionId?: unknown; source?: unknown; pcm?: unknown }
    if (frame.sessionId !== authorized.id || !authorized.sources.includes(frame.source as CaptureSource)) return
    if (!(frame.pcm instanceof Uint8Array)) return
    ++cloudFramesReceived
    if (diagnostic && !firstCloudFrameSeen) {
      firstCloudFrameSeen = true
      console.info('[M2 diag] first PCM frame accepted for', frame.source)
    }
    if (authorized.transcriber.sendFrame(authorized.id, frame.source as CaptureSource, frame.pcm)) ++cloudFramesSent
    if (diagnostic && cloudFramesReceived % 250 === 0) {
      console.info('[M2 diag] PCM frames', cloudFramesReceived, 'received,', cloudFramesSent, 'sent')
    }
  }
  ipcMain.on(FRAME_CHANNEL, onFrame)

  browserSession.setPermissionCheckHandler((requestingWebContents, permission, _origin, details) => {
    if (requestingWebContents !== webContents || authorized === null || !details.isMainFrame) {
      return false
    }
    if (permission === 'media') {
      return authorized.sources.includes('microphone') && details.mediaType !== 'video'
    }
    return permission === 'display-capture' && authorized.sources.includes('system')
  })

  browserSession.setPermissionRequestHandler((requestingWebContents, permission, callback, details) => {
    if (requestingWebContents !== webContents || authorized === null) {
      callback(false)
      return
    }
    if (permission === 'media') {
      const media = details as MediaAccessPermissionRequest
      callback(
        authorized.sources.includes('microphone') &&
          Array.isArray(media.mediaTypes) &&
          media.mediaTypes.length > 0 &&
          media.mediaTypes.every((type) => type === 'audio'),
      )
      return
    }
    callback(permission === 'display-capture' && authorized.sources.includes('system'))
  })

  browserSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (
        authorized === null ||
        !authorized.sources.includes('system') ||
        !request.audioRequested ||
        !request.videoRequested ||
        request.frame !== webContents.mainFrame
      ) {
        callback(null)
        return
      }
      const requestedSessionId = authorized.id
      void desktopCapturer
        .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          if (authorized?.id !== requestedSessionId || sources.length === 0) {
            callback(null)
            return
          }
          callback({ video: sources[0], audio: 'loopback' })
        })
        .catch(() => callback(null))
    },
    { useSystemPicker: false },
  )

  return {
    dispose(): void {
      disposed = true
      authorized?.transcriber?.stop()
      authorized = null
      ipcMain.removeHandler(AUTHORIZE_CHANNEL)
      ipcMain.removeHandler(RELEASE_CHANNEL)
      ipcMain.removeListener(FRAME_CHANNEL, onFrame)
      browserSession.setDisplayMediaRequestHandler(null)
      browserSession.setPermissionCheckHandler(null)
      browserSession.setPermissionRequestHandler(null)
    },
  }
}
