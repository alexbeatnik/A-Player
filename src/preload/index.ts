import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { toAudioUrl } from '../shared/protocol.js'
import type { Settings, Track } from '../shared/types.js'

const api = {
  openFiles: (): Promise<Track[]> => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: (): Promise<Track[]> => ipcRenderer.invoke('dialog:openFolder'),
  openPlaylist: (): Promise<Track[]> => ipcRenderer.invoke('dialog:openPlaylist'),
  savePlaylist: (tracks: Track[]): Promise<boolean> =>
    ipcRenderer.invoke('dialog:savePlaylist', tracks),

  addPaths: (paths: string[]): Promise<Track[]> => ipcRenderer.invoke('library:addPaths', paths),
  readTracks: (paths: string[]): Promise<Track[]> => ipcRenderer.invoke('library:readTracks', paths),

  loadSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: Settings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:showInFolder', filePath),

  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),

  /**
   * File.path was removed in Electron 32 — this is the only supported way to
   * learn the path of a file dropped onto the window.
   */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  audioUrl: toAudioUrl,

  /** Files opened through file associations or a second instance of the app. */
  onOpenPaths: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paths: string[]): void => callback(paths)
    ipcRenderer.on('app:openPaths', listener)
    return () => ipcRenderer.off('app:openPaths', listener)
  }
}

contextBridge.exposeInMainWorld('aplayer', api)

export type APlayerApi = typeof api
