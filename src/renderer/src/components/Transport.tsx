import type { JSX } from 'react'
import type { RepeatMode } from '@shared/types'

interface TransportProps {
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  onPrevious: () => void
  onPlayPause: () => void
  onStop: () => void
  onNext: () => void
  onOpenFiles: () => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
}

const REPEAT_TITLES: Record<RepeatMode, string> = {
  off: 'Repeat off',
  all: 'Repeat playlist',
  one: 'Repeat track'
}

export function Transport({
  isPlaying,
  shuffle,
  repeat,
  onPrevious,
  onPlayPause,
  onStop,
  onNext,
  onOpenFiles,
  onToggleShuffle,
  onCycleRepeat
}: TransportProps): JSX.Element {
  return (
    <div className="transport">
      <div className="transport__main">
        <button type="button" className="btn" onClick={onPrevious} title="Previous (Ctrl+←)">
          ⏮
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onPlayPause}
          title="Play / pause (Space)"
        >
          {isPlaying ? '❙❙' : '▶'}
        </button>
        <button type="button" className="btn" onClick={onStop} title="Stop">
          ■
        </button>
        <button type="button" className="btn" onClick={onNext} title="Next (Ctrl+→)">
          ⏭
        </button>
        <button type="button" className="btn" onClick={onOpenFiles} title="Open files (Ctrl+O)">
          ⏏
        </button>
      </div>

      <div className="transport__modes">
        <button
          type="button"
          className={`btn btn--toggle ${shuffle ? 'is-active' : ''}`}
          onClick={onToggleShuffle}
          title="Shuffle"
        >
          🔀
        </button>
        <button
          type="button"
          className={`btn btn--toggle ${repeat !== 'off' ? 'is-active' : ''}`}
          onClick={onCycleRepeat}
          title={REPEAT_TITLES[repeat]}
        >
          {repeat === 'one' ? '🔂' : '🔁'}
        </button>
      </div>
    </div>
  )
}
