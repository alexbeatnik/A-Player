import { readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { Track } from '../shared/types.js'

/**
 * Parses M3U/M3U8. Relative paths are resolved against the playlist itself,
 * because that is how most players write them.
 */
export async function parseM3u(playlistPath: string): Promise<string[]> {
  const raw = await readFile(playlistPath, 'utf-8')
  const base = dirname(playlistPath)

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => (isAbsolute(line) ? line : resolve(base, line)))
}

/** Writes extended M3U8 — with #EXTINF, so duration and title are preserved. */
export async function writeM3u(playlistPath: string, tracks: Track[]): Promise<void> {
  const lines = ['#EXTM3U']
  for (const track of tracks) {
    const label = track.artist ? `${track.artist} - ${track.title}` : track.title
    lines.push(`#EXTINF:${Math.round(track.duration)},${label}`)
    lines.push(track.path)
  }
  await writeFile(playlistPath, lines.join('\r\n') + '\r\n', 'utf-8')
}
