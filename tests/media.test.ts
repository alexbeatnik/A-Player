import { describe, expect, it } from 'vitest'
import { mimeFor, parseRange } from '@shared/media'

describe('mimeFor', () => {
  it('maps audio extensions to the type Chromium expects', () => {
    expect(mimeFor('C:/music/track.mp3')).toBe('audio/mpeg')
    expect(mimeFor('C:/music/track.flac')).toBe('audio/flac')
    // .opus is Ogg-contained, not its own MIME type.
    expect(mimeFor('C:/music/track.opus')).toBe('audio/ogg')
    expect(mimeFor('C:/music/track.m4a')).toBe('audio/mp4')
  })

  it('ignores the case of the extension', () => {
    expect(mimeFor('C:/music/TRACK.MP3')).toBe('audio/mpeg')
    expect(mimeFor('C:/music/Track.FlAc')).toBe('audio/flac')
  })

  it('serves the renderer assets too, since both go through one origin', () => {
    expect(mimeFor('index.html')).toBe('text/html; charset=utf-8')
    expect(mimeFor('assets/index.js')).toBe('text/javascript; charset=utf-8')
    expect(mimeFor('assets/index.css')).toBe('text/css; charset=utf-8')
  })

  it('falls back to octet-stream for anything unknown', () => {
    expect(mimeFor('track.xyz')).toBe('application/octet-stream')
    expect(mimeFor('no-extension')).toBe('application/octet-stream')
  })

  it('uses the last dot, so dots in the filename do not confuse it', () => {
    expect(mimeFor('C:/music/01. Artist - Song.mp3')).toBe('audio/mpeg')
  })
})

describe('parseRange', () => {
  const size = 1000

  it('returns null when there is no Range header at all', () => {
    expect(parseRange(null, size)).toBeNull()
    expect(parseRange(undefined, size)).toBeNull()
    expect(parseRange('', size)).toBeNull()
  })

  it('parses a closed range', () => {
    expect(parseRange('bytes=0-499', size)).toEqual({ start: 0, end: 499 })
    expect(parseRange('bytes=500-999', size)).toEqual({ start: 500, end: 999 })
  })

  it('treats an open end as "to the end of the file"', () => {
    expect(parseRange('bytes=500-', size)).toEqual({ start: 500, end: 999 })
  })

  it('reads a suffix range as the last N bytes', () => {
    // This is what a seek to the end of a large file looks like; reading it as
    // "from byte 0" would stream the whole track instead.
    expect(parseRange('bytes=-500', size)).toEqual({ start: 500, end: 999 })
  })

  it('clamps a suffix longer than the file to the whole file', () => {
    expect(parseRange('bytes=-5000', size)).toEqual({ start: 0, end: 999 })
  })

  it('clamps an end past the last byte', () => {
    expect(parseRange('bytes=0-5000', size)).toEqual({ start: 0, end: 999 })
  })

  it('rejects ranges that start outside the file', () => {
    expect(parseRange('bytes=1000-1500', size)).toBeNull()
    expect(parseRange('bytes=2000-', size)).toBeNull()
  })

  it('rejects an inverted range', () => {
    expect(parseRange('bytes=800-200', size)).toBeNull()
  })

  it('rejects a zero-length suffix', () => {
    expect(parseRange('bytes=-0', size)).toBeNull()
  })

  it('rejects malformed headers rather than guessing', () => {
    expect(parseRange('bytes=abc-def', size)).toBeNull()
    expect(parseRange('items=0-100', size)).toBeNull()
    expect(parseRange('bytes=-', size)).toBeNull()
    // Multiple ranges are legal HTTP but unsupported here — better to send the
    // whole file than the wrong slice.
    expect(parseRange('bytes=0-99,200-299', size)).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseRange('  bytes=0-99  ', size)).toEqual({ start: 0, end: 99 })
  })

  it('handles a single-byte file', () => {
    expect(parseRange('bytes=0-', 1)).toEqual({ start: 0, end: 0 })
  })
})
