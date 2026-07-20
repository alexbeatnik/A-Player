import { app } from 'electron'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type RepeatMode, type Settings } from '../shared/types.js'

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

const REPEAT_MODES: RepeatMode[] = ['off', 'all', 'one']

function number(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Values from disk are validated field by field rather than merged wholesale: a
 * hand-edited or truncated file used to reach the renderer as-is and could break
 * it (`playlist.length` on a non-array), leaving the player unusable until the
 * file was deleted by hand.
 */
export function normalise(raw: unknown): Settings {
  const parsed = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Settings>
  const equalizer = (
    typeof parsed.equalizer === 'object' && parsed.equalizer !== null ? parsed.equalizer : {}
  ) as Partial<Settings['equalizer']>
  const bands = Array.isArray(equalizer.bands) ? equalizer.bands : []

  return {
    volume: number(parsed.volume, DEFAULT_SETTINGS.volume, 0, 1),
    balance: number(parsed.balance, DEFAULT_SETTINGS.balance, -1, 1),
    shuffle: boolean(parsed.shuffle, DEFAULT_SETTINGS.shuffle),
    repeat: REPEAT_MODES.includes(parsed.repeat as RepeatMode)
      ? (parsed.repeat as RepeatMode)
      : DEFAULT_SETTINGS.repeat,
    equalizer: {
      enabled: boolean(equalizer.enabled, DEFAULT_SETTINGS.equalizer.enabled),
      preamp: number(equalizer.preamp, DEFAULT_SETTINGS.equalizer.preamp, -12, 12),
      bands: DEFAULT_SETTINGS.equalizer.bands.map((fallback, index) =>
        number(bands[index], fallback, -12, 12)
      )
    },
    playlist: strings(parsed.playlist),
    currentIndex: Number.isInteger(parsed.currentIndex) ? (parsed.currentIndex as number) : -1,
    libraryFolders: strings(parsed.libraryFolders)
  }
}

/**
 * Reads settings from disk. Any problem (missing file, corrupt JSON) yields the
 * defaults — the player must always start.
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    return normalise(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Writes via a temporary file so a crash cannot leave truncated JSON behind. */
export async function saveSettings(settings: Settings): Promise<void> {
  const target = settingsPath()
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify(settings, null, 2), 'utf-8')
  await rename(tmp, target)
}
