import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { extname } from 'node:path'
import { fileExists, isSupportedAudio, readTracks, scanFolder } from './library.js'
import { parseM3u, writeM3u } from './playlist.js'
import { loadSettings, saveSettings } from './store.js'
import { SUPPORTED_EXTENSIONS, type Settings, type Track } from '../shared/types.js'

const AUDIO_FILTER = {
  name: 'Audio files',
  extensions: [...SUPPORTED_EXTENSIONS]
}

const PLAYLIST_FILTER = { name: 'Playlists', extensions: ['m3u', 'm3u8'] }

function windowFor(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dialog:openFiles', async (event): Promise<Track[]> => {
    const win = windowFor(event)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Add files',
          properties: ['openFile', 'multiSelections'],
          filters: [AUDIO_FILTER, { name: 'All files', extensions: ['*'] }]
        })
      : { canceled: true, filePaths: [] as string[] }

    if (result.canceled) return []
    return readTracks(result.filePaths.filter(isSupportedAudio))
  })

  ipcMain.handle('dialog:openFolder', async (event): Promise<Track[]> => {
    const win = windowFor(event)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Add folder',
          properties: ['openDirectory']
        })
      : { canceled: true, filePaths: [] as string[] }

    if (result.canceled || result.filePaths.length === 0) return []
    const files = await scanFolder(result.filePaths[0])
    return readTracks(files)
  })

  ipcMain.handle('dialog:openPlaylist', async (event): Promise<Track[]> => {
    const win = windowFor(event)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Load playlist',
          properties: ['openFile'],
          filters: [PLAYLIST_FILTER]
        })
      : { canceled: true, filePaths: [] as string[] }

    if (result.canceled || result.filePaths.length === 0) return []
    const paths = await parseM3u(result.filePaths[0])
    const existing: string[] = []
    for (const path of paths) {
      if (isSupportedAudio(path) && (await fileExists(path))) existing.push(path)
    }
    return readTracks(existing)
  })

  ipcMain.handle('dialog:savePlaylist', async (event, tracks: Track[]): Promise<boolean> => {
    const win = windowFor(event)
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: 'Save playlist',
      defaultPath: 'playlist.m3u8',
      filters: [PLAYLIST_FILTER]
    })
    if (result.canceled || !result.filePath) return false

    const target = extname(result.filePath) ? result.filePath : `${result.filePath}.m3u8`
    await writeM3u(target, tracks)
    return true
  })

  /** For drag-and-drop: the paths may be either files or folders. */
  ipcMain.handle('library:addPaths', async (_event, paths: string[]): Promise<Track[]> => {
    const files: string[] = []
    for (const path of paths) {
      if (isSupportedAudio(path)) {
        if (await fileExists(path)) files.push(path)
      } else {
        files.push(...(await scanFolder(path)))
      }
    }
    return readTracks(files)
  })

  ipcMain.handle('library:readTracks', (_event, paths: string[]): Promise<Track[]> => {
    return readTracks(paths)
  })

  ipcMain.handle('settings:load', (): Promise<Settings> => loadSettings())

  ipcMain.handle('settings:save', (_event, settings: Settings): Promise<void> => {
    return saveSettings(settings)
  })

  ipcMain.handle('shell:showInFolder', (_event, filePath: string): void => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('window:minimize', (event): void => {
    windowFor(event)?.minimize()
  })

  ipcMain.handle('window:close', (event): void => {
    windowFor(event)?.close()
  })

  ipcMain.handle('window:setSize', (event, width: number, height: number): void => {
    const win = windowFor(event)
    if (!win) return
    win.setContentSize(Math.round(width), Math.round(height), false)
  })
}
