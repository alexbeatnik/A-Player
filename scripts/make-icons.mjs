/**
 * Renders build/logo.svg to PNGs at several sizes and assembles build/icon.ico
 * from them.
 *
 * Electron does the rasterising — the same Chromium already in the dependency
 * tree — so no ImageMagick, no Inkscape and no native modules are needed.
 *
 * Run: npm run icons
 */
import { app, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SVG_PATH = join(root, 'build', 'logo.svg')

/** Sizes Windows expects inside an .ico. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
/** Standalone PNGs: for the README and for Linux builds. */
const PNG_SIZES = [144, 512]

/**
 * Rasterises through a canvas inside the page rather than via capturePage: a
 * window snapshot depends on visibility and monitor DPI, whereas the canvas
 * yields exactly the size requested and preserves transparency.
 */
async function renderPng(win, svg, size) {
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const base64 = await win.webContents.executeJavaScript(`
    (async () => {
      const img = new Image()
      img.src = ${JSON.stringify(dataUri)}
      await img.decode()

      const canvas = document.createElement('canvas')
      canvas.width = ${size}
      canvas.height = ${size}
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, ${size}, ${size})
      ctx.drawImage(img, 0, 0, ${size}, ${size})

      return canvas.toDataURL('image/png').split(',')[1]
    })()
  `)

  return Buffer.from(base64, 'base64')
}

/**
 * Assembles an .ico from the rendered PNGs. Modern Windows reads PNG inside ICO
 * directly, so re-encoding to BMP is unnecessary.
 */
function buildIco(pngs) {
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(count, 4)

  const directory = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count

  pngs.forEach(({ size, data }, index) => {
    const entry = 16 * index
    // 256 is stored as 0 — the field is a single byte.
    directory.writeUInt8(size === 256 ? 0 : size, entry + 0)
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1)
    directory.writeUInt8(0, entry + 2) // no palette
    directory.writeUInt8(0, entry + 3) // reserved
    directory.writeUInt16LE(1, entry + 4) // color planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...pngs.map((png) => png.data)])
}

app.whenReady().then(async () => {
  try {
    const svg = await readFile(SVG_PATH, 'utf-8')

    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
    await win.loadURL('data:text/html;charset=utf-8,<meta charset="utf-8">')

    const icoPngs = []
    for (const size of ICO_SIZES) {
      icoPngs.push({ size, data: await renderPng(win, svg, size) })
      console.log(`  ico ${size}x${size}`)
    }

    const icoPath = join(root, 'build', 'icon.ico')
    await writeFile(icoPath, buildIco(icoPngs))
    console.log(`✓ ${icoPath}`)

    for (const size of PNG_SIZES) {
      const data = await renderPng(win, svg, size)
      const name = size === 144 ? 'logo.png' : `icon-${size}.png`
      await writeFile(join(root, 'build', name), data)
      console.log(`✓ build/${name}`)
    }

    app.exit(0)
  } catch (error) {
    console.error('Failed to generate icons:', error)
    app.exit(1)
  }
})
