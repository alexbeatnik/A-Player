const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  mp4: 'audio/mp4',
  webm: 'audio/webm',
  weba: 'audio/webm',

  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  woff2: 'font/woff2'
}

export function mimeFor(filePath: string): string {
  const extension = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

export interface ByteRange {
  start: number
  end: number
}

/** Parses a `Range: bytes=start-end` header. Only a single range is supported. */
export function parseRange(header: string | null | undefined, size: number): ByteRange | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match

  // "bytes=-500" means the last 500 bytes, not a range starting at zero.
  if (rawStart === '') {
    if (rawEnd === '') return null
    const length = Number(rawEnd)
    if (length <= 0) return null
    return { start: Math.max(0, size - length), end: size - 1 }
  }

  const start = Number(rawStart)
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (start > end || start >= size) return null
  return { start, end }
}
