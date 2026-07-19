import { protocol } from 'electron'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { APP_SCHEME, fromMediaPath } from '../shared/protocol.js'
import { mimeFor, parseRange } from '../shared/media.js'

/**
 * The scheme must be registered before app.whenReady(). `stream: true` enables
 * Range request support — without it, seeking inside large files does not work.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

function streamOf(path: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const stream = range ? createReadStream(path, range) : createReadStream(path)
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>
}

/** Serves a file from disk, honouring the Range request. */
async function serveFile(filePath: string, rangeHeader: string | null): Promise<Response> {
  let size: number
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return new Response('Not a file', { status: 404 })
    size = info.size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const contentType = mimeFor(filePath)
  const range = parseRange(rangeHeader, size)

  if (!range) {
    return new Response(streamOf(filePath), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    })
  }

  return new Response(streamOf(filePath, range), {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  })
}

/**
 * A single origin for the whole app:
 *   app://local/             -> the built renderer
 *   app://local/media/<path> -> any audio file from disk
 *
 * The shared origin is not an implementation detail but a requirement: otherwise
 * Web Audio treats the audio as cross-origin and silences it.
 */
export function handleAppProtocol(rendererRoot: string): void {
  const root = resolve(rendererRoot)

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const rangeHeader = request.headers.get('range')

    const mediaPath = fromMediaPath(url.pathname)
    if (mediaPath !== null) {
      return serveFile(mediaPath, rangeHeader)
    }

    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const target = normalize(join(root, decodeURIComponent(relative)))

    // Guard against escaping the renderer directory via "..".
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    return serveFile(target, rangeHeader)
  })
}
