import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { App } from './App'
import { StandaloneDockApp } from './dock'
import { createMockBridge } from '../shared/fixtures'
import type { MockOrivoxBridge } from '../shared/fixtures'
import type { SessionEvent } from '../shared/contracts'

describe('Orivox Desktop App & Collapsible Side Dock UI', () => {
  let mockBridge: MockOrivoxBridge

  beforeEach(() => {
    mockBridge = createMockBridge()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders modern Windows desktop app shell with topbar and bridge warning if bridge is missing', () => {
    render(<App bridge={undefined} />)
    expect(screen.getByRole('heading', { name: 'Orivox', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Milestone 2 — Live Transcripts/i)).toBeInTheDocument()
    expect(screen.getByText(/Personal Live Meeting Copilot/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Bridge Connection Warning/i)
  })

  it('renders navigation sidebar with all primary views', () => {
    render(<App bridge={mockBridge} />)
    expect(screen.getByTestId('nav-home')).toBeInTheDocument()
    expect(screen.getByTestId('nav-session')).toBeInTheDocument()
    expect(screen.getByTestId('nav-history')).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
    expect(screen.getByText(/M2 Live Transcripts/i)).toBeInTheDocument()
  })

  it('renders session setup with mode selection, sources, disclosures, and disabled start button initially', () => {
    render(<App bridge={mockBridge} />)

    // Heading and controls
    expect(screen.getByRole('heading', { name: /Session Setup & Consent/i })).toBeInTheDocument()
    expect(screen.getByTestId('mode-interview')).toBeInTheDocument()
    expect(screen.getByTestId('mode-meeting')).toBeInTheDocument()
    expect(screen.getByLabelText(/Microphone \(Voice Input\)/i)).toBeChecked()
    expect(screen.getByLabelText(/System Audio \(Loopback\)/i)).not.toBeChecked()

    // Required disclosures
    expect(screen.getByText(/Windows System Audio Carrier:/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Video frames are never inspected, recorded, stored, or transmitted/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Local Capture Mode & Privacy Boundary:/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /processed strictly in local volatile memory with zero cloud transmission/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Participant Consent Reminder:/i)).toBeInTheDocument()

    // Desktop app integration features
    expect(screen.getByText(/Desktop Application Experience/i)).toBeInTheDocument()
    expect(screen.getByText(/Never leaves an always-on-top floating pill or widget/i)).toBeInTheDocument()

    // Start button disabled before consent
    const startButton = screen.getByTestId('start-capture-button')
    expect(startButton).toBeDisabled()
  })

  it('supports selecting Interview Mode and Meeting Mode', () => {
    render(<App bridge={mockBridge} />)

    const interviewCard = screen.getByTestId('mode-interview')
    const meetingCard = screen.getByTestId('mode-meeting')

    expect(interviewCard).toHaveClass('selected')
    expect(meetingCard).not.toHaveClass('selected')

    fireEvent.click(meetingCard)
    expect(meetingCard).toHaveClass('selected')
    expect(interviewCard).not.toHaveClass('selected')
  })

  it('enforces explicit consent and at least one source before enabling Start button', () => {
    render(<App bridge={mockBridge} />)

    const startButton = screen.getByTestId('start-capture-button')
    const micCheckbox = screen.getByLabelText(/Microphone \(Voice Input\)/i)
    const remoteConsent = screen.getByLabelText(
      /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
    )
    const policyConsent = screen.getByLabelText(
      /I confirm participant notification and compliance with applicable recording policies/i
    )

    // Check only one consent box
    fireEvent.click(remoteConsent)
    expect(startButton).toBeDisabled()

    // Check second consent box
    fireEvent.click(policyConsent)
    expect(startButton).toBeEnabled()

    // Uncheck microphone (no sources selected)
    fireEvent.click(micCheckbox)
    expect(startButton).toBeDisabled()

    // Check system audio only
    const sysCheckbox = screen.getByLabelText(/System Audio \(Loopback\)/i)
    fireEvent.click(sysCheckbox)
    expect(startButton).toBeEnabled()
  })

  it('starts session with selected sources and displays persistent indicator and meters', async () => {
    const startSpy = vi.spyOn(mockBridge, 'startSession')
    render(<App bridge={mockBridge} />)

    const sysCheckbox = screen.getByLabelText(/System Audio \(Loopback\)/i)
    fireEvent.click(sysCheckbox)

    const remoteConsent = screen.getByLabelText(
      /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
    )
    const policyConsent = screen.getByLabelText(
      /I confirm participant notification and compliance with applicable recording policies/i
    )
    fireEvent.click(remoteConsent)
    fireEvent.click(policyConsent)

    const startButton = screen.getByTestId('start-capture-button')
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledWith({
        sources: ['microphone', 'system'],
        consent: {
          remoteProcessingAccepted: true,
          conversationPolicyAcknowledged: true,
        },
        selectedDocumentIds: [],
      })
    })

    // Active capture indicators (main banner and topbar status)
    await waitFor(() => {
      expect(screen.getByTestId('capture-active-title')).toHaveTextContent(
        /RECORDING IN PROGRESS — LIVE CAPTURE ACTIVE/i
      )
      expect(screen.getByTestId('topbar-live-status')).toBeInTheDocument()
    })

    // Active sources pills
    expect(screen.getAllByText('Microphone').length).toBeGreaterThan(0)
    expect(screen.getAllByText('System Audio').length).toBeGreaterThan(0)

    // Accessible stop buttons (in banner and in topbar)
    const bannerStopButton = screen.getByTestId('stop-capture-button')
    const topbarStopButton = screen.getByTestId('topbar-stop-button')
    expect(bannerStopButton).toBeInTheDocument()
    expect(topbarStopButton).toBeInTheDocument()

    // Audio meters present
    expect(screen.getByTestId('meter-microphone')).toBeInTheDocument()
    expect(screen.getByTestId('meter-system')).toBeInTheDocument()
    expect(
      screen.getByText(/Source labels indicate audio capture routes, not verified speaker identities/i)
    ).toBeInTheDocument()

    // Real-Time Transcript present in Live Session view
    expect(screen.getByTestId('live-transcript-component')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Real-Time Transcript/i })).toBeInTheDocument()
    expect(screen.getByText(/Milestone 3\+ Preview/i)).toBeInTheDocument()

    // Tray guidance card present
    expect(
      screen.getByText(/Background Capture & System Tray Integration/i)
    ).toBeInTheDocument()
  })

  it('collapses completely without leaving an always-on-top floating widget', () => {
    render(<App bridge={mockBridge} initialDockExpanded={false} />)

    // Side dock should not be rendered when collapsed
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('side-dock-panel')).not.toBeInTheDocument()

    // Toggle button indicates collapsed state
    const toggleButton = screen.getByTestId('toggle-dock-button')
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    expect(toggleButton).toHaveTextContent(/Side Dock/i)
  })

  it('triggers bridge.toggleDock via topbar toggle button', () => {
    render(<App bridge={mockBridge} initialDockExpanded={false} />)

    const toggleButton = screen.getByTestId('toggle-dock-button')
    fireEvent.click(toggleButton)

    // Bridge toggleDock was called
    expect(mockBridge.toggleDockCalls).toBe(1)
  })

  it('triggers bridge.toggleDock via Ctrl+Shift+O keyboard shortcut', () => {
    render(<App bridge={mockBridge} initialDockExpanded={false} />)

    fireEvent.keyDown(window, { key: 'O', ctrlKey: true, shiftKey: true })
    expect(mockBridge.toggleDockCalls).toBe(1)
  })

  it('renders 1/3 viewport docked layout when docked and restores via restore button', () => {
    render(<App bridge={mockBridge} initialDockExpanded={true} />)

    // Docked layout is visible
    expect(screen.getByTestId('docked-window-layout')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toBeInTheDocument()

    // Restore button is displayed
    const restoreBtn = screen.getByTestId('toggle-dock-button')
    expect(restoreBtn).toHaveTextContent(/Restore Window/i)
    fireEvent.click(restoreBtn)

    expect(mockBridge.restoreMainWindowCalls).toBe(1)
  })

  it('navigates to History view and renders empty state with privacy guarantee', () => {
    render(<App bridge={mockBridge} />)

    fireEvent.click(screen.getByTestId('nav-history'))

    expect(screen.getByRole('heading', { name: 'Session History', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/No Past Sessions Recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/Privacy Policy Guarantee:/i)).toBeInTheDocument()

    // Click "Start a New Session" in History returns to Home
    fireEvent.click(screen.getByTestId('history-start-session-button'))
    expect(screen.getByRole('heading', { name: /Session Setup & Consent/i })).toBeInTheDocument()
  })

  it('navigates to Settings view and renders functional preferences and disabled future features', () => {
    render(<App bridge={mockBridge} />)

    fireEvent.click(screen.getByTestId('nav-settings'))

    expect(screen.getByRole('heading', { name: 'Settings & Preferences', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Session Mode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Default Audio Capture Preset/i)).toBeInTheDocument()

    // Future features labeled as unavailable in M1
    expect(screen.getByText(/Speech-to-Text Transcription Provider/i)).toBeInTheDocument()
    expect(screen.getByText(/Milestone 2 \(Requires Remote Consent\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Reasoning & Copilot Language Model/i)).toBeInTheDocument()
    expect(screen.getByText(/Milestone 3 \(Offline in M1\)/i)).toBeInTheDocument()
  })

  it('updates audio level progress bars when capture.level events arrive', async () => {
    render(<App bridge={mockBridge} />)

    // Complete setup and start
    fireEvent.click(
      screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
    )
    fireEvent.click(
      screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
    )
    fireEvent.click(screen.getByTestId('start-capture-button'))

    await waitFor(() => {
      expect(screen.getByTestId('capture-active-title')).toBeInTheDocument()
    })

    // Emit level event for microphone
    const levelEvent: SessionEvent = {
      type: 'capture.level',
      sessionId: 'fixture-session',
      source: 'microphone',
      levelRms: 0.35,
      peak: 0.7,
      processedFrames: 4096,
      observedAtMs: Date.now(),
    }
    mockBridge.emit(levelEvent)

    await waitFor(() => {
      const micMeterBar = screen.getByTestId('bar-microphone')
      expect(micMeterBar).toHaveStyle({ width: `${Math.min(100, Math.round(0.35 * 100 * 2.5))}%` })
      expect(screen.getByText(/Frames: 4,096/i)).toBeInTheDocument()
      expect(screen.getByText(/Peak: 70%/i)).toBeInTheDocument()
    })
  })

  it('stops session and returns to setup view when Stop button is clicked', async () => {
    const stopSpy = vi.spyOn(mockBridge, 'stopSession')
    render(<App bridge={mockBridge} />)

    // Complete setup and start
    fireEvent.click(
      screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
    )
    fireEvent.click(
      screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
    )
    fireEvent.click(screen.getByTestId('start-capture-button'))

    await waitFor(() => {
      expect(screen.getByTestId('stop-capture-button')).toBeInTheDocument()
    })

    const stopButton = screen.getByTestId('stop-capture-button')
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Session Setup & Consent/i })).toBeInTheDocument()
    })
  })

  it('stops session from topbar stop button', async () => {
    const stopSpy = vi.spyOn(mockBridge, 'stopSession')
    render(<App bridge={mockBridge} />)

    fireEvent.click(
      screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
    )
    fireEvent.click(
      screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
    )
    fireEvent.click(screen.getByTestId('start-capture-button'))

    await waitFor(() => {
      expect(screen.getByTestId('topbar-stop-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('topbar-stop-button'))

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  it('displays clear error notice when startSession rejects and allows dismissing it', async () => {
    vi.spyOn(mockBridge, 'startSession').mockRejectedValueOnce(
      new Error('Microphone permission was denied. Check Windows and app permissions.')
    )
    render(<App bridge={mockBridge} />)

    fireEvent.click(
      screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
    )
    fireEvent.click(
      screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
    )
    fireEvent.click(screen.getByTestId('start-capture-button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Microphone permission was denied. Check Windows and app permissions./i
      )
    })

    const dismissButton = screen.getByRole('button', { name: /Dismiss error notice/i })
    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('handles bridge session.error event and presents error banner', async () => {
    render(<App bridge={mockBridge} />)

    mockBridge.emit({
      type: 'session.error',
      sessionId: null,
      code: 'device-busy',
      message: 'System audio could not be opened. Another app or setting may be blocking it.',
      recoverable: true,
      source: 'system',
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /System audio could not be opened. Another app or setting may be blocking it./i
      )
    })
  })

  it('handles stopSession failure by setting error notice', async () => {
    render(<App bridge={mockBridge} />)

    fireEvent.click(
      screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
    )
    fireEvent.click(
      screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
    )
    fireEvent.click(screen.getByTestId('start-capture-button'))

    await waitFor(() => {
      expect(screen.getByTestId('stop-capture-button')).toBeInTheDocument()
    })

    vi.spyOn(mockBridge, 'stopSession').mockRejectedValueOnce(new Error('Hardware cleanup timeout'))
    fireEvent.click(screen.getByTestId('stop-capture-button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Hardware cleanup timeout/i)
    })
  })
})

describe('Standalone Desktop Dock Window', () => {
  let mockBridge: MockOrivoxBridge

  beforeEach(() => {
    mockBridge = createMockBridge()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders independent dock window with idle state and hides via close button', async () => {
    render(<StandaloneDockApp bridge={mockBridge} />)

    expect(screen.getByRole('complementary', { name: /Orivox Copilot Side Dock/i })).toBeInTheDocument()
    expect(screen.getByText('Desktop Side Dock')).toBeInTheDocument()
    expect(screen.getByText('Capture Idle')).toBeInTheDocument()

    const closeButton = screen.getByTestId('collapse-dock-button')
    fireEvent.click(closeButton)
    expect(mockBridge.hideDockCalls).toBe(1)
  })

  it('hides standalone dock on Escape and Ctrl+Shift+O', () => {
    render(<StandaloneDockApp bridge={mockBridge} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockBridge.hideDockCalls).toBe(1)

    fireEvent.keyDown(window, { key: 'O', ctrlKey: true, shiftKey: true })
    expect(mockBridge.hideDockCalls).toBe(2)
  })

  it('shows live capture state and allows stopping capture from the dock', async () => {
    render(<StandaloneDockApp bridge={mockBridge} />)

    // Start a session
    await mockBridge.startSession({
      sources: ['microphone', 'system'],
      consent: {
        remoteProcessingAccepted: true,
        conversationPolicyAcknowledged: true,
      },
      selectedDocumentIds: [],
    })

    await waitFor(() => {
      expect(screen.getByText('Live Capture Active')).toBeInTheDocument()
      expect(screen.getByText('fixture-session')).toBeInTheDocument()
    })

    // Click stop from dock
    const stopButton = screen.getByTestId('dock-stop-button')
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(screen.getByText('Capture Idle')).toBeInTheDocument()
    })
  })

  it('calls restoreMainWindow when the restore main window button is clicked in the dock', () => {
    render(<StandaloneDockApp bridge={mockBridge} />)

    const openMainBtn = screen.getByTestId('dock-open-main-button')
    fireEvent.click(openMainBtn)
    expect(mockBridge.restoreMainWindowCalls).toBe(1)
  })

  describe('Milestone 2: Real-Time Cloud Transcription & Live Transcript Stream', () => {
    it('supports selecting Deepgram Nova-3 Cloud mode and enforces explicit cloud audio consent', async () => {
      const startSpy = vi.spyOn(mockBridge, 'startSession')
      render(<App bridge={mockBridge} />)

      // Initially in local mode
      expect(screen.getByTestId('transcription-mode-off')).toHaveClass('selected')
      expect(screen.queryByTestId('consent-cloud-audio')).not.toBeInTheDocument()

      // Switch to Deepgram cloud mode
      const cloudModeCard = screen.getByTestId('transcription-mode-cloud')
      fireEvent.click(cloudModeCard)
      expect(cloudModeCard).toHaveClass('selected')

      // M2 disclosure and cloud consent checkbox appear
      expect(screen.getByTestId('m2-cloud-disclosure')).toBeInTheDocument()
      expect(screen.getByText(/Deepgram Nova-3 Cloud Transcription Disclosure \(m2-v1\)/i)).toBeInTheDocument()
      expect(screen.getAllByText(/mip_opt_out=true/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/\$0\.0077\/min per active source/i)).toBeInTheDocument()

      const cloudConsentCheckbox = screen.getByTestId('consent-cloud-audio')
      expect(cloudConsentCheckbox).not.toBeChecked()
      expect(
        screen.getByText(/Confirms participant authorization for remote cloud processing of selected audio streams/i)
      ).toBeInTheDocument()

      // Fill M1 legal checkboxes
      const remoteConsent = screen.getByLabelText(
        /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
      )
      const policyConsent = screen.getByLabelText(
        /I confirm participant notification and compliance with applicable recording policies/i
      )
      fireEvent.click(remoteConsent)
      fireEvent.click(policyConsent)

      // Start button is still disabled because cloud audio consent is required
      const startButton = screen.getByTestId('start-capture-button')
      expect(startButton).toBeDisabled()
      expect(screen.getByText(/Deepgram cloud audio authorization is required/i)).toBeInTheDocument()

      // Authorize cloud audio transfer
      fireEvent.click(cloudConsentCheckbox)
      expect(startButton).toBeEnabled()
      expect(screen.getByText(/Ready to capture/i)).toBeInTheDocument()

      // Start capture
      fireEvent.click(startButton)

      await waitFor(() => {
        expect(startSpy).toHaveBeenCalledWith({
          sources: ['microphone'],
          consent: {
            remoteProcessingAccepted: true,
            conversationPolicyAcknowledged: true,
          },
          selectedDocumentIds: [],
          transcription: {
            mode: 'cloud',
            provider: 'deepgram',
            cloudConsent: {
              audioTransferAccepted: true,
              disclosureVersion: 'm2-v1',
            },
          },
        })
      })
    })

    it('renders live transcript stream with interim hypothesis replacement and finalized speaker turns', async () => {
      render(<App bridge={mockBridge} />)

      // Start cloud transcription session with both microphone and system audio
      fireEvent.click(screen.getByTestId('transcription-mode-cloud'))
      fireEvent.click(screen.getByTestId('consent-cloud-audio'))
      fireEvent.click(screen.getByLabelText(/System Audio \(Loopback\)/i))
      fireEvent.click(
        screen.getByLabelText(
          /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
        )
      )
      fireEvent.click(
        screen.getByLabelText(
          /I confirm participant notification and compliance with applicable recording policies/i
        )
      )
      fireEvent.click(screen.getByTestId('start-capture-button'))

      await waitFor(() => {
        expect(screen.getByTestId('live-session-active')).toBeInTheDocument()
      })

      // Listening empty state initially
      expect(screen.getByTestId('transcript-empty-state')).toBeInTheDocument()

      // 1. Emit an interim hypothesis for microphone
      mockBridge.emit({
        type: 'transcript.interim',
        sessionId: 'fixture-session',
        turnId: 'turn-mic-1',
        source: 'microphone',
        text: 'Thinking about the',
        observedAtMs: 1000,
      })

      await waitFor(() => {
        expect(screen.getByTestId('transcript-interim-turn-mic-1')).toBeInTheDocument()
        expect(screen.getByText('Thinking about the')).toBeInTheDocument()
      })

      // 2. Provisional hypothesis replaces previous text for same turnId
      mockBridge.emit({
        type: 'transcript.interim',
        sessionId: 'fixture-session',
        turnId: 'turn-mic-1',
        source: 'microphone',
        text: 'Thinking about the architecture.',
        observedAtMs: 1500,
      })

      await waitFor(() => {
        expect(screen.getByText('Thinking about the architecture.')).toBeInTheDocument()
        expect(screen.queryByText('Thinking about the')).not.toBeInTheDocument()
      })

      // 3. Emit final turn for microphone — replaces interim hypothesis with immutable turn
      mockBridge.emit({
        type: 'transcript.final',
        sessionId: 'fixture-session',
        turn: {
          id: 'turn-mic-1',
          source: 'microphone',
          text: 'Thinking about the architecture.',
          startedAtMs: 1000,
          endedAtMs: 2500,
        },
      })

      await waitFor(() => {
        expect(screen.queryByTestId('transcript-interim-turn-mic-1')).not.toBeInTheDocument()
        const finalTurn = screen.getByTestId('transcript-turn-turn-mic-1')
        expect(finalTurn).toBeInTheDocument()
        expect(finalTurn).toHaveTextContent(/Microphone/i)
        expect(finalTurn).toHaveTextContent('Thinking about the architecture.')
      })

      // 4. Emit final turn for system audio
      mockBridge.emit({
        type: 'transcript.final',
        sessionId: 'fixture-session',
        turn: {
          id: 'turn-sys-1',
          source: 'system',
          text: 'That sounds like a solid design.',
          startedAtMs: 3000,
          endedAtMs: 4500,
        },
      })

      await waitFor(() => {
        const sysTurn = screen.getByTestId('transcript-turn-turn-sys-1')
        expect(sysTurn).toBeInTheDocument()
        expect(sysTurn).toHaveTextContent(/System Audio/i)
        expect(sysTurn).toHaveTextContent('That sounds like a solid design.')
      })
    })

    it('renders per-source transcription connection status pills in live session', async () => {
      render(<App bridge={mockBridge} />)

      // Start cloud transcription session with both microphone and system audio
      fireEvent.click(screen.getByTestId('transcription-mode-cloud'))
      fireEvent.click(screen.getByTestId('consent-cloud-audio'))
      fireEvent.click(screen.getByLabelText(/System Audio \(Loopback\)/i))
      fireEvent.click(
        screen.getByLabelText(
          /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
        )
      )
      fireEvent.click(
        screen.getByLabelText(
          /I confirm participant notification and compliance with applicable recording policies/i
        )
      )
      fireEvent.click(screen.getByTestId('start-capture-button'))

      await waitFor(() => {
        expect(screen.getByTestId('live-session-active')).toBeInTheDocument()
      })

      // Emit streaming status for microphone
      mockBridge.emit({
        type: 'transcription.status',
        sessionId: 'fixture-session',
        source: 'microphone',
        state: { phase: 'streaming', errorMessage: null },
      })

      await waitFor(() => {
        const micStatus = screen.getByTestId('transcription-status-microphone')
        expect(micStatus).toHaveTextContent(/Mic: streaming/i)
        expect(micStatus).toHaveClass('phase-streaming')
      })

      // Emit reconnecting status for system audio
      mockBridge.emit({
        type: 'transcription.status',
        sessionId: 'fixture-session',
        source: 'system',
        state: { phase: 'reconnecting', errorMessage: null },
      })

      await waitFor(() => {
        const sysStatus = screen.getByTestId('transcription-status-system')
        expect(sysStatus).toHaveTextContent(/System: reconnecting/i)
        expect(sysStatus).toHaveClass('phase-reconnecting')
      })

      // Emit error status for microphone
      mockBridge.emit({
        type: 'transcription.status',
        sessionId: 'fixture-session',
        source: 'microphone',
        state: { phase: 'error', errorMessage: 'WebSocket network failure' },
      })

      await waitFor(() => {
        const micStatus = screen.getByTestId('transcription-status-microphone')
        expect(micStatus).toHaveTextContent(/Mic: error/i)
        expect(micStatus).toHaveClass('phase-error')
        expect(micStatus).toHaveAttribute('title', 'Error: WebSocket network failure')
      })
    })

    it('displays local capture only notice in live transcript when cloud transcription is off', async () => {
      render(<App bridge={mockBridge} />)

      // Start local-only capture
      fireEvent.click(
        screen.getByLabelText(
          /I acknowledge the local audio analysis policy and system-audio video-carrier disclosure/i
        )
      )
      fireEvent.click(
        screen.getByLabelText(
          /I confirm participant notification and compliance with applicable recording policies/i
        )
      )
      fireEvent.click(screen.getByTestId('start-capture-button'))

      await waitFor(() => {
        expect(screen.getByTestId('live-session-active')).toBeInTheDocument()
      })

      // Verify notice box indicates local volatile processing
      expect(screen.getByTestId('transcript-local-notice')).toBeInTheDocument()
      expect(screen.getByText(/Cloud Transcription Disabled \(Local Mode\)/i)).toBeInTheDocument()
    })

    it('mirrors live transcript stream into the side dock', async () => {
      render(<App bridge={mockBridge} initialDockExpanded={true} />)

      // Start session with pre-existing turn in bridge
      await mockBridge.startSession({
        sources: ['microphone'],
        consent: {
          remoteProcessingAccepted: true,
          conversationPolicyAcknowledged: true,
        },
        selectedDocumentIds: [],
      })

      mockBridge.emit({
        type: 'transcript.final',
        sessionId: 'fixture-session',
        turn: {
          id: 'turn-dock-1',
          source: 'microphone',
          text: 'Mirrored in side dock.',
          startedAtMs: 1000,
          endedAtMs: 2000,
        },
      })

      await waitFor(() => {
        expect(screen.getByTestId('docked-window-layout')).toBeInTheDocument()
        expect(screen.getByText('Mirrored in side dock.')).toBeInTheDocument()
      })
    })
  })
})
