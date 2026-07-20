import { describe, expect, it, vi } from 'vitest'

// store.ts reads the settings path from Electron's app object at call time. The
// tests only exercise normalise(), but the import has to resolve.
vi.mock('electron', () => ({ app: { getPath: (): string => '/tmp' } }))

const { normalise } = await import('../src/main/store.js')
const { DEFAULT_SETTINGS } = await import('../src/shared/types.js')

describe('normalise', () => {
  it('keeps a well-formed settings object intact', () => {
    const settings = {
      volume: 0.5,
      balance: -0.25,
      shuffle: true,
      repeat: 'all' as const,
      equalizer: { enabled: true, preamp: 3, bands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      playlist: ['C:/a.mp3', 'C:/b.mp3'],
      currentIndex: 1,
      libraryFolders: ['C:/music']
    }
    expect(normalise(settings)).toEqual(settings)
  })

  it('falls back to defaults for anything that is not an object', () => {
    expect(normalise(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalise(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalise(42)).toEqual(DEFAULT_SETTINGS)
    expect(normalise('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(normalise([])).toEqual(DEFAULT_SETTINGS)
  })

  it('survives a playlist that is not an array', () => {
    // The renderer calls settings.playlist.length during startup; a string here
    // used to leave the player with an empty window and no way to recover
    // except deleting settings.json by hand.
    expect(normalise({ playlist: 'C:/a.mp3' }).playlist).toEqual([])
    expect(normalise({ playlist: 5 }).playlist).toEqual([])
    expect(normalise({ playlist: null }).playlist).toEqual([])
  })

  it('drops non-string entries from the playlist', () => {
    expect(normalise({ playlist: ['C:/a.mp3', 7, null, 'C:/b.mp3'] }).playlist).toEqual([
      'C:/a.mp3',
      'C:/b.mp3'
    ])
  })

  it('clamps volume and balance into their valid ranges', () => {
    expect(normalise({ volume: 5 }).volume).toBe(1)
    expect(normalise({ volume: -3 }).volume).toBe(0)
    expect(normalise({ balance: 9 }).balance).toBe(1)
    expect(normalise({ balance: -9 }).balance).toBe(-1)
  })

  it('rejects non-finite numbers', () => {
    expect(normalise({ volume: Number.NaN }).volume).toBe(DEFAULT_SETTINGS.volume)
    expect(normalise({ volume: Number.POSITIVE_INFINITY }).volume).toBe(DEFAULT_SETTINGS.volume)
    expect(normalise({ volume: '0.5' }).volume).toBe(DEFAULT_SETTINGS.volume)
  })

  it('accepts only the three known repeat modes', () => {
    expect(normalise({ repeat: 'one' }).repeat).toBe('one')
    expect(normalise({ repeat: 'all' }).repeat).toBe('all')
    expect(normalise({ repeat: 'off' }).repeat).toBe('off')
    expect(normalise({ repeat: 'sideways' }).repeat).toBe(DEFAULT_SETTINGS.repeat)
    expect(normalise({ repeat: 1 }).repeat).toBe(DEFAULT_SETTINGS.repeat)
  })

  it('always returns exactly ten equalizer bands', () => {
    expect(normalise({ equalizer: { bands: [1, 2, 3] } }).equalizer.bands).toEqual([
      1, 2, 3, 0, 0, 0, 0, 0, 0, 0
    ])
    expect(normalise({ equalizer: { bands: 'flat' } }).equalizer.bands).toEqual(
      DEFAULT_SETTINGS.equalizer.bands
    )
    // Extra bands are discarded: the engine only has ten filters.
    expect(normalise({ equalizer: { bands: new Array(20).fill(6) } }).equalizer.bands).toHaveLength(
      10
    )
  })

  it('clamps equalizer gains to the range the UI can display', () => {
    expect(normalise({ equalizer: { preamp: 99, bands: [99, -99] } }).equalizer).toMatchObject({
      preamp: 12,
      bands: [12, -12, 0, 0, 0, 0, 0, 0, 0, 0]
    })
  })

  it('survives an equalizer that is not an object', () => {
    expect(normalise({ equalizer: 'loud' }).equalizer).toEqual(DEFAULT_SETTINGS.equalizer)
    expect(normalise({ equalizer: null }).equalizer).toEqual(DEFAULT_SETTINGS.equalizer)
  })

  it('accepts only integer track indices', () => {
    expect(normalise({ currentIndex: 3 }).currentIndex).toBe(3)
    expect(normalise({ currentIndex: 1.5 }).currentIndex).toBe(-1)
    expect(normalise({ currentIndex: 'two' }).currentIndex).toBe(-1)
  })
})
