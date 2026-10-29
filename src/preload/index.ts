import { contextBridge } from 'electron'
import type { OrivoxBridge, SessionSnapshot } from '../shared/contracts'

// M0 only: the real validated IPC implementation belongs to a later milestone.
const idleSnapshot: SessionSnapshot = {
  sessionId: null,
  phase: 'idle',
  activeSources: [],
  startedAtMs: null,
  transcript: [],
  suggestions: [],
  errorMessage: null,
}

const unimplemented = (): never => {
  throw new Error('This Orivox feature is not implemented in M0')
}

const bridge: OrivoxBridge = {
  startSession: async () => unimplemented(),
  stopSession: async () => unimplemented(),
  requestSuggestion: async () => unimplemented(),
  getSnapshot: async () => ({ ...idleSnapshot, activeSources: [], transcript: [], suggestions: [] }),
  subscribe: () => () => undefined,
}

contextBridge.exposeInMainWorld('orivox', bridge)
