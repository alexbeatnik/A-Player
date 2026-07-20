import { describe, expect, it } from 'vitest'
import { MEDIA_PREFIX, fromMediaPath, toAudioUrl } from '@shared/protocol'

describe('toAudioUrl', () => {
  it('produces a path relative to the origin, never an absolute URL', () => {
    // An absolute app:// URL would be cross-origin in dev and Web Audio would
    // silence the track — see the comment on the function itself.
    expect(toAudioUrl('C:/music/track.mp3').startsWith(MEDIA_PREFIX)).toBe(true)
    expect(toAudioUrl('C:/music/track.mp3')).not.toContain('://')
  })

  it('encodes characters that would otherwise break the URL', () => {
    const url = toAudioUrl('C:/music/AC{DC/Back in Black #1.mp3')
    expect(url).not.toContain(' ')
    expect(url).not.toContain('#')
  })
})

describe('fromMediaPath', () => {
  it('ignores paths outside the media prefix', () => {
    expect(fromMediaPath('/index.html')).toBeNull()
    expect(fromMediaPath('/assets/index.js')).toBeNull()
    expect(fromMediaPath('/')).toBeNull()
  })

  it('ignores the bare prefix with nothing after it', () => {
    expect(fromMediaPath(MEDIA_PREFIX)).toBeNull()
  })

  it('returns null instead of throwing on a malformed escape', () => {
    // A stray % used to throw URIError out of the protocol handler and the dev
    // middleware, killing the request instead of answering it.
    expect(fromMediaPath(`${MEDIA_PREFIX}100%`)).toBeNull()
    expect(fromMediaPath(`${MEDIA_PREFIX}%E0%A4%A`)).toBeNull()
  })
})

describe('toAudioUrl / fromMediaPath round trip', () => {
  const paths = [
    'C:/music/track.mp3',
    'C:\\music\\track.mp3',
    'C:/music/Sigur Rós - Hoppípolla.flac',
    'C:/music/01. Artist - Song (Remix) [2024].mp3',
    'C:/музика/трек.mp3',
    'C:/music/100% Pure.mp3',
    'C:/music/a#b?c&d.mp3',
    '/home/user/music/track.ogg'
  ]

  it.each(paths)('survives the round trip: %s', (path) => {
    expect(fromMediaPath(toAudioUrl(path))).toBe(path)
  })
})
