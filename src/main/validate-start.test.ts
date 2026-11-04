import { describe, expect, it } from 'vitest'
import { validateStartRequest } from './validate-start'

const valid = {
  sources: ['microphone', 'system'],
  consent: { remoteProcessingAccepted: true, conversationPolicyAcknowledged: true },
  selectedDocumentIds: [],
}

describe('validateStartRequest', () => {
  it('accepts separate microphone and system sources after explicit consent', () => {
    expect(validateStartRequest(valid).sources).toEqual(['microphone', 'system'])
  })

  it.each([
    { ...valid, sources: [] },
    { ...valid, sources: ['microphone', 'microphone'] },
    { ...valid, sources: ['camera'] },
    { ...valid, consent: { ...valid.consent, remoteProcessingAccepted: false } },
    { ...valid, consent: { ...valid.consent, conversationPolicyAcknowledged: false } },
    { ...valid, selectedDocumentIds: ['not-yet-supported'] },
  ])('rejects invalid sources, missing consent, or M2+ context: %j', (request) => {
    expect(() => validateStartRequest(request)).toThrow()
  })
})
