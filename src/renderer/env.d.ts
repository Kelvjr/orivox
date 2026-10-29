/// <reference types="vite/client" />

import type { OrivoxBridge } from '../shared/contracts'

declare global {
  interface Window {
    orivox?: OrivoxBridge
  }
}

export {}
