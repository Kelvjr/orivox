import { describe, expect, it } from 'vitest'
import { validateCloudTranscriptionChoice } from './cloud-consent'

describe('validateCloudTranscriptionChoice', () => {
  it('keeps legacy M1 sessions local when the field is absent', () => {
    expect(validateCloudTranscriptionChoice(undefined)).toEqual({ mode: 'off' })
    expect(validateCloudTranscriptionChoice({ mode: 'off' })).toEqual({ mode: 'off' })
  })

  it('accepts only an explicit current Deepgram cloud consent', () => {
    expect(validateCloudTranscriptionChoice({
      mode: 'cloud', provider: 'deepgram',
      cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' },
    })).toEqual({
      mode: 'cloud', provider: 'deepgram',
      cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' },
    })
  })

  it.each([
    null,
    { mode: 'cloud', provider: 'deepgram' },
    { mode: 'cloud', provider: 'deepgram', cloudConsent: { audioTransferAccepted: false, disclosureVersion: 'm2-v1' } },
    { mode: 'cloud', provider: 'deepgram', cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm1-v1' } },
    { mode: 'cloud', provider: 'other', cloudConsent: { audioTransferAccepted: true, disclosureVersion: 'm2-v1' } },
  ])('rejects missing, stale, or unsupported cloud consent: %j', (value) => {
    expect(() => validateCloudTranscriptionChoice(value)).toThrow()
  })
})
