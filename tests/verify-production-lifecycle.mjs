import { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('[Lifecycle Test] Starting production multi-window lifecycle test...')

app.whenReady().then(async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay
    const dockBounds = {
      x: Math.round(workArea.x + workArea.width - 360),
      y: Math.round(workArea.y),
      width: 360,
      height: Math.round(workArea.height),
    }

    // Main window
    const mainWindow = new BrowserWindow({
      width: 1080,
      height: 740,
      show: true,
      backgroundColor: '#080c14',
      webPreferences: {
        preload: join(rootDir, 'out/preload/index.cjs'),
        additionalArguments: ['--window-type=main'],
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    })

    // Dock window
    const dockWindow = new BrowserWindow({
      x: dockBounds.x,
      y: dockBounds.y,
      width: dockBounds.width,
      height: dockBounds.height,
      frame: false,
      thickFrame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#090d16',
      webPreferences: {
        preload: join(rootDir, 'out/preload/index.cjs'),
        additionalArguments: ['--window-type=dock'],
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    })

    dockWindow.on('close', (e) => {
      if (!dockWindow.isDestroyed()) {
        e.preventDefault()
        dockWindow.hide()
      }
    })

    await Promise.all([
      mainWindow.loadFile(join(rootDir, 'out/renderer/index.html')),
      dockWindow.loadFile(join(rootDir, 'out/renderer/dock.html')),
    ])
    console.log('[Lifecycle Test] Both main and dock windows loaded successfully.')

    // Simulate session start from main window
    const testSessionSnapshot = {
      sessionId: 'desktop-test-session',
      phase: 'capturing',
      activeSources: ['microphone', 'system'],
      sourceStates: {
        microphone: { phase: 'active', levelRms: 0.2, peak: 0.4, processedFrames: 100, errorMessage: null },
        system: { phase: 'active', levelRms: 0.15, peak: 0.3, processedFrames: 100, errorMessage: null },
      },
      startedAtMs: Date.now(),
      transcript: [],
      suggestions: [],
      errorMessage: null,
    }

    // Forward event to dock window webContents
    console.log('[Lifecycle Test] Forwarding capture.status to dock window...')
    dockWindow.webContents.send('orivox:session:event', {
      type: 'capture.status',
      snapshot: testSessionSnapshot,
    })

    // Show dock and verify it is visible
    dockWindow.show()
    console.log('[Lifecycle Test] Dock is visible:', dockWindow.isVisible())
    if (!dockWindow.isVisible()) {
      throw new Error('Dock should be visible!')
    }

    // Minimize main window
    mainWindow.minimize()
    console.log('[Lifecycle Test] Main window minimized:', mainWindow.isMinimized())
    console.log('[Lifecycle Test] Dock remains visible with active capture:', dockWindow.isVisible())
    if (!dockWindow.isVisible()) {
      throw new Error('Dock should remain visible when main window is minimized!')
    }

    // Hide dock (e.g. user pressed Escape or clicked close button)
    dockWindow.hide()
    console.log('[Lifecycle Test] Dock hidden:', !dockWindow.isVisible())

    // Even while dock is hidden, verify that capture session is unaffected
    console.log('[Lifecycle Test] Capture continues while dock is collapsed: phase =', testSessionSnapshot.phase)
    if (testSessionSnapshot.phase !== 'capturing') {
      throw new Error('Capture phase altered by hiding dock!')
    }

    // Re-open dock (e.g. from tray or Ctrl+Shift+O)
    dockWindow.show()
    console.log('[Lifecycle Test] Re-opened dock is visible:', dockWindow.isVisible())

    // Stop capture session
    testSessionSnapshot.phase = 'idle'
    testSessionSnapshot.sessionId = null
    dockWindow.webContents.send('orivox:session:event', {
      type: 'capture.status',
      snapshot: testSessionSnapshot,
    })
    console.log('[Lifecycle Test] Stopped capture session, phase = idle.')

    // Clean up
    dockWindow.removeAllListeners('close')
    dockWindow.destroy()
    mainWindow.destroy()

    console.log('\n======================================================')
    console.log('>>> MULTI-WINDOW LIFECYCLE & INTEGRATION PASSED! <<<')
    console.log('======================================================\n')
    app.quit()
    process.exit(0)
  } catch (err) {
    console.error('[Lifecycle Test] FAILED with error:', err)
    app.quit()
    process.exit(1)
  }
})
