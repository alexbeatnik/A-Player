import { useEffect, useRef, useState, type JSX } from 'react'
import type { Track } from '@shared/types'
import { formatTime, trackLabel } from '@/utils/format'

interface DisplayProps {
  track: Track | null
  currentTime: number
  duration: number
  isPlaying: boolean
  /** Show remaining time instead of elapsed. */
  remaining: boolean
  onToggleRemaining: () => void
}

/** A line longer than the window scrolls past instead of being clipped. */
function useMarquee(text: string): { ref: React.RefObject<HTMLDivElement | null>; scroll: boolean } {
  const ref = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    setScroll(element.scrollWidth > element.clientWidth + 1)
  }, [text])

  return { ref, scroll }
}

export function Display({
  track,
  currentTime,
  duration,
  isPlaying,
  remaining,
  onToggleRemaining
}: DisplayProps): JSX.Element {
  const label = track ? trackLabel(track) : 'Nothing playing'
  const { ref, scroll } = useMarquee(label)

  const shown = remaining ? Math.max(0, duration - currentTime) : currentTime
  const sign = remaining && duration > 0 ? '-' : ''

  return (
    <div className="display">
      <div className="display__left">
        <button
          type="button"
          className="display__time"
          onClick={onToggleRemaining}
          title="Click to switch between elapsed and remaining time"
        >
          {sign}
          {formatTime(shown)}
        </button>
        <div className={`display__status display__status--${isPlaying ? 'play' : 'pause'}`}>
          {isPlaying ? '▶' : '❙❙'}
        </div>
      </div>

      <div className="display__right">
        <div className="display__marquee">
          <div ref={ref} className={`display__title ${scroll ? 'display__title--scroll' : ''}`}>
            <span>{label}</span>
            {scroll && <span className="display__title-copy">{label}</span>}
          </div>
        </div>

        <div className="display__meta">
          {track ? (
            <>
              <span>{track.bitrate ? `${track.bitrate} kbps` : track.codec}</span>
              <span>{track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : ''}</span>
              <span>{track.channels === 1 ? 'mono' : track.channels ? 'stereo' : ''}</span>
              <span className="display__meta-duration">{formatTime(duration)}</span>
            </>
          ) : (
            <span className="display__meta-empty">add files to the playlist</span>
          )}
        </div>
      </div>
    </div>
  )
}
