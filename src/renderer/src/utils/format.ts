import type { Track } from '@shared/types'

/** Seconds -> "MM:SS" (or "H:MM:SS" for long recordings). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'

  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Total playlist duration in a human-readable form. */
export function formatTotalTime(seconds: number): string {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours} h ${minutes} min`
  if (minutes > 0) return `${minutes}:${String(secs).padStart(2, '0')}`
  return `0:${String(secs).padStart(2, '0')}`
}

/** "Artist - Title", or just the title when the artist tag is empty. */
export function trackLabel(track: Track): string {
  return track.artist ? `${track.artist} - ${track.title}` : track.title
}
