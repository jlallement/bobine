import type { BobApi } from '../../preload/api'

declare global {
  interface Window {
    api: BobApi
  }
}

/** Texte brut d'un fichier, intégré au moment du build (Vite, `?raw`). */
declare module '*.md?raw' {
  const text: string
  export default text
}

export {}
