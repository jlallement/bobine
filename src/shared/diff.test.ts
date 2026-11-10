import { afterEach, describe, expect, it, vi } from 'vitest'
import { diffLines } from 'diff'
import { computeDiff, diffStats, firstChangedLine, MAX_EDIT_LENGTH, maxEditLengthFor } from './diff'

const numbered = (n: number) =>
  Array.from({ length: n }, (_, i) => `ligne ${i + 1}`).join('\n') + '\n'

describe('computeDiff', () => {
  it('nouveau fichier : tout en ajout, numéroté', () => {
    const diff = computeDiff(undefined, 'a\nb\n')
    expect(diff).toMatchObject({ added: 2, removed: 0 })
    expect(diff.rows).toEqual([
      { type: 'add', text: 'a', newNo: 1 },
      { type: 'add', text: 'b', newNo: 2 }
    ])
  })

  it('modification au milieu : 3 lignes de contexte, le reste replié', () => {
    const before = numbered(20)
    const after = before.replace('ligne 10\n', 'ligne dix\n')
    const diff = computeDiff(before, after)
    expect(diff).toMatchObject({ added: 1, removed: 1 })
    expect(diff.rows[0]).toEqual({ type: 'skip', count: 6 })
    expect(diff.rows.filter((r) => r.type === 'ctx')).toHaveLength(6)
    expect(diff.rows).toContainEqual({ type: 'del', text: 'ligne 10', oldNo: 10 })
    expect(diff.rows).toContainEqual({ type: 'add', text: 'ligne dix', newNo: 10 })
    expect(diff.rows.at(-1)).toEqual({ type: 'skip', count: 7 })
  })

  it('numérotation décalée après un ajout', () => {
    const diff = computeDiff('a\nb\nc\n', 'a\nnouveau\nb\nc\n')
    expect(diff.rows).toEqual([
      { type: 'ctx', text: 'a', oldNo: 1, newNo: 1 },
      { type: 'add', text: 'nouveau', newNo: 2 },
      { type: 'ctx', text: 'b', oldNo: 2, newNo: 3 },
      { type: 'ctx', text: 'c', oldNo: 3, newNo: 4 }
    ])
  })

  it('textes identiques : aucune ligne', () => {
    expect(computeDiff('a\n', 'a\n')).toEqual({
      rows: [],
      added: 0,
      removed: 0,
      simplified: false,
      timedOut: false
    })
  })

  it('dernière ligne sans retour à la ligne', () => {
    expect(computeDiff('a', 'b').rows).toEqual([
      { type: 'del', text: 'a', oldNo: 1 },
      { type: 'add', text: 'b', newNo: 1 }
    ])
  })
})

/** Textes rendus par les lignes du diff, dépliées entièrement (contexte infini). */
function sides(oldText: string | null, newText: string) {
  const rows = computeDiff(oldText, newText, Infinity).rows
  const lines = rows.filter((r) => r.type !== 'skip')
  return {
    old: lines.flatMap((r) => (r.type === 'add' ? [] : [r.text])),
    new: lines.flatMap((r) => (r.type === 'del' ? [] : [r.text]))
  }
}

const linesOf = (text: string) =>
  text.split('\n').filter((line, i, all) => i < all.length - 1 || line !== '')

describe('calcul borné (fiche 192)', () => {
  it('mêmes totaux que le diff de jsdiff, textes exacts des deux côtés (tirages)', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const text = (n: number) =>
      Array.from({ length: n }, () => `l${Math.floor(random() * 6)}`).join('\n') +
      (random() < 0.5 ? '\n' : '')
    for (let i = 0; i < 300; i++) {
      const a = text(Math.floor(random() * 15))
      const b = text(Math.floor(random() * 15))
      const reference = diffLines(a, b)
      const count = (kind: 'added' | 'removed') =>
        reference.filter((c) => c[kind]).reduce((n, c) => n + (c.count ?? 0), 0)
      expect(diffStats(a, b)).toEqual({
        added: count('added'),
        removed: count('removed'),
        exact: true
      })
      expect(sides(a, b)).toEqual({ old: linesOf(a), new: linesOf(b) })
    }
  })

  it('fichier de 20 000 lignes toutes changées : borné, milieu remplacé en bloc, rien de perdu', () => {
    const before = Array.from({ length: 20_000 }, (_, i) => `ancienne ${i}`).join('\n')
    const after = Array.from({ length: 20_000 }, (_, i) => `nouvelle ${i}`).join('\n')
    const start = performance.now()
    const diff = computeDiff(`début\n${before}\nfin\n`, `début\n${after}\nfin\n`)
    // Large marge (machine chargée) : sans borne, ce calcul prend une minute.
    expect(performance.now() - start).toBeLessThan(3000)
    expect(diff).toMatchObject({ added: 20_000, removed: 20_000, simplified: true })
    expect(diff.rows[0]).toEqual({ type: 'ctx', text: 'début', oldNo: 1, newNo: 1 })
    expect(diff.rows[1]).toEqual({ type: 'del', text: 'ancienne 0', oldNo: 2 })
    expect(diff.rows.at(-1)).toEqual({ type: 'ctx', text: 'fin', oldNo: 20_002, newNo: 20_002 })
  })

  it('peu de modifications dans un très gros fichier : diff ligne à ligne', () => {
    const before = Array.from({ length: 30_000 }, (_, i) => `ligne ${i}`)
    const after = before.map((l, i) => (i % 100 === 0 ? `${l} changée` : l))
    const diff = computeDiff(before.join('\n'), after.join('\n'))
    expect(diff).toMatchObject({ added: 300, removed: 300, simplified: false })
    expect(MAX_EDIT_LENGTH).toBeGreaterThanOrEqual(600)
  })
})

describe('borne déterministe (relecture fiche 192)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('30 000 lignes, 300 modifications : ligne à ligne, quelle que soit l’heure', () => {
    // Horloge arrêtée : seul le nombre de modifications peut arrêter le calcul.
    vi.spyOn(Date, 'now').mockReturnValue(0)
    const before = Array.from({ length: 30_000 }, (_, i) => `ligne ${i}`)
    const after = before.map((l, i) => (i % 100 === 0 ? `${l} changée` : l))
    expect(computeDiff(before.join('\n'), after.join('\n'))).toMatchObject({
      added: 300,
      removed: 300,
      simplified: false,
      timedOut: false
    })
    expect(maxEditLengthFor(60_000)).toBe(1000)
    expect(maxEditLengthFor(1_000_000)).toBe(200)
  })

  it('délai de dernier recours : simplifié, marqué non exact', () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 5000))
    const before = Array.from({ length: 2000 }, (_, i) => `a${i}`).join('\n')
    const after = Array.from({ length: 2000 }, (_, i) => (i % 2 ? `b${i}` : `a${i}`)).join('\n')
    expect(computeDiff(before, after)).toMatchObject({ simplified: true, timedOut: true })
    expect(diffStats(before, after).exact).toBe(false)
  })
})

describe('firstChangedLine (fiche 156)', () => {
  it('la première ligne ajoutée, ou celle qui suit une suppression', () => {
    expect(firstChangedLine(computeDiff('a\nb\nc\n', 'a\nB\nc\n').rows)).toBe(2)
    expect(firstChangedLine(computeDiff('a\nb\nc\n', 'a\nc\n').rows)).toBe(2)
    expect(firstChangedLine(computeDiff(null, 'x\n').rows)).toBe(1)
    expect(firstChangedLine(computeDiff('a\n', 'a\n').rows)).toBeUndefined()
  })
})
