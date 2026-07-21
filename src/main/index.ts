import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAppProtocol, registerAppScheme } from './protocol.js'
import { registerIpcHandlers } from './ipc.js'
import { isSupportedAudio } from './library.js'
import { APP_ORIGIN } from '../shared/protocol.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null

/** Files passed on the command line or via file type associations. */
function audioArgsFrom(argv: string[]): string[] {
  return argv.slice(1).filter((arg) => !arg.startsWith('-') && isSupportedAudio(arg))
}

function createWindow(): void {
  const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    // The player has a fixed layout, so the window is a fixed size: no resizing,
    // no maximise, no fullscreen.
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    backgroundColor: '#12161c',
    title: 'A-Player',
    // In a packaged app electron-builder sets the exe icon; passing it by hand
    // is only needed in dev, where we run from a bare Electron binary.
    ...(isDev ? { icon: join(__dirname, '../../build/icon.ico') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    const pending = audioArgsFrom(process.argv)
    if (pending.length > 0) mainWindow?.webContents.send('app:openPaths', pending)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links open in the system browser, not inside the player.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // In production the page is served by the same app:// origin as the audio;
  // file:// will not do, because that makes media cross-origin and Web Audio
  // silences it.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
  }
}

registerAppScheme()

// A second copy of the player should hand its files to the first one rather
// than opening a separate window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    const paths = audioArgsFrom(argv)
    if (paths.length > 0) mainWindow.webContents.send('app:openPaths', paths)
  })

  app.whenReady().then(() => {
    handleAppProtocol(join(__dirname, '../renderer'))
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
