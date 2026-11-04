/* Continuous, source-local 16 kHz mono PCM16 frames. No audio is persisted. */
class OrivoxPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.position = 0
    this.nextOutput = 0
    this.previous = 0
    this.frame = new Int16Array(320)
    this.frameLength = 0
    this.stopped = false
    this.port.onmessage = (event) => {
      if (event.data?.type === 'stop') this.stopped = true
    }
  }

  process(inputs) {
    if (this.stopped) return false
    const input = inputs[0]?.[0]
    if (!input || input.length === 0) return true
    const step = sampleRate / 16000
    for (let i = 0; i < input.length; i += 1) {
      const currentPosition = this.position + i
      const current = input[i]
      const previous = i === 0 ? this.previous : input[i - 1]
      while (this.nextOutput <= currentPosition) {
        const fraction = this.nextOutput - (currentPosition - 1)
        const value = Math.max(-1, Math.min(1, previous + fraction * (current - previous)))
        this.frame[this.frameLength++] = value < 0 ? Math.round(value * 32768) : Math.round(value * 32767)
        this.nextOutput += step
        if (this.frameLength === this.frame.length) {
          this.port.postMessage({ type: 'pcm', pcm: this.frame.buffer }, [this.frame.buffer])
          this.frame = new Int16Array(320)
          this.frameLength = 0
        }
      }
    }
    this.position += input.length
    this.previous = input[input.length - 1]
    return true
  }
}

registerProcessor('orivox-pcm-16k', OrivoxPcmProcessor)
