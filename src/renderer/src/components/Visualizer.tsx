import { useEffect, useRef, type JSX } from 'react'
import { engine } from '@/state/player'

export type VisualizerMode = 'spectrum' | 'oscilloscope' | 'off'

interface VisualizerProps {
  mode: VisualizerMode
  onCycleMode: () => void
}

const BAR_COUNT = 20

export function Visualizer({ mode, onCycleMode }: VisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || mode === 'off') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // The canvas is drawn in physical pixels, otherwise everything is blurry on
    // HiDPI. The window is resizable, so the backing store has to follow it —
    // otherwise the picture stays stretched at whatever size it had on mount.
    let cssWidth = 0
    let cssHeight = 0

    // An arrow function, not a declaration: hoisting would lose the null checks
    // above and TypeScript would no longer see canvas/ctx as non-null.
    const resize = (): void => {
      cssWidth = canvas.clientWidth
      cssHeight = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      // Changing the backing size resets the context transform.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame = 0
    // Bars rise instantly but fall smoothly, which reads better than raw values.
    const levels = new Float32Array(BAR_COUNT)
    const peaks = new Float32Array(BAR_COUNT)

    function draw(): void {
      frame = requestAnimationFrame(draw)
      const analyser = engine.analyser
      if (!ctx) return

      ctx.clearRect(0, 0, cssWidth, cssHeight)

      if (!analyser) return

      if (mode === 'oscilloscope') {
        const buffer = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(buffer)

        ctx.beginPath()
        ctx.strokeStyle = '#3ce87a'
        ctx.lineWidth = 1.5
        for (let i = 0; i < buffer.length; i++) {
          const x = (i / (buffer.length - 1)) * cssWidth
          const y = ((buffer[i] - 128) / 128) * (cssHeight / 2) + cssHeight / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        return
      }

      const bins = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(bins)

      const barWidth = cssWidth / BAR_COUNT
      for (let i = 0; i < BAR_COUNT; i++) {
        // Logarithmic distribution: otherwise nearly every bar lands in the high
        // frequencies, where there is almost no energy.
        const from = Math.floor(bins.length ** (i / BAR_COUNT)) - 1
        const to = Math.floor(bins.length ** ((i + 1) / BAR_COUNT))
        let sum = 0
        let count = 0
        for (let j = Math.max(0, from); j < Math.min(to, bins.length); j++) {
          sum += bins[j]
          count++
        }
        const value = count > 0 ? sum / count / 255 : 0

        levels[i] = value > levels[i] ? value : levels[i] * 0.82
        peaks[i] = levels[i] > peaks[i] ? levels[i] : Math.max(0, peaks[i] - 0.008)

        const height = levels[i] * cssHeight
        const x = i * barWidth

        const gradient = ctx.createLinearGradient(0, cssHeight, 0, cssHeight - height)
        gradient.addColorStop(0, '#1f9e4d')
        gradient.addColorStop(0.6, '#3ce87a')
        gradient.addColorStop(1, '#c9f56b')
        ctx.fillStyle = gradient
        ctx.fillRect(x + 1, cssHeight - height, barWidth - 2, height)

        const peakY = cssHeight - peaks[i] * cssHeight
        ctx.fillStyle = '#d8dee9'
        ctx.fillRect(x + 1, peakY, barWidth - 2, 1.5)
      }
    }

    draw()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [mode])

  return (
    <div className="visualizer" onClick={onCycleMode} title="Click to change visualisation mode">
      {mode === 'off' ? (
        <span className="visualizer__off">visualisation off</span>
      ) : (
        <canvas ref={canvasRef} className="visualizer__canvas" />
      )}
    </div>
  )
}
