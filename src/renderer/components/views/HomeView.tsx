import { useState } from 'react'
import type { FC, FormEvent } from 'react'
import type { CaptureSource, SessionStartRequest } from '../../../shared/contracts'

export type SessionMode = 'interview' | 'meeting'

export interface HomeViewProps {
  isCapturing: boolean
  isStarting: boolean
  onStart: (request: SessionStartRequest) => void
  onNavigateToLive: () => void
}

export const HomeView: FC<HomeViewProps> = ({
  isCapturing,
  isStarting,
  onStart,
  onNavigateToLive,
}) => {
  const [sessionMode, setSessionMode] = useState<SessionMode>('interview')
  const [selectedSources, setSelectedSources] = useState<CaptureSource[]>(['microphone'])
  const [remoteProcessingAccepted, setRemoteProcessingAccepted] = useState(false)
  const [conversationPolicyAcknowledged, setConversationPolicyAcknowledged] = useState(false)
  const [transcriptionMode, setTranscriptionMode] = useState<'off' | 'cloud'>('off')
  const [cloudAudioAccepted, setCloudAudioAccepted] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true)

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
    !isStarting &&
    !isCapturing

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
      ...(transcriptionMode === 'cloud'
        ? {
            transcription: {
              mode: 'cloud',
              provider: 'deepgram',
              cloudConsent: {
                audioTransferAccepted: true,
                disclosureVersion: 'm2-v1',
              },
            },
          }
        : {}),
    })
  }

  return (
    <div className="view-container home-view" data-testid="home-view">
      <header className="view-header">
        <div>
          <h1 className="view-title">Session Setup & Consent</h1>
          <p className="view-subtitle">
            Configure your audio capture routes, select session mode, and verify consent before capture.
          </p>
        </div>
      </header>

      {isCapturing && (
        <div className="active-session-banner-card" role="region" aria-label="Active session banner">
          <div className="banner-left">
            <span className="indicator-pulse" aria-hidden="true" />
            <div>
              <div className="banner-title">Live Audio Capture Active</div>
              <div className="banner-desc">
                An active audio capture session is currently running. All streams are monitored locally.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={onNavigateToLive}
            data-testid="banner-goto-live-button"
          >
            View Live Session →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="home-form">
        {/* 1. Session Mode Selection */}
        <section className="form-section card" aria-labelledby="mode-selection-heading">
          <div className="section-header">
            <h2 id="mode-selection-heading" className="section-title">
              1. Session Mode
            </h2>
            <span className="future-note">Mode-specific AI grounding activates in Milestone 3</span>
          </div>

          <div className="mode-cards-grid" role="radiogroup" aria-labelledby="mode-selection-heading">
            <div
              className={`mode-card ${sessionMode === 'interview' ? 'selected' : ''}`}
              onClick={() => setSessionMode('interview')}
              role="radio"
              aria-checked={sessionMode === 'interview'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setSessionMode('interview')
              }}
              data-testid="mode-interview"
            >
              <div className="mode-card-header">
                <span className="mode-icon" aria-hidden="true">
                  💼
                </span>
                <span className="mode-name">Interview Mode</span>
                {sessionMode === 'interview' && <span className="mode-check">✓</span>}
              </div>
              <p className="mode-description">
                Tailored for technical and behavioral interviews. Grounded answers derived from your resume,
                projects, and portfolio.
              </p>
            </div>

            <div
              className={`mode-card ${sessionMode === 'meeting' ? 'selected' : ''}`}
              onClick={() => setSessionMode('meeting')}
              role="radio"
              aria-checked={sessionMode === 'meeting'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setSessionMode('meeting')
              }}
              data-testid="mode-meeting"
            >
              <div className="mode-card-header">
                <span className="mode-icon" aria-hidden="true">
                  👥
                </span>
                <span className="mode-name">Meeting Mode</span>
                {sessionMode === 'meeting' && <span className="mode-check">✓</span>}
              </div>
              <p className="mode-description">
                Tailored for 1-on-1s, engineering syncs, and team planning. Focuses on agenda items,
                decisions, and action item tracking.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Audio Sources Selection */}
        <section className="form-section card" aria-labelledby="source-selection-heading">
          <div className="section-header">
            <h2 id="source-selection-heading" className="section-title">
              2. Audio Source Selection
            </h2>
            <p className="section-subtitle">
              Select which audio routes to capture. Both routes can be monitored simultaneously.
            </p>
          </div>

          <div className="sources-selection-list">
            <label className={`source-option-card ${selectedSources.includes('microphone') ? 'selected' : ''}`}>
              <div className="option-control">
                <input
                  id="source-microphone"
                  type="checkbox"
                  className="checkbox-input"
                  checked={selectedSources.includes('microphone')}
                  onChange={() => handleSourceToggle('microphone')}
                  disabled={isStarting || isCapturing}
                />
              </div>
              <div className="option-info">
                <span className="option-title">Microphone (Voice Input)</span>
                <span className="option-desc">
                  Captures your speech locally via your primary microphone device.
                </span>
              </div>
            </label>

            <label className={`source-option-card ${selectedSources.includes('system') ? 'selected' : ''}`}>
              <div className="option-control">
                <input
                  id="source-system"
                  type="checkbox"
                  className="checkbox-input"
                  checked={selectedSources.includes('system')}
                  onChange={() => handleSourceToggle('system')}
                  disabled={isStarting || isCapturing}
                />
              </div>
              <div className="option-info">
                <span className="option-title">System Audio (Loopback)</span>
                <span className="option-desc">
                  Captures meeting audio from Windows playback (Zoom, Microsoft Teams, Google Meet).
                </span>
              </div>
            </label>
          </div>
        </section>

        {/* 3. Real-Time Cloud Transcription (Deepgram Nova-3) */}
        <section className="form-section card" aria-labelledby="transcription-selection-heading">
          <div className="section-header">
            <h2 id="transcription-selection-heading" className="section-title">
              3. Real-Time Live Transcription
            </h2>
            <span className="future-note">Milestone 2 Feature</span>
          </div>
          <p className="section-subtitle">
            Choose whether to enable cloud speech-to-text or keep audio capture local-only.
          </p>

          <div className="transcription-mode-grid" role="radiogroup" aria-labelledby="transcription-selection-heading">
            <div
              className={`mode-card ${transcriptionMode === 'off' ? 'selected' : ''}`}
              onClick={() => {
                setTranscriptionMode('off')
                setCloudAudioAccepted(false)
              }}
              role="radio"
              aria-checked={transcriptionMode === 'off'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  setTranscriptionMode('off')
                  setCloudAudioAccepted(false)
                }
              }}
              data-testid="transcription-mode-off"
            >
              <div className="mode-card-header">
                <span className="mode-icon" aria-hidden="true">
                  🔒
                </span>
                <span className="mode-name">Local Capture Only (M1)</span>
                {transcriptionMode === 'off' && <span className="mode-check">✓</span>}
              </div>
              <p className="mode-description">
                Signal analysis strictly in local volatile memory. No audio, transcripts, or personal data leave
                your device.
              </p>
            </div>

            <div
              className={`mode-card ${transcriptionMode === 'cloud' ? 'selected' : ''}`}
              onClick={() => setTranscriptionMode('cloud')}
              role="radio"
              aria-checked={transcriptionMode === 'cloud'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setTranscriptionMode('cloud')
              }}
              data-testid="transcription-mode-cloud"
            >
              <div className="mode-card-header">
                <span className="mode-icon" aria-hidden="true">
                  ⚡
                </span>
                <span className="mode-name">Deepgram Nova-3 Cloud (M2)</span>
                {transcriptionMode === 'cloud' && <span className="mode-check">✓</span>}
              </div>
              <p className="mode-description">
                Streaming live transcription with source labels. Sends audio to Deepgram Nova-3 with zero data retention
                (opted out of model training).
              </p>
            </div>
          </div>

          {transcriptionMode === 'cloud' && (
            <div className="cloud-consent-panel" style={{ marginTop: '1rem' }}>
              <div
                className="disclosure-box m2-cloud-disclosure"
                tabIndex={0}
                role="region"
                aria-label="Deepgram Cloud Transcription Disclosures"
                data-testid="m2-cloud-disclosure"
              >
                <div className="disclosure-title">Deepgram Nova-3 Cloud Transcription Disclosure (m2-v1)</div>
                <p>
                  <strong>Provider & Route Processing:</strong> Audio from selected routes (
                  {selectedSources.map((s) => (s === 'microphone' ? 'Microphone' : 'System Audio')).join(' & ') ||
                    'none selected'}
                  ) is streamed over secure WebSockets directly to Deepgram Nova-3 for real-time speech recognition.
                </p>
                <p>
                  <strong>Privacy & Model Training Opt-Out:</strong> Audio streams are configured with{' '}
                  <code>mip_opt_out=true</code>. Deepgram processes audio in volatile memory to generate transcripts
                  and does not retain audio or transcripts after response generation, nor are they used for model training.
                  Request metadata and connection usage logs remain on provider systems. Audio is processed ephemerally
                  and never stored on local disk or database.
                </p>
                <p>
                  <strong>Participant Authorization:</strong> You must inform all conversation participants and
                  obtain their explicit authorization before transmitting live meeting audio to a third-party cloud service.
                </p>
                <p>
                  <strong>Usage Cost & Keys:</strong> Deepgram Nova-3 streaming transcription incurs API charges of
                  approx. $0.0077/min per active source ($0.46/hour per route; ~$0.92/hour if both Microphone and System
                  Audio are streamed). The API key is securely managed by Electron Main.
                </p>
              </div>

              <label className="checkbox-label" htmlFor="consent-cloud-audio" style={{ marginTop: '0.75rem' }}>
                <input
                  id="consent-cloud-audio"
                  type="checkbox"
                  className="checkbox-input"
                  checked={cloudAudioAccepted}
                  onChange={(e) => setCloudAudioAccepted(e.target.checked)}
                  disabled={isStarting || isCapturing}
                  data-testid="consent-cloud-audio"
                />
                <div className="checkbox-text">
                  <span className="checkbox-title">
                    I authorize transmission of selected audio streams to Deepgram for real-time transcription (disclosure m2-v1).
                  </span>
                  <span className="checkbox-subtext">
                    Confirms participant authorization for remote cloud processing of selected audio streams.
                  </span>
                </div>
              </label>
            </div>
          )}
        </section>

        {/* 4. Consent & Privacy Authorization */}
        <section className="form-section card" aria-labelledby="consent-authorization-heading">
          <div className="section-header">
            <h2 id="consent-authorization-heading" className="section-title">
              4. Privacy Authorization & Legal Consent
            </h2>
            <p className="section-subtitle">
              Verify legal consent and technical acknowledgments before starting live capture.
            </p>
          </div>

          <div className="consent-checkbox-list">
            <label className="checkbox-label" htmlFor="consent-remote-processing">
              <input
                id="consent-remote-processing"
                type="checkbox"
                className="checkbox-input"
                checked={remoteProcessingAccepted}
                onChange={(e) => setRemoteProcessingAccepted(e.target.checked)}
                disabled={isStarting || isCapturing}
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
                disabled={isStarting || isCapturing}
              />
              <div className="checkbox-text">
                <span className="checkbox-title">
                  I confirm participant notification and compliance with applicable recording policies.
                </span>
                <span className="checkbox-subtext">
                  Verifies that all conversation participants are informed and required authorizations exist.
                </span>
              </div>
            </label>
          </div>

          {/* Expandable Advanced Technical Details Accordion */}
          <div className="advanced-details-accordion">
            <button
              type="button"
              className="advanced-details-toggle"
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              aria-expanded={isAdvancedOpen}
              aria-controls="technical-disclosures-panel"
            >
              <span>{isAdvancedOpen ? '▼' : '▶'} Advanced Technical & Legal Disclosures</span>
              <span className="accordion-hint">{isAdvancedOpen ? 'Hide Details' : 'Show Details'}</span>
            </button>

            {isAdvancedOpen && (
              <div
                id="technical-disclosures-panel"
                className="disclosure-box advanced-disclosure-content"
                tabIndex={0}
                role="region"
                aria-label="Privacy disclosures"
              >
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
            )}
          </div>
        </section>

        {/* Start Button Action Bar */}
        <div className="form-actions-bar">
          <div className="actions-left-note">
            {selectedSources.length === 0 ? (
              <span className="validation-warning">Select at least one audio route</span>
            ) : !remoteProcessingAccepted || !conversationPolicyAcknowledged ? (
              <span className="validation-warning">Both legal consent acknowledgments are required</span>
            ) : transcriptionMode === 'cloud' && !cloudAudioAccepted ? (
              <span className="validation-warning">Deepgram cloud audio authorization is required</span>
            ) : (
              <span className="validation-ready">
                ✓ Ready to capture ({sessionMode} mode, {transcriptionMode === 'cloud' ? 'Cloud Transcription' : 'Local Only'})
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={!isFormValid}
            aria-label={isStarting ? 'Starting capture session' : 'Start capture session'}
            data-testid="start-capture-button"
          >
            {isStarting ? (
              <>
                <span className="spinner-inline" aria-hidden="true" />
                Starting Session...
              </>
            ) : (
              'Start Capture Session'
            )}
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
