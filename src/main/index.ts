import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerCaptureAuthorization } from './capture-authorization'
import { DockWindowManager } from './dock-window'
import { TrayManager } from './tray'
import type { SessionEvent, SessionSnapshot, SessionStartRequest } from '../shared/contracts'

let mainWindow: BrowserWindow | null = null
let dockManager: DockWindowManager | null = null
let trayManager: TrayManager | null = null

const DEFAULT_GLOBAL_SHORTCUT = 'CommandOrControl+Shift+O'

let latestSnapshot: SessionSnapshot = {
  sessionId: null,
  phase: 'idle',
  activeSources: [],
  sourceStates: {
    microphone: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
    system: { phase: 'inactive', levelRms: 0, peak: 0, processedFrames: 0, errorMessage: null },
  },
  startedAtMs: null,
  transcript: [],
  suggestions: [],
  errorMessage: null,
}

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

let savedMainBounds: WindowBounds | null = null
let isMainDocked = false

function getRightOneThirdBounds(): { x: number; y: number; width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { workArea } = primaryDisplay
  const width = Math.max(340, Math.round(workArea.width / 3))
  return {
    x: Math.round(workArea.x + workArea.width - width),
    y: Math.round(workArea.y),
    width,
    height: Math.round(workArea.height),
  }
}

function dockMainToRight(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  }
  if (!mainWindow) return

  if (!isMainDocked) {
    savedMainBounds = mainWindow.getBounds()
    isMainDocked = true
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  const targetBounds = getRightOneThirdBounds()
  mainWindow.setBounds(targetBounds)
  mainWindow.setAlwaysOnTop(true)
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('orivox:window:dock-state-changed', true)
  syncTray()
}

function restoreMainFromDock(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  isMainDocked = false
  mainWindow.setAlwaysOnTop(false)

  if (savedMainBounds) {
    mainWindow.setBounds(savedMainBounds)
  } else {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay
    const width = 1080
    const height = 740
    mainWindow.setBounds({
      width,
      height,
      x: Math.round(workArea.x + (workArea.width - width) / 2),
      y: Math.round(workArea.y + (workArea.height - height) / 2),
    })
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('orivox:window:dock-state-changed', false)
  syncTray()
}

function toggleDock(): boolean {
  if (isMainDocked) {
    restoreMainFromDock()
    return false
  } else {
    dockMainToRight()
    return true
  }
}

function syncTray(): void {
  if (trayManager) {
    const isDockVisible = isMainDocked || Boolean(dockManager?.isVisible())
    const isMainVisible = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized())
    trayManager.updateState(latestSnapshot, isDockVisible, isMainVisible)
  }
}

function minimizeMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
    mainWindow.minimize()
    syncTray()
  }
}

function restoreMainWindow(): void {
  restoreMainFromDock()
}

function toggleMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
    mainWindow.focus()
  } else if (mainWindow.isVisible()) {
    mainWindow.minimize()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
  syncTray()
}

function requestStopCapture(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('orivox:session:stop-request')
  }
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 320,
    minHeight: 400,
    show: false,
    backgroundColor: '#080c14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      additionalArguments: ['--window-type=main'],
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  mainWindow = window

  const captureAuthorization = registerCaptureAuthorization(window)
  window.on('closed', () => {
    captureAuthorization.dispose()
    mainWindow = null
    syncTray()
  })

  window.on('minimize', () => syncTray())
  window.on('restore', () => syncTray())
  window.on('show', () => syncTray())
  window.on('hide', () => syncTray())

  const rendererUrl = process.env.ELECTRON_RENDERER_URL ??
    pathToFileURL(join(__dirname, '../renderer/index.html')).toString()
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl) event.preventDefault()
  })

  window.once('ready-to-show', () => {
    window.show()
    syncTray()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function setupIpc(): void {
  // Session event forwarded from main window preload
  ipcMain.on('orivox:session:event', (_event, sessionEvent: SessionEvent) => {
    if (sessionEvent.type === 'capture.status') {
      latestSnapshot = sessionEvent.snapshot
    } else if (sessionEvent.type === 'capture.level' && latestSnapshot.sessionId === sessionEvent.sessionId) {
      latestSnapshot.sourceStates[sessionEvent.source] = {
        ...latestSnapshot.sourceStates[sessionEvent.source],
        levelRms: sessionEvent.levelRms,
        peak: sessionEvent.peak,
        processedFrames: sessionEvent.processedFrames,
      }
    } else if (sessionEvent.type === 'session.error') {
      latestSnapshot.errorMessage = sessionEvent.message
      if (!sessionEvent.recoverable) latestSnapshot.phase = 'error'
    }

    // Forward event to the separate dock window
    dockManager?.sendSessionEvent(sessionEvent)
    syncTray()
  })

  // Snapshot retrieval for the dock window
  ipcMain.handle('orivox:session:get-snapshot', async () => {
    return latestSnapshot
  })

  // Remote stop request from the dock window or tray
  ipcMain.handle('orivox:session:stop', async () => {
    requestStopCapture()
  })

  // Remote start request from the dock window
  ipcMain.handle('orivox:session:start', async (_event, request: SessionStartRequest) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('orivox:session:start-request', request)
    }
    return latestSnapshot
  })

  // Window management
  ipcMain.handle('orivox:window:minimize-main', async () => {
    minimizeMainWindow()
  })

  ipcMain.handle('orivox:window:restore-main', async () => {
    restoreMainFromDock()
  })

  // Desktop side dock window management
  ipcMain.handle('orivox:dock:toggle', async () => {
    return toggleDock()
  })

  ipcMain.handle('orivox:dock:show', async () => {
    dockMainToRight()
    return true
  })

  ipcMain.handle('orivox:dock:hide', async () => {
    restoreMainFromDock()
    return false
  })

  ipcMain.handle('orivox:dock:is-docked', async () => {
    return isMainDocked
  })
}

function registerShortcuts(): void {
  try {
    globalShortcut.register(DEFAULT_GLOBAL_SHORTCUT, () => {
      toggleDock()
    })
  } catch (err) {
    console.error('Failed to register global shortcut:', err)
  }
}

async function initializeApp(): Promise<void> {
  setupIpc()
  dockManager = new DockWindowManager()
  dockManager.createWindow()

  trayManager = new TrayManager({
    onToggleDock: () => {
      toggleDock()
    },
    onToggleMain: () => toggleMainWindow(),
    onStopCapture: () => requestStopCapture(),
    onQuit: () => {
      dockManager?.destroy()
      trayManager?.destroy()
      globalShortcut.unregisterAll()
      app.quit()
    },
  })
  trayManager.createTray()

  registerShortcuts()
  createMainWindow()
}

void app.whenReady().then(initializeApp)

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // On Windows, if capturing in the background, keep running in the tray unless user quits
  if (latestSnapshot.phase !== 'capturing') {
    app.quit()
  }
})
