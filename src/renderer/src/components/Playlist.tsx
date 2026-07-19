import { useRef, type JSX, type MouseEvent } from 'react'
import type { Track } from '@shared/types'
import { formatTime, formatTotalTime, trackLabel } from '@/utils/format'

interface PlaylistProps {
  tracks: Track[]
  currentIndex: number
  selected: Set<number>
  onPlay: (index: number) => void
  onSelect: (indices: number[]) => void
  onAddFiles: () => void
  onAddFolder: () => void
  onLoadPlaylist: () => void
  onSavePlaylist: () => void
  onRemoveSelected: () => void
  onClear: () => void
}

export function Playlist({
  tracks,
  currentIndex,
  selected,
  onPlay,
  onSelect,
  onAddFiles,
  onAddFolder,
  onLoadPlaylist,
  onSavePlaylist,
  onRemoveSelected,
  onClear
}: PlaylistProps): JSX.Element {
  // Anchor for Shift range selection.
  const anchorRef = useRef<number | null>(null)

  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)

  function handleClick(event: MouseEvent<HTMLLIElement>, index: number): void {
    if (event.shiftKey && anchorRef.current !== null) {
      const from = Math.min(anchorRef.current, index)
      const to = Math.max(anchorRef.current, index)
      onSelect(Array.from({ length: to - from + 1 }, (_, offset) => from + offset))
      return
    }

    if (event.ctrlKey || event.metaKey) {
      const next = new Set(selected)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      onSelect([...next])
      anchorRef.current = index
      return
    }

    onSelect([index])
    anchorRef.current = index
  }

  return (
    <section className="panel playlist">
      <header className="panel__header">
        <span className="panel__title">
          Playlist
          <span className="playlist__count">
            {tracks.length > 0 ? `${tracks.length} · ${formatTotalTime(totalDuration)}` : 'empty'}
          </span>
        </span>
        <div className="panel__actions">
          <button type="button" className="btn btn--small" onClick={onAddFiles} title="Add files">
            + Files
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={onAddFolder}
            title="Add folder recursively"
          >
            + Folder
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={onLoadPlaylist}
            title="Load M3U"
          >
            ↥
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={onSavePlaylist}
            title="Save as M3U"
            disabled={tracks.length === 0}
          >
            ↧
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={onRemoveSelected}
            title="Remove selected (Delete)"
            disabled={selected.size === 0}
          >
            −
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={onClear}
            title="Clear playlist"
            disabled={tracks.length === 0}
          >
            ✕
          </button>
        </div>
      </header>

      {tracks.length === 0 ? (
        <div className="playlist__empty">
          Drop files or folders here
          <span>supported: mp3, wav, flac, ogg, opus, m4a, aac</span>
        </div>
      ) : (
        <ol className="playlist__list">
          {tracks.map((track, index) => (
            <li
              key={track.path}
              className={[
                'playlist__item',
                index === currentIndex ? 'is-current' : '',
                selected.has(index) ? 'is-selected' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => handleClick(event, index)}
              onDoubleClick={() => onPlay(index)}
              onContextMenu={(event) => {
                event.preventDefault()
                void window.aplayer.showInFolder(track.path)
              }}
              title={track.path}
            >
              <span className="playlist__index">{index + 1}.</span>
              <span className="playlist__label">{trackLabel(track)}</span>
              <span className="playlist__duration">
                {track.duration > 0 ? formatTime(track.duration) : '--:--'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
