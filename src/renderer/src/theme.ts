/**
 * Thème affiché (fiche 134) : palette et accent lus sur la page, et l'abonnement à leurs
 * changements. Le clair ou le sombre suit `nativeTheme` (réglé par le main, vu par
 * `prefers-color-scheme`) ; Sépia, Nuit noire et l'accent sont posés par `applyAppearance`
 * (`data-palette`, `data-accent`). Pour ce qui ne lit pas le CSS : xterm, Mermaid.
 */
import { accentOf, paletteOf, themeTokens, type Palette, type ThemeTokens } from '@shared/themes'

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

/** Palette affichée. */
export function currentPalette(): Palette {
  return paletteOf(document.documentElement.dataset['palette'], darkQuery()?.matches ?? false)
}

/** Jetons du thème affiché. */
export function currentTokens(): ThemeTokens {
  return themeTokens(currentPalette(), accentOf(document.documentElement.dataset['accent']))
}

/** Clé du thème affiché : change avec le mode, la palette ou l'accent. */
export function themeKey(): string {
  const root = document.documentElement
  return `${darkQuery()?.matches ?? false}:${root.dataset['palette'] ?? ''}:${root.dataset['accent'] ?? ''}`
}

/** Prévient `changed` à chaque changement de mode, de palette ou d'accent ; rend le désabonnement. */
export function subscribeTheme(changed: () => void): () => void {
  const media = darkQuery()
  media?.addEventListener('change', changed)
  const observer = new MutationObserver(changed)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-palette', 'data-accent']
  })
  return () => {
    media?.removeEventListener('change', changed)
    observer.disconnect()
  }
}
