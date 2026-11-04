import { Tray, Menu, nativeImage, app } from 'electron'
import type { SessionSnapshot } from '../shared/contracts'

export interface TrayCallbacks {
  onToggleDock: () => void
  onToggleMain: () => void
  onStopCapture: () => void
  onQuit: () => void
}

// 16x16 PNG microphone icon base64 for reliable native rendering on Windows
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAa0lEQVQ4T2NkoBAwUqifYdQAYhgwMLD8Z2Bg+A/iM0AxEAPFYAYM/4GYg5mFEYQZYDQDA0wtigb0MKA7gGgDsBtGtkG4DCAaQJRhRPsAi01EGkC0AUQbhmsARg0gjgE4/U1oGDAwMNygqIEAAItEEhFp3hZ/AAAAAElEQVQ4T2NkoBAwUqifYdQAYhgwMLD8Z2Bg+A/iM0AxEAPFYAYM/4GYg5mFEYQZYDQDA0wtigb0MKA7gGgDsBtGtkG4DCAaQJRhRPsAi01EGkC0AUQbhmsARg0gjgE4/U1oGDAwMNygqIEAAItEEhFp3hZ/'

export class TrayManager {
  private tray: Tray | null = null
  private currentSnapshot: SessionSnapshot | null = null
  private isDockVisible = false
  private isMainVisible = true

  constructor(private readonly callbacks: TrayCallbacks) {}

  createTray(): Tray {
    if (this.tray && !this.tray.isDestroyed()) {
      return this.tray
    }

    const image = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
    this.tray = new Tray(image)
    this.tray.setToolTip('Orivox - Personal Meeting Copilot')

    this.tray.on('click', () => {
      this.callbacks.onToggleDock()
    })

    this.rebuildMenu()
    return this.tray
  }

  updateState(snapshot: SessionSnapshot, isDockVisible: boolean, isMainVisible: boolean): void {
    this.currentSnapshot = snapshot
    this.isDockVisible = isDockVisible
    this.isMainVisible = isMainVisible
    this.rebuildMenu()
  }

  private rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return

    const isCapturing = this.currentSnapshot?.phase === 'capturing'
    const statusText = isCapturing ? 'Recording Active' : 'Idle'

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Orivox: ${statusText}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: this.isDockVisible ? 'Hide Desktop Side Dock' : 'Show Desktop Side Dock (Ctrl+Shift+O)',
        click: () => this.callbacks.onToggleDock(),
      },
      {
        label: this.isMainVisible ? 'Minimize Main Window' : 'Open Main Window',
        click: () => this.callbacks.onToggleMain(),
      },
      { type: 'separator' },
      ...(isCapturing
        ? [
            {
              label: 'Stop Audio Capture',
              click: () => this.callbacks.onStopCapture(),
            },
            { type: 'separator' as const },
          ]
        : []),
      {
        label: 'Exit Orivox',
        click: () => this.callbacks.onQuit(),
      },
    ])

    this.tray.setContextMenu(contextMenu)
    this.tray.setToolTip(`Orivox - ${statusText}`)
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
