// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings, Track } from '@shared/types'

// Hoisted so the vi.mock factory below can see them: vi.mock runs before the
// module-level consts of this file are initialised.
const audio = vi.hoisted(() => ({
  load: vi.fn(async () => {}),
  play: vi.fn(async () => {}),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  setBalance: vi.fn(),
  setEqualizerEnabled: vi.fn(),
  setEqualizerPreamp: vi.fn(),
  setEqualizerBands: vi.fn()
}))

// The real engine builds a Web Audio graph, which jsdom has no implementation
// for. The store's job is deciding *what* to play, so the engine is a spy.
vi.mock('@/audio/AudioEngine', () => ({
  AudioEngine: class {
    element = {} as HTMLAudioElement
    analyser = null
    load = audio.load
    play = audio.play
    pause = audio.pause
    stop = audio.stop
    seek = audio.seek
    setVolume = audio.setVolume
    setBalance = audio.setBalance
    setEqualizerEnabled = audio.setEqualizerEnabled
    setEqualizerPreamp = audio.setEqualizerPreamp
    setEqualizerBands = audio.setEqualizerBands
    destroy = vi.fn()
  }
}))

const { usePlayer } = await import('@/state/player')
const { DEFAULT_SETTINGS } = await import('@shared/types')

function makeTrack(name: string, duration = 100): Track {
  return {
    path: `C:/music/${name}.mp3`,
    title: name,
    artist: 'Artist',
    album: '',
    duration,
    trackNo: null,
    year: null,
    genre: '',
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    codec: 'MP3',
    cover: null
  }
}

const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c'), makeTrack('d')]

const saveSettings = vi.fn(async () => {})
const loadSettings = vi.fn(async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS }))
const readTracks = vi.fn(async (paths: string[]) => paths.map((p) => makeTrack(p)))

