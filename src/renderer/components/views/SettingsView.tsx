import { useState } from 'react'
import type { FC } from 'react'
import type { SessionMode } from './HomeView'

export interface SettingsViewProps {
  defaultMode: SessionMode
  onDefaultModeChange: (mode: SessionMode) => void
  autoExpandDock: boolean
  onAutoExpandDockChange: (val: boolean) => void
}

export const SettingsView: FC<SettingsViewProps> = ({
  defaultMode,
  onDefaultModeChange,
  autoExpandDock,
  onAutoExpandDockChange,
}) => {
  const [defaultSourcePref, setDefaultSourcePref] = useState<'both' | 'mic-only' | 'system-only'>('both')

  return (
    <div className="view-container settings-view" data-testid="settings-view">
      <header className="view-header">
        <h1 className="view-title">Settings & Preferences</h1>
        <p className="view-subtitle">Manage audio capture defaults, application behavior, and future integrations.</p>
      </header>

      {/* 1. Functional Local Preferences */}
      <section className="card settings-group" aria-labelledby="general-preferences-heading">
        <h2 id="general-preferences-heading" className="card-title">
          Application Preferences
        </h2>
        <p className="card-description">Configure the default workspace behavior for this device.</p>

        <div className="settings-field">
          <div className="field-meta">
            <label htmlFor="pref-default-mode" className="field-title">
              Default Session Mode
            </label>
            <span className="field-desc">Choose the preset mode when starting a session from Home.</span>
          </div>
          <select
            id="pref-default-mode"
            className="settings-select"
            value={defaultMode}
            onChange={(e) => onDefaultModeChange(e.target.value as SessionMode)}
          >
            <option value="interview">Interview Mode (Grounded Answers)</option>
            <option value="meeting">Meeting Mode (Action Items & Notes)</option>
          </select>
        </div>

        <div className="settings-field">
          <div className="field-meta">
            <label htmlFor="pref-default-sources" className="field-title">
              Default Audio Capture Preset
            </label>
            <span className="field-desc">Initial selection of audio sources on setup.</span>
          </div>
          <select
            id="pref-default-sources"
            className="settings-select"
            value={defaultSourcePref}
            onChange={(e) => setDefaultSourcePref(e.target.value as 'both' | 'mic-only' | 'system-only')}
          >
            <option value="both">Both Microphone & System Audio</option>
            <option value="mic-only">Microphone Only (Voice Input)</option>
            <option value="system-only">System Audio Only (Loopback)</option>
          </select>
        </div>

        <div className="settings-field">
          <div className="field-meta">
            <span className="field-title">In-App Dock Preview Behavior</span>
            <span className="field-desc">Automatically expand the in-app side dock preview when live capture begins.</span>
          </div>
          <label className="toggle-switch-label">
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={autoExpandDock}
              onChange={(e) => onAutoExpandDockChange(e.target.checked)}
            />
            <span className="toggle-switch-slider" />
          </label>
        </div>

        <div className="settings-field">
          <div className="field-meta">
            <span className="field-title">Application Theme</span>
            <span className="field-desc">Desktop UI color scheme.</span>
          </div>
          <span className="settings-pill-active">Windows Dark (Fluent)</span>
        </div>
      </section>

      {/* 2. Future Integrations (Clearly Labelled as Unavailable in M1) */}
      <section className="card settings-group disabled-features-group" aria-labelledby="future-services-heading">
        <div className="group-header-with-badge">
          <h2 id="future-services-heading" className="card-title">
            AI & Cloud Services Integration
          </h2>
          <span className="badge-roadmap">Roadmap Preview</span>
        </div>
        <p className="card-description">
          These cloud and local AI services are not connected in Milestone 1. Local privacy guardrails are active.
        </p>

        <div className="settings-field disabled-field">
          <div className="field-meta">
            <span className="field-title">Speech-to-Text Transcription Provider</span>
            <span className="field-desc">
              Cloud streaming speech recognition engine for live call transcription.
            </span>
          </div>
          <div className="disabled-badge-tag">Milestone 2 (Requires Remote Consent)</div>
        </div>

        <div className="settings-field disabled-field">
          <div className="field-meta">
            <span className="field-title">Reasoning & Copilot Language Model</span>
            <span className="field-desc">
              AI provider connection for live question detection and talking point synthesis.
            </span>
          </div>
          <div className="disabled-badge-tag">Milestone 3 (Offline in M1)</div>
        </div>

        <div className="settings-field disabled-field">
          <div className="field-meta">
            <span className="field-title">Knowledge Base & Resume Indexing</span>
            <span className="field-desc">
              Local SQLite document store and snippet grounding (PDF, DOCX, TXT).
            </span>
          </div>
          <div className="disabled-badge-tag">Milestone 5 (Local Vault)</div>
        </div>

        <div className="settings-field disabled-field">
          <div className="field-meta">
            <span className="field-title">OS Global Shortcuts & Windows System Tray</span>
            <span className="field-desc">
              Custom global hotkey bindings and minimize-to-tray background execution.
            </span>
          </div>
          <div className="disabled-badge-tag">Main Process (Coordinated with Codex)</div>
        </div>
      </section>
    </div>
  )
}
