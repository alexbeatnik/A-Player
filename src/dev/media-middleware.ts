import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Plugin } from 'vite'
import { fromMediaPath } from '../shared/protocol.js'
import { mimeFor, parseRange } from '../shared/media.js'

/**
 * In production local files are served by the app:// protocol, but in dev the
 * page lives on http://localhost. To keep the audio on the same origin (otherwise
 * Web Audio silences it over CORS), the dev server handles the same /media/ route.
 */
export function mediaMiddleware(): Plugin {
  return {
    name: 'aplayer-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url
        if (!rawUrl) return next()

        const pathname = rawUrl.split('?')[0]
        const filePath = fromMediaPath(pathname)
        if (filePath === null) return next()

        void (async () => {
          let size: number
          try {
            const info = await stat(filePath)
            if (!info.isFile()) {
              res.statusCode = 404
              return res.end('Not a file')
            }
            size = info.size
          } catch {
            res.statusCode = 404
            return res.end('Not found')
          }

          const contentType = mimeFor(filePath)
          const range = parseRange(req.headers.range, size)

          if (!range) {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': String(size),
              'Accept-Ranges': 'bytes'
            })
            return createReadStream(filePath).pipe(res)
          }

          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Length': String(range.end - range.start + 1),
            'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
            'Accept-Ranges': 'bytes'
          })
          return createReadStream(filePath, range).pipe(res)
        })()
      })
    }
  }
}
