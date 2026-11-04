import { useState } from 'react'
import type { FC, FormEvent } from 'react'
import type { CaptureSource, SessionStartRequest } from '../../shared/contracts'

export interface SessionSetupProps {
  isStarting: boolean
  onStart: (request: SessionStartRequest) => void
}

export const SessionSetup: FC<SessionSetupProps> = ({ isStarting, onStart }) => {
  const [selectedSources, setSelectedSources] = useState<CaptureSource[]>(['microphone'])
  const [remoteProcessingAccepted, setRemoteProcessingAccepted] = useState(false)
  const [conversationPolicyAcknowledged, setConversationPolicyAcknowledged] = useState(false)
  const [transcriptionMode, setTranscriptionMode] = useState<'off' | 'cloud'>('off')
  const [cloudAudioAccepted, setCloudAudioAccepted] = useState(false)

  const handleSourceToggle = (source: CaptureSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )
  }

  const isCloudConsentValid = transcriptionMode === 'off' || cloudAudioAccepted

  const isFormValid =
    selectedSources.length > 0 &&
    remoteProcessingAccepted &&
    conversationPolicyAcknowledged &&
    isCloudConsentValid &&
    !isStarting

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isFormValid) return

    onStart({
      sources: selectedSources,
      consent: {
        remoteProcessingAccepted: true,
        conversationPolicyAcknowledged: true,
      },
      selectedDocumentIds: [],
      transcription:
        transcriptionMode === 'cloud'
          ? {
              mode: 'cloud',
              provider: 'deepgram',
              cloudConsent: {
                audioTransferAccepted: true,
                disclosureVersion: 'm2-v1',
              },
            }
          : { mode: 'off' },
    })
  }

  return (
    <div className="session-setup-container">
      <form className="card session-setup" onSubmit={handleSubmit}>
        <div className="card-header-row">
          <div>
            <h2 className="card-title">Session Setup & Consent</h2>
            <p className="card-description">
              Configure your capture routes and verify consent before initiating audio capture.
            </p>
          </div>
        </div>

        <section className="form-group" aria-labelledby="sources-heading">
          <h3 id="sources-heading" className="card-title" style={{ fontSize: '1rem' }}>
            1. Audio Source Selection
          </h3>
          <p className="card-description">Select at least one audio route to capture for this session.</p>

          <label className="checkbox-label" htmlFor="source-microphone">
            <input
              id="source-microphone"
              type="checkbox"
              className="checkbox-input"
              checked={selectedSources.includes('microphone')}
              onChange={() => handleSourceToggle('microphone')}
              disabled={isStarting}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">Microphone (Voice Input)</span>
              <span className="checkbox-subtext">
                Captures your speech via your local microphone device.
              </span>
            </div>
          </label>

          <label className="checkbox-label" htmlFor="source-system">
            <input
              id="source-system"
              type="checkbox"
              className="checkbox-input"
              checked={selectedSources.includes('system')}
              onChange={() => handleSourceToggle('system')}
              disabled={isStarting}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">System Audio (Loopback)</span>
              <span className="checkbox-subtext">
                Captures meeting audio (Zoom, Teams, Meet) from Windows loopback playback.
              </span>
            </div>
          </label>
        </section>

        <section className="form-group" aria-labelledby="transcription-heading">
          <h3 id="transcription-heading" className="card-title" style={{ fontSize: '1rem' }}>
            2. Real-Time Cloud Transcription (Deepgram Nova-3)
          </h3>
          <p className="card-description">
            Choose whether to enable cloud speech-to-text or keep audio capture local-only.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label className="checkbox-label" style={{ flex: 1 }}>
              <input
                type="radio"
                name="transcription-mode-legacy"
                checked={transcriptionMode === 'off'}
                onChange={() => {
                  setTranscriptionMode('off')
                  setCloudAudioAccepted(false)
                }}
              />
              <div className="checkbox-text">
                <span className="checkbox-title">Local Capture Only (M1)</span>
                <span className="checkbox-subtext">No audio data transmitted to cloud services.</span>
              </div>
            </label>

            <label className="checkbox-label" style={{ flex: 1 }}>
              <input
                type="radio"
                name="transcription-mode-legacy"
                checked={transcriptionMode === 'cloud'}
                onChange={() => setTranscriptionMode('cloud')}
              />
              <div className="checkbox-text">
                <span className="checkbox-title">Deepgram Nova-3 Cloud (M2)</span>
                <span className="checkbox-subtext">Streaming live transcription with source labels.</span>
              </div>
            </label>
          </div>

          {transcriptionMode === 'cloud' && (
            <div className="disclosure-box" style={{ marginBottom: '0.75rem' }}>
              <div className="disclosure-title">Deepgram Nova-3 Cloud Transcription Disclosure (m2-v1)</div>
              <p>
                <strong>Provider & Route Processing:</strong> Audio from selected routes is streamed over secure
                WebSockets to Deepgram Nova-3 with <code>mip_opt_out=true</code> (content not retained after response;
                request metadata retained). Streaming rate is ~$0.0077/min/source ($0.46/hr each).
              </p>
              <p>
                <strong>Participant Authorization:</strong> All conversation participants must provide explicit
                authorization prior to streaming audio.
              </p>
              <label className="checkbox-label" htmlFor="consent-cloud-audio-legacy" style={{ marginTop: '0.5rem' }}>
                <input
                  id="consent-cloud-audio-legacy"
                  type="checkbox"
                  className="checkbox-input"
                  checked={cloudAudioAccepted}
                  onChange={(e) => setCloudAudioAccepted(e.target.checked)}
                />
                <div className="checkbox-text">
                  <span className="checkbox-title">
                    I authorize transmission of selected audio streams to Deepgram (disclosure m2-v1).
                  </span>
                  <span className="checkbox-subtext">
                    Confirms participant authorization for remote cloud processing of selected audio streams.
                  </span>
                </div>
              </label>
            </div>
          )}
        </section>

        <section className="form-group" aria-labelledby="consent-heading">
          <h3 id="consent-heading" className="card-title" style={{ fontSize: '1rem' }}>
            3. Privacy Disclosures & Authorization
          </h3>

          <div className="disclosure-box" tabIndex={0} role="region" aria-label="Privacy disclosures">
            <div className="disclosure-title">Mandatory Technical & Privacy Disclosures</div>
            <p>
              <strong>Windows System Audio Carrier:</strong> On Windows, Electron loopback capture utilizes
              a system screen-capture API (<code>getDisplayMedia</code>) with a video track carrier. Orivox
              maintains this carrier strictly to transport system audio. Video frames are never inspected,
              recorded, stored, or transmitted.
            </p>
            <p>
              <strong>Local Capture Mode & Privacy Boundary:</strong> When local mode is selected, audio
              signals and level meters are processed strictly in local volatile memory with zero cloud
              transmission. When Deepgram Nova-3 cloud transcription is selected, audio transmission is
              governed strictly by the explicit M2 cloud consent grant above with <code>mip_opt_out=true</code>.
            </p>
            <p>
              <strong>Participant Consent Reminder:</strong> You must ensure all call participants are
              notified and have provided necessary authorization in accordance with applicable laws and
              organizational recording policies.
            </p>
          </div>

          <label className="checkbox-label" htmlFor="consent-remote-processing">
            <input
              id="consent-remote-processing"
              type="checkbox"
              className="checkbox-input"
              checked={remoteProcessingAccepted}
              onChange={(e) => setRemoteProcessingAccepted(e.target.checked)}
              disabled={isStarting}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">
                I acknowledge the local audio analysis policy and system-audio video-carrier disclosure.
              </span>
              <span className="checkbox-subtext">
                Confirms local volatile memory processing when cloud transcription is off and screen carrier usage for system loopback.
              </span>
            </div>
          </label>

          <label className="checkbox-label" htmlFor="consent-conversation-policy">
            <input
              id="consent-conversation-policy"
              type="checkbox"
              className="checkbox-input"
              checked={conversationPolicyAcknowledged}
              onChange={(e) => setConversationPolicyAcknowledged(e.target.checked)}
              disabled={isStarting}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">
                I confirm participant notification and compliance with applicable recording policies.
              </span>
              <span className="checkbox-subtext">
                Confirms required permissions from meeting participants have been obtained.
              </span>
            </div>
          </label>
        </section>

        <div className="actions-row">
          <button
            type="submit"
            className="btn-primary"
            disabled={!isFormValid}
            aria-label={isStarting ? 'Starting capture session' : 'Start capture session'}
          >
            {isStarting ? 'Starting Session...' : 'Start Capture Session'}
          </button>
        </div>
      </form>

      {/* Modern Desktop Experience Info Card */}
      <div className="card desktop-info-card">
        <h3 className="card-title" style={{ fontSize: '1rem' }}>
          🖥️ Desktop Application Experience
        </h3>
        <div className="desktop-features-grid">
          <div className="desktop-feature-item">
            <span className="feature-icon">📐</span>
            <div>
              <strong>Collapsible Side Dock:</strong> The in-app dock previews the future compact, separate
              Electron window that will anchor beside video calls. Never leaves an always-on-top floating pill or widget obstructing your view.
            </div>
          </div>
          <div className="desktop-feature-item">
            <span className="feature-icon">📥</span>
            <div>
              <strong>Minimize to System Tray:</strong> Planned for a future milestone in Electron Main:
              minimizing will route to the Windows system tray so background audio capture continues unobtrusively.
            </div>
          </div>
          <div className="desktop-feature-item">
            <span className="feature-icon">⌨️</span>
            <div>
              <strong>Keyboard Navigation:</strong> Use <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> to toggle
              the in-app preview dock. (OS-wide global shortcut will be registered in Main by Codex).
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
