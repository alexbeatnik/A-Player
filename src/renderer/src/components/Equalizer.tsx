import type { JSX } from 'react'
import { EQ_FREQUENCIES, EQ_PRESETS, type EqualizerState } from '@shared/types'
import { Slider } from '@/components/Slider'

interface EqualizerProps {
  equalizer: EqualizerState
  onToggle: (enabled: boolean) => void
  onPreamp: (value: number) => void
  onBand: (index: number, value: number) => void
  onPreset: (bands: number[]) => void
}

function label(frequency: number): string {
  return frequency >= 1000 ? `${frequency / 1000}k` : String(frequency)
}

export function Equalizer({
  equalizer,
  onToggle,
  onPreamp,
  onBand,
  onPreset
}: EqualizerProps): JSX.Element {
  return (
    <section className="panel eq">
      <header className="panel__header">
        <span className="panel__title">Equalizer</span>
        <div className="panel__actions">
          <select
            className="eq__preset"
            aria-label="Equalizer preset"
            defaultValue=""
            onChange={(event) => {
              const preset = EQ_PRESETS[event.target.value]
              if (preset) onPreset(preset)
            }}
          >
            <option value="" disabled>
              Presets
            </option>
            {Object.keys(EQ_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn btn--toggle ${equalizer.enabled ? 'is-active' : ''}`}
            onClick={() => onToggle(!equalizer.enabled)}
            title={equalizer.enabled ? 'Turn equalizer off' : 'Turn equalizer on'}
          >
            {equalizer.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      <div className={`eq__body ${equalizer.enabled ? '' : 'eq__body--disabled'}`}>
        <div className="eq__band eq__band--preamp">
          <Slider
            orient="vertical"
            className="eq__slider"
            min={-12}
            max={12}
            step={0.5}
            value={equalizer.preamp}
            onChange={onPreamp}
            ariaLabel="Preamp"
            title={`Preamp: ${equalizer.preamp.toFixed(1)} dB`}
          />
          <span className="eq__label">PRE</span>
        </div>

        <div className="eq__separator" />

        {EQ_FREQUENCIES.map((frequency, index) => (
          <div key={frequency} className="eq__band">
            <Slider
              orient="vertical"
              className="eq__slider"
              min={-12}
              max={12}
              step={0.5}
              value={equalizer.bands[index] ?? 0}
              onChange={(value) => onBand(index, value)}
              ariaLabel={`${label(frequency)} Hz`}
              title={`${label(frequency)} Hz: ${(equalizer.bands[index] ?? 0).toFixed(1)} dB`}
            />
            <span className="eq__label">{label(frequency)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
