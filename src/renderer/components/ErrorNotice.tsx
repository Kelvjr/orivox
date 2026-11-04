import type { FC } from 'react'

export interface ErrorNoticeProps {
  message: string
  onDismiss?: () => void
}

export const ErrorNotice: FC<ErrorNoticeProps> = ({ message, onDismiss }) => {
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <div className="error-content">
        <div className="error-title">Capture Error</div>
        <p className="error-message">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="btn-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error notice"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
