import { describe, expect, it } from 'vitest'
import type { Track } from '@shared/types'
import { formatTime, formatTotalTime, trackLabel } from '@/utils/format'

describe('formatTime', () => {
  it('formats under an hour as MM:SS', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(9)).toBe('00:09')
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(599)).toBe('09:59')
    expect(formatTime(3599)).toBe('59:59')
  })

  it('adds the hour part only when it is needed', () => {
    expect(formatTime(3600)).toBe('1:00:00')
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(7325)).toBe('2:02:05')
  })

  it('truncates fractional seconds instead of rounding up', () => {
    // <audio> reports a float; rounding up would show 01:00 while the display
    // still reads 59 seconds elapsed.
    expect(formatTime(59.9)).toBe('00:59')
  })

  it('does not print garbage for the values <audio> reports before load', () => {
    expect(formatTime(Number.NaN)).toBe('00:00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('00:00')
    expect(formatTime(-5)).toBe('00:00')
  })
})

describe('formatTotalTime', () => {
  it('uses hours and minutes for long playlists', () => {
    expect(formatTotalTime(3600)).toBe('1 h 0 min')
    expect(formatTotalTime(7860)).toBe('2 h 11 min')
  })

  it('uses M:SS below an hour', () => {
    expect(formatTotalTime(65)).toBe('1:05')
    expect(formatTotalTime(599)).toBe('9:59')
  })

  it('keeps the leading zero minute for very short playlists', () => {
    expect(formatTotalTime(0)).toBe('0:00')
    expect(formatTotalTime(7)).toBe('0:07')
  })
})

function track(fields: Partial<Track>): Track {
  return {
    path: 'C:/music/track.mp3',
    title: 'Title',
    artist: '',
    album: '',
    duration: 0,
    trackNo: null,
    year: null,
    genre: '',
    bitrate: null,
    sampleRate: null,
    channels: null,
    codec: 'MP3',
    cover: null,
    ...fields
  }
}

describe('trackLabel', () => {
  it('joins artist and title when both are known', () => {
    expect(trackLabel(track({ artist: 'Portishead', title: 'Roads' }))).toBe('Portishead - Roads')
  })

  it('falls back to the title alone when the artist tag is empty', () => {
    expect(trackLabel(track({ artist: '', title: 'Roads' }))).toBe('Roads')
  })
})
