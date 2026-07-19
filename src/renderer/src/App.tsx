import { useCallback, useEffect, useRef, useState, type DragEvent, type JSX } from 'react'
import { engine, usePlayer } from '@/state/player'
import { TitleBar } from '@/components/TitleBar'
import { Display } from '@/components/Display'
import { Visualizer, type VisualizerMode } from '@/components/Visualizer'
import { Transport } from '@/components/Transport'
import { Slider } from '@/components/Slider'
import { Playlist } from '@/components/Playlist'
import { Equalizer } from '@/components/Equalizer'
import { formatTime, trackLabel } from '@/utils/format'

const VISUALIZER_MODES: VisualizerMode[] = ['spectrum', 'oscilloscope', 'off']

export default function App(): JSX.Element {
  const state = usePlayer()
  const [visualizer, setVisualizer] = useState<VisualizerMode>('spectrum')
  const [showRemaining, setShowRemaining] = useState(false)
  const [showEq, setShowEq] = useState(false)
  const [dragging, setDragging] = useState(false)
  // While the position slider is being dragged we stop syncing it from <audio>,
  // otherwise the handle jumps back between frames.
  const seekingRef = useRef(false)

  const { hydrate, syncTime, setPlaying, next } = state

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // <audio> events are the single source of truth for time and readiness.
  useEffect(() => {
    const audio = engine.element

    const onTimeUpdate = (): void => {
      if (!seekingRef.current) {
        syncTime(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0)
      }
    }
    const onLoadedMetadata = (): void => {
      syncTime(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const onEnded = (): void => void next(true)
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [syncTime, setPlaying, next])

  const addFiles = useCallback(async (): Promise<void> => {
    const tracks = await window.aplayer.openFiles()
    usePlayer.getState().addTracks(tracks)
  }, [])

  const addFolder = useCallback(async (): Promise<void> => {
    const tracks = await window.aplayer.openFolder()
    usePlayer.getState().addTracks(tracks)
  }, [])

  // Files opened through file associations or a second instance of the app.
  useEffect(() => {
    return window.aplayer.onOpenPaths((paths) => {
      void window.aplayer.addPaths(paths).then((tracks) => {
        usePlayer.getState().addTracks(tracks, true)
      })
    })
  }, [])

  // Shortcuts are window-global but must not swallow input in form fields.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

      const player = usePlayer.getState()

      switch (event.key) {
        case ' ':
          event.preventDefault()
          void player.togglePlay()
          break
        case 'ArrowRight':
          if (event.ctrlKey) {
            event.preventDefault()
            void player.next()
          } else {
            event.preventDefault()
            player.seek(Math.min(player.currentTime + 5, player.duration))
          }
          break
        case 'ArrowLeft':
          if (event.ctrlKey) {
            event.preventDefault()
            void player.previous()
          } else {
            event.preventDefault()
            player.seek(Math.max(player.currentTime - 5, 0))
          }
          break
        case 'ArrowUp':
          event.preventDefault()
          player.setVolume(Math.min(1, player.volume + 0.05))
          break
        case 'ArrowDown':
          event.preventDefault()
          player.setVolume(Math.max(0, player.volume - 0.05))
          break
        case 'Delete':
          player.removeSelected()
          break
        case 'o':
        case 'O':
          if (event.ctrlKey) {
            event.preventDefault()
            void addFiles()
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addFiles])

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)

    const paths = Array.from(event.dataTransfer.files).map((file) =>
      window.aplayer.pathForFile(file)
    )
    if (paths.length === 0) return

    void window.aplayer.addPaths(paths).then((tracks) => {
      usePlayer.getState().addTracks(tracks)
    })
  }

  const currentTrack = state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
  const windowTitle = currentTrack ? trackLabel(currentTrack) : 'stopped'

  return (
    <div
      className={`app ${dragging ? 'app--dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        // relatedTarget === null means the cursor left the window entirely.
        if (event.relatedTarget === null) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <TitleBar title={windowTitle} />

      <main className="player">
        <div className="player__top">
          <Display
            track={currentTrack}
            currentTime={state.currentTime}
            duration={state.duration}
            isPlaying={state.isPlaying}
            remaining={showRemaining}
            onToggleRemaining={() => setShowRemaining((value) => !value)}
          />
          {currentTrack?.cover ? (
            <img className="player__cover" src={currentTrack.cover} alt="" />
          ) : (
            <div className="player__cover player__cover--empty">♪</div>
          )}
        </div>

        <Visualizer
          mode={visualizer}
          onCycleMode={() =>
            setVisualizer(
              (mode) => VISUALIZER_MODES[(VISUALIZER_MODES.indexOf(mode) + 1) % VISUALIZER_MODES.length]
            )
          }
        />

        <div className="seek">
          <Slider
            className="seek__slider"
            min={0}
            max={state.duration > 0 ? state.duration : 1}
            step={0.1}
            value={Math.min(state.currentTime, state.duration || 1)}
            ariaLabel="Playback position"
            title={`${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
            onChange={(value) => {
              seekingRef.current = true
              state.seek(value)
              // Hand control back to the <audio> events once the browser has
              // applied the new position.
              window.setTimeout(() => {
                seekingRef.current = false
              }, 150)
            }}
          />
        </div>

        <Transport
          isPlaying={state.isPlaying}
          shuffle={state.shuffle}
          repeat={state.repeat}
          onPrevious={() => void state.previous()}
          onPlayPause={() => void state.togglePlay()}
          onStop={state.stop}
          onNext={() => void state.next()}
          onOpenFiles={() => void addFiles()}
          onToggleShuffle={state.toggleShuffle}
          onCycleRepeat={state.cycleRepeat}
        />

        <div className="mixer">
          <label className="mixer__control">
            <span className="mixer__label">Volume</span>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={state.volume}
              onChange={state.setVolume}
              ariaLabel="Volume"
              title={`Volume: ${Math.round(state.volume * 100)}%`}
            />
          </label>

          <label className="mixer__control mixer__control--balance">
            <span className="mixer__label">Balance</span>
            <Slider
              min={-1}
              max={1}
              step={0.02}
              value={state.balance}
              onChange={state.setBalance}
              ariaLabel="Balance"
              title={
                state.balance === 0
                  ? 'Balance: centre'
                  : `Balance: ${state.balance < 0 ? 'L' : 'R'} ${Math.round(Math.abs(state.balance) * 100)}%`
              }
            />
          </label>

          <button
            type="button"
            className={`btn btn--toggle ${showEq ? 'is-active' : ''}`}
            onClick={() => setShowEq((value) => !value)}
            title="Show / hide equalizer"
          >
            EQ
          </button>
        </div>

        {showEq && (
          <Equalizer
            equalizer={state.equalizer}
            onToggle={state.setEqEnabled}
            onPreamp={state.setEqPreamp}
            onBand={state.setEqBand}
            onPreset={state.setEqBands}
          />
        )}

        <Playlist
          tracks={state.tracks}
          currentIndex={state.currentIndex}
          selected={state.selected}
          onPlay={(index) => void state.playAt(index)}
          onSelect={state.setSelection}
          onAddFiles={() => void addFiles()}
          onAddFolder={() => void addFolder()}
          onLoadPlaylist={() =>
            void window.aplayer.openPlaylist().then((tracks) => {
              usePlayer.getState().addTracks(tracks)
            })
          }
          onSavePlaylist={() => void window.aplayer.savePlaylist(state.tracks)}
          onRemoveSelected={state.removeSelected}
          onClear={state.clearPlaylist}
        />
      </main>

      {dragging && <div className="dropzone">Drop to add to the playlist</div>}
    </div>
  )
}
