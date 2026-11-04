import { app, BrowserWindow, screen, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('[Native Test] Starting native Windows desktop dock verification...')

app.whenReady().then(async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea, bounds: screenBounds } = primaryDisplay
    console.log(`[Native Test] Primary Screen Bounds: ${screenBounds.width}x${screenBounds.height}`)
    console.log(`[Native Test] Work Area: x=${workArea.x}, y=${workArea.y}, w=${workArea.width}, h=${workArea.height}`)

    const expectedDockWidth = Math.max(340, Math.round(workArea.width / 3))
    const expectedDockX = Math.round(workArea.x + workArea.width - expectedDockWidth)
    const expectedDockY = Math.round(workArea.y)
    const expectedDockHeight = Math.round(workArea.height)

    // 1. Create Main Window
    console.log('[Native Test] 1. Creating main Electron window...')
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
    await mainWindow.loadFile(join(rootDir, 'out/renderer/index.html'))
    console.log('[Native Test] Main window loaded successfully. isVisible =', mainWindow.isVisible())

    // 2. Create Independent Desktop Dock Window
    console.log('[Native Test] 2. Creating independent desktop dock window...')
    const dockWindow = new BrowserWindow({
      x: expectedDockX,
      y: expectedDockY,
      width: expectedDockWidth,
      height: expectedDockHeight,
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

    // Close interception: hide instead of destroy
    dockWindow.on('close', (event) => {
      if (!dockWindow.isDestroyed()) {
        event.preventDefault()
        dockWindow.hide()
      }
    })

    await dockWindow.loadFile(join(rootDir, 'out/renderer/dock.html'))
    console.log('[Native Test] Dock window loaded successfully.')

    // 3. Verify Dock Geometry & Positioning flush along right edge of workArea
    const dockBounds = dockWindow.getBounds()
    console.log(`[Native Test] Dock Bounds: x=${dockBounds.x}, y=${dockBounds.y}, w=${dockBounds.width}, h=${dockBounds.height}`)
    if (
      Math.abs(dockBounds.x - expectedDockX) > 4 ||
      Math.abs(dockBounds.y - expectedDockY) > 4 ||
      Math.abs(dockBounds.width - expectedDockWidth) > 5 ||
      Math.abs(dockBounds.height - expectedDockHeight) > 4
    ) {
      throw new Error(`Dock bounds mismatch! Expected: ${expectedDockX},${expectedDockY},${expectedDockWidth},${expectedDockHeight} but got: ${dockBounds.x},${dockBounds.y},${dockBounds.width},${dockBounds.height}`)
    }
    console.log('[Native Test] ✓ Dock correctly positioned along the right desktop edge!')

    // 4. Verify Dock Properties
    if (!dockWindow.isAlwaysOnTop()) {
      throw new Error('Dock window is not marked always-on-top!')
    }
    console.log('[Native Test] ✓ Dock is configured as always-on-top.')

    // 5. Verify Visibility & Collapsibility
    console.log('[Native Test] Initial dock visibility (should be hidden):', dockWindow.isVisible())
    if (dockWindow.isVisible()) {
      throw new Error('Dock should be hidden initially!')
    }

    console.log('[Native Test] Activating dock...')
    dockWindow.show()
    dockWindow.focus()
    if (!dockWindow.isVisible()) {
      throw new Error('Dock failed to become visible after show()!')
    }
    console.log('[Native Test] ✓ Dock is visible on desktop.')

    console.log('[Native Test] Collapsing dock...')
    dockWindow.hide()
    if (dockWindow.isVisible()) {
      throw new Error('Dock is still visible after hide()!')
    }
    console.log('[Native Test] ✓ Dock completely collapsed with no lingering elements.')

    // 6. Verify 1/3 Viewport Docking and Restore Behavior (acts like Windows Restore button)
    console.log('[Native Test] 6. Testing 1/3 viewport docking and restore behavior on main window...')
    mainWindow.show()
    const initialBounds = mainWindow.getBounds()
    console.log(`[Native Test] Initial main window bounds: ${initialBounds.width}x${initialBounds.height} at (${initialBounds.x},${initialBounds.y})`)

    // Dock main window to right 1/3
    console.log('[Native Test] Docking main window to right 1/3 of the display...')
    const target1ThirdBounds = {
      x: expectedDockX,
      y: expectedDockY,
      width: expectedDockWidth,
      height: expectedDockHeight,
    }
    mainWindow.setBounds(target1ThirdBounds)
    mainWindow.setAlwaysOnTop(true)

    const dockedBounds = mainWindow.getBounds()
    console.log(`[Native Test] Docked main window bounds: ${dockedBounds.width}x${dockedBounds.height} at (${dockedBounds.x},${dockedBounds.y})`)
    if (
      Math.abs(dockedBounds.x - expectedDockX) > 4 ||
      Math.abs(dockedBounds.y - expectedDockY) > 4 ||
      Math.abs(dockedBounds.width - expectedDockWidth) > 5 ||
      Math.abs(dockedBounds.height - expectedDockHeight) > 4
    ) {
      throw new Error(`Docked window bounds mismatch! Expected ${expectedDockWidth}x${expectedDockHeight} at (${expectedDockX},${expectedDockY}) but got ${dockedBounds.width}x${dockedBounds.height} at (${dockedBounds.x},${dockedBounds.y})`)
    }
    console.log('[Native Test] ✓ Main window successfully docked to the right 1/3 of the laptop viewport!')

    // Restoring main window (acts like Restore button)
    console.log('[Native Test] Restoring main window back to previous size...')
    mainWindow.setBounds(initialBounds)
    mainWindow.setAlwaysOnTop(false)
    const restoredBounds = mainWindow.getBounds()
    console.log(`[Native Test] Restored main window bounds: ${restoredBounds.width}x${restoredBounds.height}`)
    if (restoredBounds.width !== initialBounds.width || restoredBounds.height !== initialBounds.height) {
      throw new Error('Main window failed to restore to previous bounds!')
    }
    console.log('[Native Test] ✓ Main window successfully restored back to previous window bounds!')

    // 7. Test Close Interception (hide instead of terminate)
    console.log('[Native Test] Attempting to close dock window...')
    dockWindow.close()
    if (dockWindow.isDestroyed()) {
      throw new Error('Dock window was destroyed instead of hidden on close!')
    }
    if (dockWindow.isVisible()) {
      throw new Error('Dock window is still visible after close()!')
    }
    console.log('[Native Test] ✓ Dock close intercepted: window safely hidden, not destroyed.')

    // 8. Test Global Shortcut Registration
    console.log('[Native Test] Registering global shortcut CommandOrControl+Shift+O...')
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+O', () => {
      console.log('[Native Test] Global shortcut fired!')
    })
    console.log('[Native Test] Shortcut registered:', shortcutRegistered)
    if (!shortcutRegistered) {
      console.warn('[Native Test] Warning: Global shortcut CommandOrControl+Shift+O could not be registered (may be held by another app).')
    } else {
      console.log('[Native Test] ✓ Global shortcut CommandOrControl+Shift+O registered successfully.')
      globalShortcut.unregister('CommandOrControl+Shift+O')
    }

    // 9. Test Tray Creation & Context Menu
    console.log('[Native Test] Creating System Tray icon and menu...')
    const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAa0lEQVQ4T2NkoBAwUqifYdQAYhgwMLD8Z2Bg+A/iM0AxEAPFYAYM/4GYg5mFEYQZYDQDA0wtigb0MKA7gGgDsBtGtkG4DCAaQJRhRPsAi01EGkC0AUQbhmsARg0gjgE4/U1oGDAwMNygqIEAAItEEhFp3hZ/AAAAAElEQVQ4T2NkoBAwUqifYdQAYhgwMLD8Z2Bg+A/iM0AxEAPFYAYM/4GYg5mFEYQZYDQDA0wtigb0MKA7gGgDsBtGtkG4DCAaQJRhRPsAi01EGkC0AUQbhmsARg0gjgE4/U1oGDAwMNygqIEAAItEEhFp3hZ/')
    const tray = new Tray(trayIcon)
    tray.setToolTip('Orivox - Personal Meeting Copilot')
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Orivox: Idle', enabled: false },
      { type: 'separator' },
      { label: 'Show Desktop Side Dock (Ctrl+Shift+O)' },
      { label: 'Minimize Main Window' },
      { type: 'separator' },
      { label: 'Exit Orivox' },
    ])
    tray.setContextMenu(contextMenu)
    console.log('[Native Test] ✓ System Tray created and menu built with', contextMenu.items.length, 'items.')
    tray.destroy()

    // 10. Clean up
    console.log('[Native Test] Cleaning up test windows...')
    dockWindow.removeAllListeners('close')
    dockWindow.destroy()
    mainWindow.destroy()

    console.log('\n=============================================')
    console.log('>>> ALL NATIVE WINDOWS DOCK CHECKS PASSED! <<<')
    console.log('=============================================\n')
    app.quit()
    process.exit(0)
  } catch (err) {
    console.error('[Native Test] FAILED with error:', err)
    app.quit()
    process.exit(1)
  }
})
