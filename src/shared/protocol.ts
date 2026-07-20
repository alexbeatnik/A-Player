export const APP_SCHEME = 'app'
export const APP_HOST = 'local'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/** Prefix under which both the dev server and the production protocol serve local files. */
export const MEDIA_PREFIX = '/media/'

/**
 * Deliberately returns a path relative to the page origin rather than an absolute URL.
 *
 * Chromium does not support CORS for custom schemes at all, and
 * MediaElementAudioSource outputs silence when its source is cross-origin. So the
 * audio has to live on the same origin as the page itself: http://localhost in dev,
 * app://local in production. A relative path resolves correctly in both cases.
 */
export function toAudioUrl(filePath: string): string {
  return `${MEDIA_PREFIX}${encodeURIComponent(filePath)}`
}

/** Inverse mapping: request path -> path on disk, or null. */
export function fromMediaPath(pathname: string): string | null {
  if (!pathname.startsWith(MEDIA_PREFIX)) return null
  const encoded = pathname.slice(MEDIA_PREFIX.length)
  if (encoded.length === 0) return null
  try {
    return decodeURIComponent(encoded)
  } catch {
    // A malformed escape sequence must not take down the request handler.
    return null
  }
}
