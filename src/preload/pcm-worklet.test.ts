import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const workletSource = readFileSync(resolve(process.cwd(), 'public/audio/pcm-worklet.js'), 'utf8')

function renderSecond(inputRate: number): { frames: Int16Array[]; processor: { process: (inputs: Float32Array[][]) => boolean; port: { onmessage: ((event: { data: unknown }) => void) | null } } } {
  const frames: Int16Array[] = []
  let Processor!: new () => { process: (inputs: Float32Array[][]) => boolean; port: { onmessage: ((event: { data: unknown }) => void) | null } }
  class Base {
    port = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: (message: { type: string; pcm: ArrayBuffer }) => {
        if (message.type === 'pcm') frames.push(new Int16Array(message.pcm.slice(0)))
      },
    }
  }
  runInNewContext(workletSource, {
    AudioWorkletProcessor: Base,
    sampleRate: inputRate,
    Int16Array,
    Math,
    registerProcessor: (_name: string, implementation: typeof Processor) => { Processor = implementation },
  })
  const processor = new Processor()
  for (let offset = 0; offset < inputRate; offset += 128) {
    const length = Math.min(128, inputRate - offset)
    const samples = new Float32Array(length)
    for (let i = 0; i < length; i += 1) {
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (offset + i) / inputRate)
    }
    processor.process([[samples]])
  }
  return { frames, processor }
}

describe('PCM AudioWorklet', () => {
  it.each([44_100, 48_000])('resamples %i Hz to exactly one second of 16 kHz PCM', (rate) => {
    const { frames, processor } = renderSecond(rate)
    expect(frames).toHaveLength(50)
    expect(frames.every((frame) => frame.length === 320)).toBe(true)
    const samples = frames.flatMap((frame) => [...frame])
    expect(Math.max(...samples)).toBeGreaterThan(14_000)
    expect(Math.min(...samples)).toBeLessThan(-14_000)
    processor.port.onmessage?.({ data: { type: 'stop' } })
    expect(processor.process([[new Float32Array(128)]])).toBe(false)
  })
})
