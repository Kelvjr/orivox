import type { SessionStartRequest } from '../shared/contracts'

export function validateStartRequest(value: unknown): SessionStartRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid session request')
  const request = value as Partial<SessionStartRequest>
  const sources = request.sources
  if (
    !Array.isArray(sources) ||
    sources.length < 1 ||
    sources.length > 2 ||
    new Set(sources).size !== sources.length ||
    sources.some((source) => source !== 'microphone' && source !== 'system')
  ) {
    throw new Error('Select a valid microphone or system-audio source')
  }
  if (
    request.consent?.remoteProcessingAccepted !== true ||
    request.consent?.conversationPolicyAcknowledged !== true
  ) {
    throw new Error('Explicit session consent is required')
  }
  if (!Array.isArray(request.selectedDocumentIds) || request.selectedDocumentIds.length !== 0) {
    throw new Error('Document context is not available in M1')
  }
  return {
    sources: [...sources],
    consent: {
      remoteProcessingAccepted: true,
      conversationPolicyAcknowledged: true,
    },
    selectedDocumentIds: [],
  }
}
