/** Taps one M1 AudioContext without mixing capture sources or playing audio. */
export class PcmCapture {
  private constructor(
    private readonly node: AudioWorkletNode,
    private readonly mutedOutput: GainNode,
  ) {}

  static async attach(
    context: AudioContext,
    input: MediaStreamAudioSourceNode,
    onFrame: (pcm: Uint8Array) => void,
  ): Promise<PcmCapture> {
    await context.audioWorklet.addModule(new URL('audio/pcm-worklet.js', document.baseURI).toString())
    const node = new AudioWorkletNode(context, 'orivox-pcm-16k')
    const mutedOutput = context.createGain()
    mutedOutput.gain.value = 0
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const packet = data as { type?: unknown; pcm?: unknown }
      if (packet.type !== 'pcm' || !(packet.pcm instanceof ArrayBuffer) || packet.pcm.byteLength !== 640) return
      onFrame(new Uint8Array(packet.pcm))
    }
    try {
      input.connect(node)
      node.connect(mutedOutput)
      mutedOutput.connect(context.destination)
      return new PcmCapture(node, mutedOutput)
    } catch (error) {
      node.port.onmessage = null
      node.disconnect()
      mutedOutput.disconnect()
      throw error
    }
  }

  stop(): void {
    this.node.port.onmessage = null
    try { this.node.port.postMessage({ type: 'stop' }) } catch { /* The context may already be closing. */ }
    try { this.node.disconnect() } catch { /* Release remaining resources. */ }
    try { this.mutedOutput.disconnect() } catch { /* Release remaining resources. */ }
  }
}
