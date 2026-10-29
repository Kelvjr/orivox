import type { FC } from 'react'
import type { OrivoxBridge } from '../shared/contracts'

export interface AppProps {
  bridge?: OrivoxBridge
}

export const App: FC<AppProps> = ({ bridge = typeof window !== 'undefined' ? window.orivox : undefined }) => {
  return (
    <main>
      <h1>Orivox</h1>
      <p>Orivox shell initialized. Bridge status: {bridge ? 'available' : 'unavailable'}.</p>
    </main>
  )
}
