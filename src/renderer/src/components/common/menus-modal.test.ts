import { describe, expect, it } from 'vitest'

// Sources des composants, lues telles quelles (sans les tests).
const sources = import.meta.glob<string>(['../**/*.tsx', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true
})

describe('menus déroulants', () => {
  it('are all non-modal: a modal Radix menu that opens a dialog leaves the page unclickable', () => {
    // Fiche 049, puis Réglages ouverts depuis « Réglages de la session » : la fenêtre refermée,
    // `pointer-events: none` restait sur la page. Un menu non modal n'a pas ce piège.
    const modal = Object.entries(sources).flatMap(([file, source]) =>
      [...source.matchAll(/<Dropdown\.Root\b[^>]*>/g)]
        .filter((tag) => !/\bmodal=\{false\}/.test(tag[0]))
        .map(() => file)
    )
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    expect(modal).toEqual([])
  })
})
