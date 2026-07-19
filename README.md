<img src="build/logo.png" width="96" align="left" alt="A-Player" />

# A-Player

A compact desktop audio player with a classic skinned look. Works entirely
offline — no network requests, no telemetry, no online services.

<br clear="left" />

## Download

Prebuilt binaries are on the [Releases](https://github.com/alexbeatnik/A-Player/releases) page:

- `A-Player-*-portable.exe` — a single file, no installation
- `A-Player-*-setup.exe` — installer with shortcuts and file associations

## Formats

mp3, wav, flac, ogg, oga, opus, m4a, m4b, aac, mp4, webm

Decoding is handled by the Chromium build embedded in Electron, so no external
codecs or ffmpeg are required.

## Features

- Play, pause, stop, seek, previous / next track
- Playlist with Ctrl / Shift selection, M3U8 save and load
- Recursive folder adding
- ID3 / Vorbis / MP4 tag reading: artist, title, album, year, cover art
- 10-band equalizer with preamp and ten presets
- Visualisation: spectrum analyser and oscilloscope (click to switch)
- Volume and balance controls
- Shuffle and three repeat modes
- Drag and drop of files and folders onto the window
- State (playlist, volume, EQ) is restored after a restart

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Space | Play / pause |
| ← / → | Seek 5 seconds |
| Ctrl + ← / → | Previous / next track |
| ↑ / ↓ | Volume |
| Delete | Remove selection from the playlist |
| Ctrl + O | Open files |

Double-click a track to play it. Right-click reveals the file in Explorer.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # build into out/
npm run icons      # regenerate build/icon.ico from build/logo.svg
npm run dist       # installer and portable exe into release/
```

## Release

Building and publishing is handled by [.github/workflows/release.yml](.github/workflows/release.yml)
on `windows-latest`. Pushing a tag is enough:

```bash
npm version patch      # or minor / major — updates package.json and creates the tag
git push --follow-tags
```

The workflow builds `A-Player-<version>-setup.exe` and
`A-Player-<version>-portable.exe` and publishes them to a GitHub Release. No extra
secrets are needed — publishing goes through the built-in `GITHUB_TOKEN`.

The builds are not code-signed, so Windows SmartScreen will warn on first launch.
That is expected for a project without a code signing certificate.

## Architecture

```
src/
  main/       Electron main: window, IPC, folder scanning, tag reading
  preload/    contextBridge — the only bridge between main and renderer
  renderer/   React UI plus the Web Audio engine
  shared/     types and constants shared by both processes
```

The page and the audio are served from a **single origin** — `app://local` in
production, `http://localhost` in dev. This is not a stylistic choice but a
requirement: Chromium does not support CORS for custom schemes at all, and
`MediaElementAudioSource` outputs silence when its source is cross-origin. So in
dev the same `/media/` route is served by Vite middleware
([src/dev/media-middleware.ts](src/dev/media-middleware.ts)), and in production by
the protocol handler ([src/main/protocol.ts](src/main/protocol.ts)).

Both honour `Range` requests, so seeking works even in large FLAC files without
loading the whole file into memory.

## License

Apache-2.0