/** Puts the store into a known state without going through hydrate(). */
function seed(overrides: Partial<ReturnType<typeof usePlayer.getState>> = {}): void {
  usePlayer.setState({
    tracks,
    currentIndex: 0,
    selected: new Set<number>(),
    isPlaying: false,
    currentTime: 0,
    duration: 100,
    volume: DEFAULT_SETTINGS.volume,
    balance: 0,
    shuffle: false,
    repeat: 'off',
    equalizer: { ...DEFAULT_SETTINGS.equalizer },
    shuffleOrder: [],
    libraryFolders: [],
    // Left false so the debounced disk write stays out of the way; the tests
    // that care about persistence turn it on themselves.
    settingsLoaded: false,
    ...overrides
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.aplayer = {
    loadSettings,
    saveSettings,
    readTracks,
    audioUrl: (path: string) => `/media/${encodeURIComponent(path)}`
  } as unknown as typeof window.aplayer
  seed()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('playAt', () => {
  it('loads and plays the requested track', async () => {
    await usePlayer.getState().playAt(2)

    expect(usePlayer.getState().currentIndex).toBe(2)
    expect(usePlayer.getState().isPlaying).toBe(true)
    expect(audio.load).toHaveBeenCalledWith('/media/' + encodeURIComponent(tracks[2].path))
    expect(audio.play).toHaveBeenCalled()
  })

  it('adopts the duration from the tags so the seek bar is right before metadata loads', async () => {
    usePlayer.setState({ tracks: [makeTrack('a', 42), makeTrack('b', 84)] })
    await usePlayer.getState().playAt(1)
    expect(usePlayer.getState().duration).toBe(84)
  })

  it('ignores an index outside the playlist', async () => {
    await usePlayer.getState().playAt(99)
    await usePlayer.getState().playAt(-1)

    expect(usePlayer.getState().currentIndex).toBe(0)
    expect(audio.load).not.toHaveBeenCalled()
  })

  it('stays stopped when the file cannot be played', async () => {
    // A missing file or an unsupported codec rejects play(); the store must not
    // claim to be playing.
    audio.play.mockRejectedValueOnce(new Error('no decoder'))
    await usePlayer.getState().playAt(1)

    expect(usePlayer.getState().currentIndex).toBe(1)
    expect(usePlayer.getState().isPlaying).toBe(false)
  })
})

describe('next', () => {
  it('advances in playlist order', async () => {
    await usePlayer.getState().next()
    expect(usePlayer.getState().currentIndex).toBe(1)
  })

  it('stops at the end of the playlist when repeat is off and it advanced by itself', async () => {
    seed({ currentIndex: 3, isPlaying: true })
    await usePlayer.getState().next(true)

    expect(audio.stop).toHaveBeenCalled()
    expect(usePlayer.getState().isPlaying).toBe(false)
    expect(usePlayer.getState().currentTime).toBe(0)
    expect(usePlayer.getState().currentIndex).toBe(3)
  })

  it('wraps to the start when repeat is "all"', async () => {
    seed({ currentIndex: 3, repeat: 'all' })
    await usePlayer.getState().next(true)
    expect(usePlayer.getState().currentIndex).toBe(0)
  })

  it('wraps on a manual press even with repeat off', async () => {
    // Pressing "next" is an explicit request; only automatic advance should
    // respect the end of the playlist.
    seed({ currentIndex: 3 })
    await usePlayer.getState().next()

    expect(usePlayer.getState().currentIndex).toBe(0)
    expect(audio.stop).not.toHaveBeenCalled()
  })

  it('replays the same track on automatic advance when repeat is "one"', async () => {
    seed({ currentIndex: 2, currentTime: 99, repeat: 'one' })
    await usePlayer.getState().next(true)

    expect(usePlayer.getState().currentIndex).toBe(2)
    expect(usePlayer.getState().currentTime).toBe(0)
    expect(audio.seek).toHaveBeenCalledWith(0)
    expect(audio.load).not.toHaveBeenCalled()
  })

  it('really changes track on a manual press even when repeat is "one"', async () => {
    seed({ currentIndex: 2, repeat: 'one' })
    await usePlayer.getState().next()
    expect(usePlayer.getState().currentIndex).toBe(3)
  })

  it('does not reject when replaying a track that will not play', async () => {
    // next(true) is called straight from the <audio> "ended" handler, which
    // cannot await it — a rejection here surfaces as an unhandled rejection.
    seed({ currentIndex: 2, repeat: 'one' })
    audio.play.mockRejectedValueOnce(new Error('gone'))

    await expect(usePlayer.getState().next(true)).resolves.toBeUndefined()
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('does nothing on an empty playlist', async () => {
    seed({ tracks: [], currentIndex: -1 })
    await usePlayer.getState().next()
    expect(audio.load).not.toHaveBeenCalled()
  })
})

describe('previous', () => {
  it('goes back one track within the first three seconds', async () => {
    seed({ currentIndex: 2, currentTime: 1 })
    await usePlayer.getState().previous()
    expect(usePlayer.getState().currentIndex).toBe(1)
  })

  it('rewinds the current track instead once past three seconds', async () => {
    seed({ currentIndex: 2, currentTime: 30 })
    await usePlayer.getState().previous()

    expect(usePlayer.getState().currentIndex).toBe(2)
    expect(usePlayer.getState().currentTime).toBe(0)
    expect(audio.seek).toHaveBeenCalledWith(0)
    expect(audio.load).not.toHaveBeenCalled()
  })

  it('wraps to the last track from the first', async () => {
    seed({ currentIndex: 0, currentTime: 0 })
    await usePlayer.getState().previous()
    expect(usePlayer.getState().currentIndex).toBe(3)
  })
})

describe('shuffle', () => {
  it('builds an order covering every track exactly once', () => {
    usePlayer.getState().toggleShuffle()
    const { shuffleOrder } = usePlayer.getState()

    expect(shuffleOrder).toHaveLength(tracks.length)
    expect([...shuffleOrder].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
  })

  it('keeps the playing track first so enabling shuffle does not interrupt it', () => {
    for (const index of [0, 1, 2, 3]) {
      seed({ currentIndex: index })
      usePlayer.getState().toggleShuffle()
      expect(usePlayer.getState().shuffleOrder[0]).toBe(index)
    }
  })

  it('follows the shuffled order rather than the playlist order', async () => {
    seed({ shuffle: true, shuffleOrder: [0, 3, 1, 2], currentIndex: 0 })

    await usePlayer.getState().next()
    expect(usePlayer.getState().currentIndex).toBe(3)

    await usePlayer.getState().next()
    expect(usePlayer.getState().currentIndex).toBe(1)
  })

  it('steps back through the shuffled order too', async () => {
    seed({ shuffle: true, shuffleOrder: [0, 3, 1, 2], currentIndex: 1, currentTime: 0 })
    await usePlayer.getState().previous()
    expect(usePlayer.getState().currentIndex).toBe(3)
  })

  it('stops at the end of the shuffled order when repeat is off', async () => {
    seed({ shuffle: true, shuffleOrder: [0, 3, 1, 2], currentIndex: 2, isPlaying: true })
    await usePlayer.getState().next(true)

    expect(audio.stop).toHaveBeenCalled()
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('drops the order when shuffle is turned back off', () => {
    usePlayer.getState().toggleShuffle()
    usePlayer.getState().toggleShuffle()

    expect(usePlayer.getState().shuffle).toBe(false)
    expect(usePlayer.getState().shuffleOrder).toEqual([])
  })
})

describe('addTracks', () => {
  it('appends and skips paths already in the playlist', () => {
    seed({ tracks: [tracks[0], tracks[1]] })
    usePlayer.getState().addTracks([tracks[1], tracks[2]])

    expect(usePlayer.getState().tracks.map((t) => t.title)).toEqual(['a', 'b', 'c'])
  })

  it('replaces the playlist and starts playing when asked to', async () => {
    usePlayer.getState().addTracks([makeTrack('x'), makeTrack('y')], true)
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalled())

    expect(usePlayer.getState().tracks.map((t) => t.title)).toEqual(['x', 'y'])
    expect(usePlayer.getState().currentIndex).toBe(0)
  })

  it('ignores an empty batch', () => {
    usePlayer.getState().addTracks([])
    expect(usePlayer.getState().tracks).toHaveLength(4)
  })

  it('rebuilds the shuffle order to cover the new tracks', () => {
    seed({ shuffle: true, shuffleOrder: [0, 1, 2, 3] })
    usePlayer.getState().addTracks([makeTrack('e')])

    expect(usePlayer.getState().shuffleOrder).toHaveLength(5)
    expect([...usePlayer.getState().shuffleOrder].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('removeSelected', () => {
  it('keeps playing the same track after earlier ones are removed', () => {
    seed({ currentIndex: 2, isPlaying: true, selected: new Set([0]) })
    usePlayer.getState().removeSelected()

    // "c" was at index 2, is now at index 1 — the index has to follow the track.
    expect(usePlayer.getState().tracks[1].title).toBe('c')
    expect(usePlayer.getState().currentIndex).toBe(1)
    expect(usePlayer.getState().isPlaying).toBe(true)
    expect(audio.stop).not.toHaveBeenCalled()
  })

  it('stops rather than jumping to a neighbour when the playing track is removed', () => {
    seed({ currentIndex: 1, isPlaying: true, currentTime: 30, selected: new Set([1]) })
    usePlayer.getState().removeSelected()

    expect(usePlayer.getState().currentIndex).toBe(-1)
    expect(usePlayer.getState().isPlaying).toBe(false)
    expect(usePlayer.getState().currentTime).toBe(0)
    expect(usePlayer.getState().duration).toBe(0)
    expect(audio.stop).toHaveBeenCalled()
  })

  it('clears the selection afterwards', () => {
    seed({ selected: new Set([0, 1]) })
    usePlayer.getState().removeSelected()
    expect(usePlayer.getState().selected.size).toBe(0)
  })

  it('does nothing when nothing is selected', () => {
    usePlayer.getState().removeSelected()
    expect(usePlayer.getState().tracks).toHaveLength(4)
  })
})

describe('clearPlaylist', () => {
  it('resets everything and stops the engine', () => {
    seed({ currentIndex: 2, isPlaying: true, currentTime: 30 })
    usePlayer.getState().clearPlaylist()

    expect(usePlayer.getState()).toMatchObject({
      tracks: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      shuffleOrder: []
    })
    expect(audio.stop).toHaveBeenCalled()
  })
})

describe('togglePlay', () => {
  it('starts the first track when nothing is cued', async () => {
    seed({ currentIndex: -1 })
    await usePlayer.getState().togglePlay()

    expect(usePlayer.getState().currentIndex).toBe(0)
    expect(usePlayer.getState().isPlaying).toBe(true)
  })

  it('pauses without reloading the track', async () => {
    seed({ isPlaying: true })
    await usePlayer.getState().togglePlay()

    expect(audio.pause).toHaveBeenCalled()
    expect(audio.load).not.toHaveBeenCalled()
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('does nothing at all with an empty playlist', async () => {
    seed({ tracks: [], currentIndex: -1 })
    await usePlayer.getState().togglePlay()

    expect(usePlayer.getState().isPlaying).toBe(false)
    expect(audio.play).not.toHaveBeenCalled()
  })
})

describe('equalizer and mixer', () => {
  it('forwards a single band change to the engine with the whole band array', () => {
    usePlayer.getState().setEqBand(3, 6)

    expect(usePlayer.getState().equalizer.bands[3]).toBe(6)
    expect(audio.setEqualizerBands).toHaveBeenCalledWith([0, 0, 0, 6, 0, 0, 0, 0, 0, 0])
  })

  it('copies preset arrays instead of storing the shared constant', () => {
    const preset = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    usePlayer.getState().setEqBands(preset)
    usePlayer.getState().setEqBand(0, -5)

    // Mutating the store must not reach back into EQ_PRESETS.
    expect(preset[0]).toBe(1)
  })

  it('cycles the repeat mode off -> all -> one -> off', () => {
    expect(usePlayer.getState().repeat).toBe('off')
    usePlayer.getState().cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('all')
    usePlayer.getState().cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('one')
    usePlayer.getState().cycleRepeat()
    expect(usePlayer.getState().repeat).toBe('off')
  })
})

describe('hydrate', () => {
  it('restores the saved session without starting playback', async () => {
    loadSettings.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      volume: 0.42,
      balance: -0.5,
      playlist: ['one', 'two', 'three'],
      currentIndex: 2
    })

    await usePlayer.getState().hydrate()

    expect(usePlayer.getState().currentIndex).toBe(2)
    expect(usePlayer.getState().volume).toBe(0.42)
    expect(audio.setVolume).toHaveBeenCalledWith(0.42)
    expect(audio.setBalance).toHaveBeenCalledWith(-0.5)
    // The track is cued up but silent: restoring a session must not make noise.
    expect(audio.load).toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('falls back to the first track when the saved index is out of range', async () => {
    loadSettings.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      playlist: ['one', 'two'],
      currentIndex: 47
    })

    await usePlayer.getState().hydrate()
    expect(usePlayer.getState().currentIndex).toBe(0)
  })

  it('ends with no current track when the saved playlist is empty', async () => {
    await usePlayer.getState().hydrate()

    expect(usePlayer.getState().currentIndex).toBe(-1)
    expect(usePlayer.getState().tracks).toEqual([])
    expect(audio.load).not.toHaveBeenCalled()
  })

  it('applies volume and EQ before the slow track scan', async () => {
    // The scan can take seconds on a large playlist; the first note must not
    // play at the wrong volume while it runs.
    const order: string[] = []
    audio.setVolume.mockImplementationOnce(() => void order.push('volume'))
    readTracks.mockImplementationOnce(async (paths: string[]) => {
      order.push('readTracks')
      return paths.map((p) => makeTrack(p))
    })
    loadSettings.mockResolvedValueOnce({ ...DEFAULT_SETTINGS, playlist: ['one'] })

    await usePlayer.getState().hydrate()
    expect(order).toEqual(['volume', 'readTracks'])
  })

  it('keeps library folders so that saving does not wipe them', async () => {
    vi.useFakeTimers()
    loadSettings.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      libraryFolders: ['C:/music', 'D:/archive']
    })

    await usePlayer.getState().hydrate()
    usePlayer.getState().setVolume(0.3)
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ libraryFolders: ['C:/music', 'D:/archive'] })
    )
  })
})

describe('persistence', () => {
  it('collapses a burst of slider moves into one disk write', async () => {
    vi.useFakeTimers()
    usePlayer.setState({ settingsLoaded: true })

    for (let i = 0; i <= 10; i++) usePlayer.getState().setVolume(i / 10)
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ volume: 1 }))
  })

  it('writes nothing before the settings have been loaded', async () => {
    vi.useFakeTimers()
    usePlayer.getState().setVolume(0.5)
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('stores the playlist as plain paths', async () => {
    vi.useFakeTimers()
    usePlayer.setState({ settingsLoaded: true })

    usePlayer.getState().setVolume(0.5)
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ playlist: tracks.map((t) => t.path) })
    )
  })
})
