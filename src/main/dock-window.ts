import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SessionEvent } from '../shared/contracts'

export class DockWindowManager {
  private window: BrowserWindow | null = null
  private readonly dockWidth = 360

  createWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window
    }

    const bounds = this.getRightEdgeBounds()

    this.window = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      thickFrame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      transparent: false,
      backgroundColor: '#090d16',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        additionalArguments: ['--window-type=dock'],
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    })

    // Prevent actual destroy on close so the window can be instantly reshown
    this.window.on('close', (event) => {
      if (this.window && !this.window.isDestroyed()) {
        event.preventDefault()
        this.window.hide()
      }
    })

    const dockUrl = process.env.ELECTRON_RENDERER_URL
      ? `${process.env.ELECTRON_RENDERER_URL}/dock.html`
      : pathToFileURL(join(__dirname, '../renderer/dock.html')).toString()

    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.window.webContents.on('will-navigate', (event, url) => {
      if (url !== dockUrl) event.preventDefault()
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      void this.window.loadURL(dockUrl)
    } else {
      void this.window.loadFile(join(__dirname, '../renderer/dock.html'))
    }

    return this.window
  }

  show(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow()
    }
    this.repositionToRightEdge()
    this.window?.show()
    this.window?.focus()
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  toggle(): boolean {
    if (this.isVisible()) {
      this.hide()
      return false
    } else {
      this.show()
      return true
    }
  }

  isVisible(): boolean {
    return Boolean(this.window && !this.window.isDestroyed() && this.window.isVisible())
  }

  sendSessionEvent(event: SessionEvent): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('orivox:session:event', event)
    }
  }

  private repositionToRightEdge(): void {
    if (!this.window || this.window.isDestroyed()) return
    const bounds = this.getRightEdgeBounds()
    this.window.setBounds(bounds)
  }

  private getRightEdgeBounds(): { x: number; y: number; width: number; height: number } {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay
    const dockWidth = Math.max(340, Math.round(workArea.width / 3))
    return {
      x: Math.round(workArea.x + workArea.width - dockWidth),
      y: Math.round(workArea.y),
      width: dockWidth,
      height: Math.round(workArea.height),
    }
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.removeAllListeners('close')
      this.window.close()
      this.window = null
    }
  }
}
