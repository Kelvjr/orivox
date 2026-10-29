import { createElement } from 'react'
import type { ReactElement } from 'react'
import { createMockBridge } from '../shared/fixtures'
import type { MockOrivoxBridge } from '../shared/fixtures'
import type { OrivoxBridge } from '../shared/contracts'
import { App } from './App'

export function verifyMockBridgeShellCompatibility(): {
  element: ReactElement
  mockBridge: MockOrivoxBridge
} {
  const mockBridge = createMockBridge()
  const element = createElement(App, { bridge: mockBridge as OrivoxBridge })
  return { element, mockBridge }
}
