// Run only in a local shell that already holds DEEPGRAM_API_KEY.
// Checks the same WebSocket handshake as Orivox without sending any audio.
import WebSocket from 'ws'

const key = process.env.DEEPGRAM_API_KEY?.trim()
if (!key) {
  console.log('Deepgram WebSocket check: key is unavailable in this shell')
  process.exit(1)
}

const url = new URL('wss://api.deepgram.com/v1/listen')
for (const [name, value] of Object.entries({
  model: 'nova-3', language: 'en-US', encoding: 'linear16', sample_rate: '16000',
  channels: '1', interim_results: 'true', endpointing: '300', punctuate: 'true',
  mip_opt_out: 'true',
})) url.searchParams.set(name, value)

let finished = false
const socket = new WebSocket(url, {
  headers: { Authorization: `Token ${key}` },
  perMessageDeflate: false,
  handshakeTimeout: 10_000,
})
const timer = setTimeout(() => finish('Deepgram WebSocket check: timed out', 1), 15_000)

function finish(message, exitCode) {
  if (finished) return
  finished = true
  clearTimeout(timer)
  console.log(message)
  process.exitCode = exitCode
  socket.terminate()
}

socket.once('open', () => finish('Deepgram WebSocket check: connected', 0))
socket.once('unexpected-response', (_request, response) => {
  response.resume()
  finish(`Deepgram WebSocket check: HTTP ${response.statusCode}`, 1)
})
socket.once('error', (error) => {
  // Report a short network code only. Never print headers or request details.
  finish(`Deepgram WebSocket check: network ${error.code ?? 'error'}`, 1)
})
