import { create } from 'zustand'
import { AudioEngine } from '@/audio/AudioEngine'
import {
  DEFAULT_SETTINGS,
  type EqualizerState,
  type RepeatMode,
  type Settings,
  type Track
} from '@shared/types'

export const engine = new AudioEngine()

/** Shuffles a copy of the index array (Fisher–Yates). */
function shuffled(length: number, keepFirst: number | null): number[] {
  const order = Array.from({ length }, (_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // The current track must stay first, otherwise enabling shuffle interrupts it.
  if (keepFirst !== null) {
    const position = order.indexOf(keepFirst)
    if (position > 0) {
      ;[order[0], order[position]] = [order[position], order[0]]
    }
  }
  return order
}

interface PlayerState {
  tracks: Track[]
  currentIndex: number
  selected: Set<number>

  isPlaying: boolean
  currentTime: number
  duration: number

  volume: number
  balance: number
  shuffle: boolean
  repeat: RepeatMode
  equalizer: EqualizerState

  /** Playback order in shuffle mode; empty when shuffle is off. */
  shuffleOrder: number[]
  settingsLoaded: boolean
  /** Kept only so that saving settings does not wipe what was loaded. */
  libraryFolders: string[]

  hydrate: () => Promise<void>
  addTracks: (tracks: Track[], replace?: boolean) => void
  removeSelected: () => void
  clearPlaylist: () => void
  setSelection: (indices: number[]) => void

  playAt: (index: number) => Promise<void>
  togglePlay: () => Promise<void>
  stop: () => void
  next: (auto?: boolean) => Promise<void>
  previous: () => Promise<void>
  seek: (seconds: number) => void

  setVolume: (value: number) => void
  setBalance: (value: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void

  setEqEnabled: (enabled: boolean) => void
  setEqPreamp: (value: number) => void
  setEqBand: (index: number, value: number) => void
  setEqBands: (bands: number[]) => void

  /** Internal: synchronisation with <audio> events. */
  syncTime: (time: number, duration: number) => void
  setPlaying: (playing: boolean) => void
}

/**
 * Writing to disk is debounced — otherwise dragging the volume slider would
 * rewrite the file dozens of times per second.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null

function persist(state: PlayerState): void {
  if (!state.settingsLoaded) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const settings: Settings = {
      volume: state.volume,
      balance: state.balance,
      shuffle: state.shuffle,
      repeat: state.repeat,
      equalizer: state.equalizer,
      playlist: state.tracks.map((track) => track.path),
      currentIndex: state.currentIndex,
      libraryFolders: state.libraryFolders
    }
    void window.aplayer.saveSettings(settings)
  }, 400)
}

export const usePlayer = create<PlayerState>((set, get) => ({
  tracks: [],
  currentIndex: -1,
  selected: new Set<number>(),

  isPlaying: false,
  currentTime: 0,
  duration: 0,

  volume: DEFAULT_SETTINGS.volume,
  balance: DEFAULT_SETTINGS.balance,
  shuffle: DEFAULT_SETTINGS.shuffle,
  repeat: DEFAULT_SETTINGS.repeat,
  equalizer: DEFAULT_SETTINGS.equalizer,

  shuffleOrder: [],
  settingsLoaded: false,
  libraryFolders: [],

  hydrate: async () => {
    const settings = await window.aplayer.loadSettings()

    engine.setVolume(settings.volume)
    engine.setBalance(settings.balance)
    engine.setEqualizerEnabled(settings.equalizer.enabled)
    engine.setEqualizerPreamp(settings.equalizer.preamp)
    engine.setEqualizerBands(settings.equalizer.bands)

    // Tracks are read after the settings are applied: the scan can be slow, but
    // volume and EQ must already be correct on the very first note.
    const tracks =
      settings.playlist.length > 0 ? await window.aplayer.readTracks(settings.playlist) : []

    const currentIndex =
      settings.currentIndex >= 0 && settings.currentIndex < tracks.length
        ? settings.currentIndex
        : tracks.length > 0
          ? 0
          : -1

    set({
      tracks,
      currentIndex,
      volume: settings.volume,
      balance: settings.balance,
      shuffle: settings.shuffle,
      repeat: settings.repeat,
      equalizer: settings.equalizer,
      shuffleOrder: settings.shuffle ? shuffled(tracks.length, currentIndex) : [],
      duration: currentIndex >= 0 ? tracks[currentIndex].duration : 0,
      libraryFolders: settings.libraryFolders,
      settingsLoaded: true
    })

    // The track is only cued up, not started: restoring a session should never
    // start making noise on its own.
    if (currentIndex >= 0) {
      void engine.load(window.aplayer.audioUrl(tracks[currentIndex].path))
    }
  },

  addTracks: (incoming, replace = false) => {
    const state = get()
    if (incoming.length === 0) return

    const existing = replace ? [] : state.tracks
    const known = new Set(existing.map((track) => track.path))
    const fresh = incoming.filter((track) => !known.has(track.path))
    const tracks = [...existing, ...fresh]

    const currentIndex = replace ? (tracks.length > 0 ? 0 : -1) : state.currentIndex

    set({
      tracks,
      currentIndex,
      selected: new Set<number>(),
      shuffleOrder: state.shuffle ? shuffled(tracks.length, currentIndex) : []
    })
    persist(get())

    if (replace && tracks.length > 0) {
      void get().playAt(0)
    }
  },

  removeSelected: () => {
    const state = get()
    if (state.selected.size === 0) return

    const currentPath = state.currentIndex >= 0 ? state.tracks[state.currentIndex].path : null
    const tracks = state.tracks.filter((_, index) => !state.selected.has(index))
    const currentIndex = currentPath
      ? tracks.findIndex((track) => track.path === currentPath)
      : -1

    // If the currently playing track was removed, stop rather than jumping to a neighbour.
    if (currentIndex === -1 && currentPath !== null) {
      engine.stop()
    }

    set({
      tracks,
      currentIndex,
      selected: new Set<number>(),
      isPlaying: currentIndex === -1 ? false : state.isPlaying,
      currentTime: currentIndex === -1 ? 0 : state.currentTime,
      duration: currentIndex === -1 ? 0 : state.duration,
      shuffleOrder: state.shuffle
        ? shuffled(tracks.length, currentIndex >= 0 ? currentIndex : null)
        : []
    })
    persist(get())
  },

  clearPlaylist: () => {
    engine.stop()
    set({
      tracks: [],
      currentIndex: -1,
      selected: new Set<number>(),
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      shuffleOrder: []
    })
    persist(get())
  },

  setSelection: (indices) => set({ selected: new Set(indices) }),

  playAt: async (index) => {
    const state = get()
    if (index < 0 || index >= state.tracks.length) return

    set({ currentIndex: index, currentTime: 0, duration: state.tracks[index].duration })
    await engine.load(window.aplayer.audioUrl(state.tracks[index].path))
    try {
      await engine.play()
      set({ isPlaying: true })
    } catch {
      // The file may have disappeared or use an unsupported codec — just do not play.
      set({ isPlaying: false })
    }
    persist(get())
  },

  togglePlay: async () => {
    const state = get()
    if (state.currentIndex === -1) {
      if (state.tracks.length > 0) await get().playAt(0)
      return
    }
    if (state.isPlaying) {
      engine.pause()
      set({ isPlaying: false })
    } else {
      try {
        await engine.play()
        set({ isPlaying: true })
      } catch {
        set({ isPlaying: false })
      }
    }
  },

  stop: () => {
    engine.stop()
    set({ isPlaying: false, currentTime: 0 })
  },

  next: async (auto = false) => {
    const state = get()
    if (state.tracks.length === 0) return

    // Repeat-one only applies to automatic advance; pressing "next" by hand
    // should genuinely change track.
    if (auto && state.repeat === 'one') {
      engine.seek(0)
      set({ currentTime: 0 })
      try {
        await engine.play()
      } catch {
        set({ isPlaying: false })
      }
      return
    }

    const order = state.shuffle ? state.shuffleOrder : state.tracks.map((_, i) => i)
    const position = order.indexOf(state.currentIndex)
    const isLast = position === order.length - 1

    if (isLast && auto && state.repeat === 'off') {
      engine.stop()
      set({ isPlaying: false, currentTime: 0 })
      return
    }

    const nextPosition = (position + 1) % order.length
    await get().playAt(order[nextPosition])
  },

  previous: async () => {
    const state = get()
    if (state.tracks.length === 0) return

    // As in most players: after 3 seconds, "previous" rewinds to the start of the track.
    if (state.currentTime > 3) {
      engine.seek(0)
      set({ currentTime: 0 })
      return
    }

    const order = state.shuffle ? state.shuffleOrder : state.tracks.map((_, i) => i)
    const position = order.indexOf(state.currentIndex)
    const previousPosition = (position - 1 + order.length) % order.length
    await get().playAt(order[previousPosition])
  },

  seek: (seconds) => {
    engine.seek(seconds)
    set({ currentTime: seconds })
  },

  setVolume: (value) => {
    engine.setVolume(value)
    set({ volume: value })
    persist(get())
  },

  setBalance: (value) => {
    engine.setBalance(value)
    set({ balance: value })
    persist(get())
  },

  toggleShuffle: () => {
    const state = get()
    const shuffle = !state.shuffle
    set({
      shuffle,
      shuffleOrder: shuffle ? shuffled(state.tracks.length, state.currentIndex) : []
    })
    persist(get())
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const current = get().repeat
    const repeat = order[(order.indexOf(current) + 1) % order.length]
    set({ repeat })
    persist(get())
  },

  setEqEnabled: (enabled) => {
    engine.setEqualizerEnabled(enabled)
    set((state) => ({ equalizer: { ...state.equalizer, enabled } }))
    persist(get())
  },

  setEqPreamp: (value) => {
    engine.setEqualizerPreamp(value)
    set((state) => ({ equalizer: { ...state.equalizer, preamp: value } }))
    persist(get())
  },

  setEqBand: (index, value) => {
    const bands = [...get().equalizer.bands]
    bands[index] = value
    engine.setEqualizerBands(bands)
    set((state) => ({ equalizer: { ...state.equalizer, bands } }))
    persist(get())
  },

  setEqBands: (bands) => {
    engine.setEqualizerBands(bands)
    set((state) => ({ equalizer: { ...state.equalizer, bands: [...bands] } }))
    persist(get())
  },

  syncTime: (currentTime, duration) => set({ currentTime, duration }),
  setPlaying: (isPlaying) => set({ isPlaying })
}))
