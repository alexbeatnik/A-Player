import { app } from 'electron'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.js'

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

/**
 * Reads settings from disk. Any problem (missing file, corrupt JSON) yields the
 * defaults — the player must always start.
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      equalizer: { ...DEFAULT_SETTINGS.equalizer, ...parsed.equalizer }
    }
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
