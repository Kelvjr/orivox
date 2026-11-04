/** Runtime guard used by Electron Main before creating any cloud transcription stream. */
export type CloudTranscriptionChoice =
  | { mode: 'off' }
  | { mode: 'cloud'; provider: 'deepgram'; cloudConsent: { audioTransferAccepted: true; disclosureVersion: 'm2-v1' } }

export function validateCloudTranscriptionChoice(value: unknown): CloudTranscriptionChoice {
  // An M1 request has no transcription field and remains strictly local.
  if (value === undefined) return { mode: 'off' }
  if (!value || typeof value !== 'object') throw new Error('Choose a valid transcription mode')
  const choice = value as Record<string, unknown>
  if (choice.mode === 'off') return { mode: 'off' }
  if (choice.mode !== 'cloud' || choice.provider !== 'deepgram') {
    throw new Error('Choose a supported transcription provider')
  }
  const consent = choice.cloudConsent
  if (!consent || typeof consent !== 'object') throw new Error('Fresh cloud-audio consent is required')
  const fields = consent as Record<string, unknown>
  if (fields.audioTransferAccepted !== true || fields.disclosureVersion !== 'm2-v1') {
    throw new Error('Fresh cloud-audio consent is required')
  }
  return {
    mode: 'cloud', provider: 'deepgram',
    cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' },
  }
}
