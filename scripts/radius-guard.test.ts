import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RADIUS_TOKENS } from '../src/shared/themes.ts'

/**
 * Garde-fou des rayons (fiche 170) : dans les CSS du renderer, un `border-radius` (ou une de ses
 * formes longues) ne prend qu'un jeton `var(--radius-*)`, `0`, `inherit`, ou un `calc()` tiré d'un
 * jeton (rayon intérieur d'un enfant collé au bord : `calc(var(--radius-md) - 1px)`). Le chassis
 * des appareils (simulateur, Android) calcule les siens en style en ligne : hors règle.
 */
const RENDERER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'src')
const GENERATED = 'themes.generated.css'
const TOKEN = new RegExp(`^var\\(--radius-(${Object.keys(RADIUS_TOKENS).join('|')})\\)$`)

/** Une valeur (un des quatre coins) est-elle permise ? */
function allowedRadius(part: string): boolean {
  if (part === '0' || part === 'inherit') return true
  if (TOKEN.test(part)) return true
  return /^calc\(var\(--radius-[a-z]+\)\s*[-+]\s*\d+(\.\d+)?px\)$/.test(part)
}

/** Les coins d'une valeur de `border-radius`, `var(…)` et `calc(…)` gardés d'un seul tenant. */
function corners(value: string): string[] {
  return value.match(/calc\((?:[^()]|\([^()]*\))*\)|var\([^)]*\)|[^\s/]+/g) ?? []
}

/** Les déclarations de rayon d'un fichier CSS refusées par la règle, « ligne : déclaration ». */
function hardRadii(css: string): string[] {
  const refused: string[] = []
  css.split('\n').forEach((line, i) => {
    const m = /(?:^|[\s;{])(border(?:-[a-z]+)*-radius)\s*:\s*([^;]+)/.exec(line)
    if (!m) return
    const value = (m[2] ?? '').replace(/!important/, '').trim()
    if (!corners(value).every(allowedRadius)) refused.push(`${i + 1} : ${m[1]}: ${value}`)
  })
  return refused
}

describe('rayons : jetons seulement (fiche 170)', () => {
  it('reconnaît les jetons, 0, inherit et un calc() tiré d’un jeton', () => {
    expect(hardRadii('a { border-radius: var(--radius-sm); }')).toEqual([])
    expect(hardRadii('a { border-radius: 0 var(--radius-md) var(--radius-md) 0; }')).toEqual([])
    expect(hardRadii('a { border-radius: 0 0 calc(var(--radius-md) - 1px) 0; }')).toEqual([])
    expect(hardRadii('a { border-bottom-left-radius: 0; }')).toEqual([])
    expect(hardRadii('a { border-radius: 8px; }')).toHaveLength(1)
    expect(hardRadii('a { border-radius: 50%; }')).toHaveLength(1)
    expect(hardRadii('a { border-top-left-radius: 3px; }')).toHaveLength(1)
    expect(hardRadii('a { border-radius: var(--radius); }')).toHaveLength(1)
    expect(hardRadii('a { border-radius: calc(10px - 1px); }')).toHaveLength(1)
  })

  it('aucun border-radius en dur dans les CSS du renderer', () => {
    const files = readdirSync(RENDERER, { recursive: true, encoding: 'utf8' }).filter(
      (f: string) => f.endsWith('.css') && f !== GENERATED
    )
    expect(files.length).toBeGreaterThan(3)
    const refused = files.flatMap((f: string) =>
      hardRadii(readFileSync(join(RENDERER, f), 'utf8')).map((r) => `${f}:${r}`)
    )
    expect(refused, 'remplacer par var(--radius-xs|sm|md|lg|pill)').toEqual([])
  })
})
