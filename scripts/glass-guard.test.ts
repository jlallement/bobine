import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Garde-fou du verre (fiche 226, ADR-0049) : `backdrop-filter` seulement sur ce qui flotte (menus
 * et popovers `.menu`, fenêtre des Réglages), jamais sur un panneau fixe ni sur ce qui défile dans
 * le fil : un flou recalculé à chaque image du défilement coûte cher. Et aucun dégradé animé :
 * aucune étape d'animation (`@keyframes`) ne lit une touche (`--touch-*`, `--glass-*`).
 */
const RENDERER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'src')
const GENERATED = 'themes.generated.css'
const GLASS_SELECTORS = new Set(['.menu', '.settings-dialog'])

/** Règles d'un fichier CSS : sélecteur et corps (sans les blocs @media imbriqués en profondeur). */
function rules(css: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(pattern)) {
    found.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' })
  }
  return found
}

function refusedGlass(css: string): string[] {
  return rules(css)
    .filter(({ body }) => /(^|[\s;])(-webkit-)?backdrop-filter\s*:/.test(body))
    .map(({ selector }) => selector)
    .filter((selector) => !GLASS_SELECTORS.has(selector))
}

/** Étapes d'animation (`from`, `to`, `50%`) qui lisent une touche. */
function animatedTouches(css: string): string[] {
  return rules(css)
    .filter(({ selector }) => /^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(selector))
    .filter(({ body }) => /var\(--(touch|glass)-/.test(body))
    .map(({ selector, body }) => `${selector} { ${body.trim()} }`)
}

const files = () =>
  readdirSync(RENDERER, { recursive: true, encoding: 'utf8' }).filter(
    (f: string) => f.endsWith('.css') && f !== GENERATED
  )

describe('verre et touches (fiche 226)', () => {
  it('reconnaît une règle en verre hors de la liste, et une touche animée', () => {
    expect(refusedGlass('.menu { backdrop-filter: blur(2px); }')).toEqual([])
    expect(refusedGlass('.msg-user { -webkit-backdrop-filter: blur(2px); }')).toEqual(['.msg-user'])
    expect(animatedTouches('@keyframes a { from { opacity: 0; } }')).toEqual([])
    expect(animatedTouches('@keyframes a { to { background: var(--touch-main); } }')).toHaveLength(
      1
    )
  })

  it('backdrop-filter seulement sur les menus et les Réglages', () => {
    const list = files()
    expect(list.length).toBeGreaterThan(3)
    expect(
      list.flatMap((f) =>
        refusedGlass(readFileSync(join(RENDERER, f), 'utf8')).map((s) => `${f}: ${s}`)
      )
    ).toEqual([])
  })

  it('aucune touche animée', () => {
    expect(
      files().flatMap((f) =>
        animatedTouches(readFileSync(join(RENDERER, f), 'utf8')).map((s) => `${f}: ${s}`)
      )
    ).toEqual([])
  })
})
