/** Formats Chromium can decode inside Electron. */
export const SUPPORTED_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'ogg',
  'oga',
  'opus',
  'm4a',
  'm4b',
  'aac',
  'mp4',
  'webm',
  'weba'
] as const

export interface Track {
  /** Absolute path on disk — doubles as the track's unique key. */
  path: string
  title: string
  artist: string
  album: string
  /** Seconds; 0 when metadata has not been read yet. */
  duration: number
  trackNo: number | null
  year: number | null
  genre: string
  /** kbps */
  bitrate: number | null
  /** Hz */
  sampleRate: number | null
  channels: number | null
  /** Codec as reported by music-metadata, e.g. "MPEG 1 Layer 3". */
  codec: string
  /** Cover art as a data URI; null when the file has none. */
  cover: string | null
}

export type RepeatMode = 'off' | 'all' | 'one'

export interface EqualizerState {
  enabled: boolean
  /** Gain applied before the EQ, in dB (-12…+12). */
  preamp: number
  /** Levels of the 10 bands, in dB (-12…+12). */
  bands: number[]
}

export interface Settings {
  volume: number
  balance: number
  shuffle: boolean
  repeat: RepeatMode
  equalizer: EqualizerState
  /** Tracks of the last playlist — restored on startup. */
  playlist: string[]
  currentIndex: number
  /** Folders added to the library. */
  libraryFolders: string[]
}

/** Band centre frequencies — the classic 10-band layout. */
export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000] as const

export const EQ_PRESETS: Record<string, number[]> = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Rock': [5, 4, -3, -5, -2, 2, 5, 7, 7, 7],
  'Pop': [-2, 3, 5, 5, 2, -1, -2, -2, -1, -1],
  'Jazz': [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
  'Classical': [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
  'Dance': [7, 6, 3, 0, 0, -3, -4, -4, 0, 0],
  'Bass Boost': [8, 7, 6, 4, 1, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 2, 4, 6, 7, 8],
  'Vocal': [-3, -2, 0, 3, 5, 5, 4, 2, 0, -2],
  'Full Bass & Treble': [6, 5, 1, -3, -3, 0, 4, 6, 7, 7]
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.8,
  balance: 0,
  shuffle: false,
  repeat: 'off',
  equalizer: {
    enabled: false,
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  playlist: [],
  currentIndex: -1,
  libraryFolders: []
}
