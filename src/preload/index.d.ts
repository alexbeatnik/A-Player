import type { APlayerApi } from './index.js'

declare global {
  interface Window {
    aplayer: APlayerApi
  }
}

export {}
