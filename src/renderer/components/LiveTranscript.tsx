import { useEffect, useRef, useState, useCallback } from 'react'
import type { FC, UIEvent } from 'react'
import type {
  CaptureSource,
  TranscriptTurn,
  TranscriptionSourceState,
} from '../../shared/contracts'

export interface InterimTurn {
  id: string
  source: CaptureSource
  text: string
  observedAtMs: number
}

export interface LiveTranscriptProps {
  transcript: TranscriptTurn[]
  interimTurns?: Record<string, InterimTurn>
  transcriptionMode?: 'off' | 'cloud'
  transcriptionStates?: Record<CaptureSource, TranscriptionSourceState>
  activeSources?: CaptureSource[]
  compact?: boolean
}

function formatTimestamp(timestampMs?: number): string {
  if (!timestampMs) return ''
  const date = new Date(timestampMs)
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatRelativeTime(ms: number, sessionStartMs?: number | null): string {
  if (!sessionStartMs) return formatTimestamp(ms)
  const diffSec = Math.max(0, Math.floor((ms - sessionStartMs) / 1000))
  const minutes = Math.floor(diffSec / 60).toString().padStart(2, '0')
  const seconds = (diffSec % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export const LiveTranscript: FC<LiveTranscriptProps> = ({
  transcript,
  interimTurns = {},
  transcriptionMode = 'off',
  transcriptionStates,
  activeSources = ['microphone', 'system'],
  compact = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false)

  // Filter interim turns: exclude empty ones or turns that already exist in final transcript
  const activeInterimList = Object.values(interimTurns).filter(
    (turn) => turn.text.trim().length > 0 && !transcript.some((finalTurn) => finalTurn.id === turn.id)
  )

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const threshold = 60
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= threshold
    setIsNearBottom(atBottom)
    if (atBottom) {
      setShowScrollBottomButton(false)
    }
  }

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
      setIsNearBottom(true)
      setShowScrollBottomButton(false)
    }
  }, [])

  // Auto-scroll when new content arrives if user is near bottom
  useEffect(() => {
    if (!scrollContainerRef.current) return
    if (isNearBottom) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    } else if (transcript.length > 0 || activeInterimList.length > 0) {
      setShowScrollBottomButton(true)
    }
  }, [transcript, activeInterimList, isNearBottom])

  const isCloud = transcriptionMode === 'cloud'

  return (
    <div
      className={`live-transcript-card ${compact ? 'compact' : ''}`}
      data-testid="live-transcript-component"
    >
      <div className="transcript-header">
        <div className="transcript-title-row">
          <div className="transcript-title-group">
            <span className="transcript-icon" aria-hidden="true">
              📝
            </span>
            <h3 className="transcript-title">Real-Time Transcript</h3>
            {isCloud ? (
              <span className="transcript-mode-badge cloud">Deepgram Nova-3</span>
            ) : (
              <span className="transcript-mode-badge off">Local Capture Only</span>
            )}
          </div>

          {/* Source Connection Badges */}
          {isCloud && transcriptionStates && (
            <div className="source-transcription-statuses" aria-label="Transcription connection status per route">
              {activeSources.map((source) => {
                const state = transcriptionStates[source]
                const phase = state?.phase ?? 'off'
                return (
                  <div
                    key={source}
                    className={`transcription-status-pill phase-${phase}`}
                    data-testid={`transcription-status-${source}`}
                    title={state?.errorMessage ? `Error: ${state.errorMessage}` : `${source}: ${phase}`}
                  >
                    <span className={`status-dot dot-${phase}`} aria-hidden="true" />
                    <span className="status-label">
                      {source === 'microphone' ? 'Mic' : 'System'}: {phase}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Transcript Stream Container */}
      <div
        className="transcript-scroll-area"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="region"
        aria-label="Live conversation transcript"
        tabIndex={0}
      >
        {!isCloud && (
          <div className="transcript-notice-box" data-testid="transcript-local-notice">
            <span className="notice-icon" aria-hidden="true">
              🔒
            </span>
            <div>
              <strong>Cloud Transcription Disabled (Local Mode):</strong> Audio signals are analyzed strictly
              in local volatile memory for RMS level meters. No speech recognition or external audio transfer is
              active for this session.
            </div>
          </div>
        )}

        {isCloud && transcript.length === 0 && activeInterimList.length === 0 && (
          <div className="transcript-empty-state" data-testid="transcript-empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              🎙️
            </span>
            <div className="empty-state-text">
              <strong>Listening on active audio routes...</strong>
              <p>Speak into your microphone or play meeting audio to view real-time transcription.</p>
            </div>
          </div>
        )}

        {/* Polite Live Region for Final Completed Turns */}
        <div className="transcript-turns-list" aria-live="polite" aria-atomic="false">
          {transcript.map((turn) => (
            <article
              key={turn.id}
              className={`transcript-turn-card turn-source-${turn.source}`}
              data-testid={`transcript-turn-${turn.id}`}
            >
              <div className="turn-meta-header">
                <span className={`source-badge badge-${turn.source}`}>
                  {turn.source === 'microphone' ? (
                    <>
                      <span className="source-icon" aria-hidden="true">🎤</span>
                      <span>Microphone</span>
                    </>
                  ) : (
                    <>
                      <span className="source-icon" aria-hidden="true">🔊</span>
                      <span>System Audio</span>
                    </>
                  )}
                </span>
                <time className="turn-time" dateTime={new Date(turn.startedAtMs).toISOString()}>
                  {formatTimestamp(turn.startedAtMs)}
                </time>
              </div>
              <p className="turn-text">{turn.text}</p>
            </article>
          ))}
        </div>

        {/* Interim Hypotheses (Excluded from polite live region to prevent screen reader thrashing) */}
        {activeInterimList.length > 0 && (
          <div className="transcript-interim-container" aria-hidden="false">
            {activeInterimList.map((interim) => (
              <div
                key={interim.id}
                className={`transcript-turn-card interim turn-source-${interim.source}`}
                data-testid={`transcript-interim-${interim.id}`}
              >
                <div className="turn-meta-header">
                  <span className={`source-badge badge-${interim.source}`}>
                    {interim.source === 'microphone' ? '🎤 Microphone' : '🔊 System Audio'}
                  </span>
                  <span className="interim-indicator">
                    <span className="indicator-pulse-small" aria-hidden="true" />
                    <span>Hypothesis</span>
                  </span>
                </div>
                <p className="turn-text interim-text">{interim.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showScrollBottomButton && (
        <button
          type="button"
          className="scroll-to-bottom-button"
          onClick={scrollToBottom}
          aria-label="Scroll to newest transcript turns"
          data-testid="scroll-to-bottom-button"
        >
          ↓ New audio transcribed — Jump to latest
        </button>
      )}
    </div>
  )
}
