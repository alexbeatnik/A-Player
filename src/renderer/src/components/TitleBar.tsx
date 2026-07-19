import type { JSX } from 'react'

interface TitleBarProps {
  title: string
}

export function TitleBar({ title }: TitleBarProps): JSX.Element {
  return (
    <div className="titlebar">
      <span className="titlebar__name">A-PLAYER</span>
      <span className="titlebar__track">{title}</span>
      <div className="titlebar__buttons">
        <button
          type="button"
          className="titlebar__button"
          title="Minimise"
          onClick={() => void window.aplayer.minimize()}
        >
          _
        </button>
        <button
          type="button"
          className="titlebar__button titlebar__button--close"
          title="Close"
          onClick={() => void window.aplayer.close()}
        >
          ×
        </button>
      </div>
    </div>
  )
}
