import type { JSX } from 'react'

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  className?: string
  title?: string
  orient?: 'horizontal' | 'vertical'
  ariaLabel: string
}

/**
 * Wrapper around <input type="range">. The native element gives dragging,
 * keyboard support and accessibility for free — a custom mousedown
 * implementation would lose all of that.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  className = '',
  title,
  orient = 'horizontal',
  ariaLabel
}: SliderProps): JSX.Element {
  return (
    <input
      type="range"
      className={`slider slider--${orient} ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      title={title}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}
