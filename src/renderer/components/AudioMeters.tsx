import type { FC } from 'react'
import type { CaptureSource, CaptureSourceState } from '../../shared/contracts'

export interface AudioMetersProps {
  activeSources: CaptureSource[]
  sourceStates: Record<CaptureSource, CaptureSourceState>
}

const SOURCE_LABELS: Record<CaptureSource, string> = {
  microphone: 'Microphone (Local Input)',
  system: 'System Audio (Loopback)',
}

export const AudioMeters: FC<AudioMetersProps> = ({ activeSources, sourceStates }) => {
  const sourcesToDisplay: CaptureSource[] =
    activeSources.length > 0 ? activeSources : (['microphone', 'system'] as CaptureSource[])

  return (
    <div className="card">
      <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
        Live Audio Activity
      </h3>
      <p className="card-description">
        Real-time audio levels and frame counters for active capture routes.
      </p>

      <div className="meters-grid">
        {sourcesToDisplay.map((source) => {
          const state = sourceStates[source] || {
            phase: 'inactive',
            levelRms: 0,
            peak: 0,
            processedFrames: 0,
            errorMessage: null,
          }

          // Calculate normalized percentage (0 to 100)
          // Level RMS is normalized 0..1; amplify for visual responsiveness
          const percentRms = Math.min(100, Math.round(state.levelRms * 100 * 2.5))
          const percentPeak = Math.min(100, Math.round(state.peak * 100))

          return (
            <div key={source} className="meter-card" data-testid={`meter-${source}`}>
              <div className="meter-header">
                <span className="meter-title">{SOURCE_LABELS[source]}</span>
                <span className={`status-badge status-${state.phase}`} data-testid={`badge-${source}`}>
                  {state.phase}
                </span>
              </div>

              <div
                className="meter-bar-container"
                role="progressbar"
                aria-label={`${SOURCE_LABELS[source]} level`}
                aria-valuenow={percentRms}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="meter-bar-fill"
                  style={{ width: `${percentRms}%` }}
                  data-testid={`bar-${source}`}
                />
              </div>

              <div className="meter-stats">
                <span>RMS Level: {percentRms}%</span>
                <span>Peak: {percentPeak}%</span>
                <span>Frames: {state.processedFrames.toLocaleString()}</span>
              </div>

              {state.errorMessage && (
                <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Error: {state.errorMessage}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="source-route-note">
        Note: Source labels indicate audio capture routes, not verified speaker identities.
      </p>
    </div>
  )
}
