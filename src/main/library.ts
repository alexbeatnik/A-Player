import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { parseFile, type IAudioMetadata } from 'music-metadata'
import { SUPPORTED_EXTENSIONS, type Track } from '../shared/types.js'

const supported = new Set<string>(SUPPORTED_EXTENSIONS)

export function isSupportedAudio(filePath: string): boolean {
  return supported.has(extname(filePath).slice(1).toLowerCase())
}

/**
 * Recursively collects audio files from a folder. Directories that cannot be
 * read are skipped — one protected folder should not break the whole scan.
 */
export async function scanFolder(folder: string, maxDepth = 12): Promise<string[]> {
  const found: string[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else if (entry.isFile() && isSupportedAudio(full)) {
        found.push(full)
      }
    }
  }

  await walk(folder, 0)
  found.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  return found
}

function coverToDataUri(metadata: IAudioMetadata): string | null {
  const picture = metadata.common.picture?.[0]
  if (!picture) return null
  const base64 = Buffer.from(picture.data).toString('base64')
  return `data:${picture.format};base64,${base64}`
}

/** A track built from the file name alone — fallback when tags cannot be read. */
function bareTrack(filePath: string): Track {
  return {
    path: filePath,
    title: basename(filePath, extname(filePath)),
    artist: '',
    album: '',
    duration: 0,
    trackNo: null,
    year: null,
    genre: '',
    bitrate: null,
    sampleRate: null,
    channels: null,
    codec: extname(filePath).slice(1).toUpperCase(),
    cover: null
  }
}

export async function readTrack(filePath: string): Promise<Track> {
  try {
    const metadata = await parseFile(filePath, { duration: true })
    const { common, format } = metadata
    return {
      path: filePath,
      title: common.title?.trim() || basename(filePath, extname(filePath)),
      artist: common.artist?.trim() || common.albumartist?.trim() || '',
      album: common.album?.trim() || '',
      duration: format.duration ?? 0,
      trackNo: common.track?.no ?? null,
      year: common.year ?? null,
      genre: common.genre?.[0] ?? '',
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
      sampleRate: format.sampleRate ?? null,
      channels: format.numberOfChannels ?? null,
      codec: format.codec ?? extname(filePath).slice(1).toUpperCase(),
      cover: coverToDataUri(metadata)
    }
  } catch {
    return bareTrack(filePath)
  }
}

/**
 * Reads tags in batches — doing it sequentially would be far too slow on large
 * folders, while doing all at once exhausts the file descriptor limit.
 */
export async function readTracks(paths: string[], concurrency = 8): Promise<Track[]> {
  const results: Track[] = new Array(paths.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < paths.length) {
      const index = cursor++
      results[index] = await readTrack(paths[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker))
  return results
}

/** Checks the file still exists — playlists survive files being moved. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}
