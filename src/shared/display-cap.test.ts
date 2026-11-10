import { describe, expect, it } from 'vitest'
import { computeDiff } from './diff'
import {
  DIFF_BLOCK,
  diffSegments,
  lineCount,
  linesOf,
  outputCap,
  rowsForLines,
  safeCut,
  startOfLinesBefore,
  textCounts,
  utf8Length
} from './display-cap'

const lines = (n: number, eol = '\n') =>
  Array.from({ length: n }, (_, i) => `ligne ${i + 1}`).join(eol) + eol

describe('plafond des sorties (fiche 192)', () => {
  it('contenu vide ou court : rien de masqué', () => {
    expect(outputCap('')).toMatchObject({ start: 0, totalLines: 0, hiddenLines: 0, bytes: 0 })
    expect(outputCap('a\nb\n')).toMatchObject({ start: 0, totalLines: 2, hiddenLines: 0 })
  })

  it('plafond en lignes : les dernières, le nombre masqué exact', () => {
    const text = lines(16_384)
    const cap = outputCap(text)
    expect(cap).toMatchObject({ totalLines: 16_384, hiddenLines: 15_884, byChars: false })
    expect(text.slice(cap.start).startsWith('ligne 15885\n')).toBe(true)
    expect(lineCount(text.slice(cap.start))).toBe(500)
  })

  it('fins de ligne CRLF : comptées une fois, le \\r reste avec sa ligne', () => {
    const text = lines(600, '\r\n')
    const cap = outputCap(text)
    expect(cap).toMatchObject({ totalLines: 600, hiddenLines: 100 })
    expect(text.slice(cap.start).startsWith('ligne 101\r\n')).toBe(true)
  })

  it('ligne unique géante : plafond en caractères, « début masqué »', () => {
    const text = 'x'.repeat(1024 * 1024)
    const cap = outputCap(text)
    expect(cap).toMatchObject({ totalLines: 1, byChars: true, bytes: 1024 * 1024 })
    expect(text.length - cap.start).toBe(200 * 1024)
  })

  it('trop gros pour tout afficher : au-delà de 50 000 lignes ou 5 Mio', () => {
    expect(outputCap(lines(40_000)).tooBig).toBe(false)
    expect(outputCap(lines(50_001)).tooBig).toBe(true)
    expect(outputCap('é'.repeat(3 * 1024 * 1024)).tooBig).toBe(true)
  })

  it('début des n lignes avant une position', () => {
    expect(startOfLinesBefore('a\nb\nc\n', 6, 2)).toBe(2)
    expect(startOfLinesBefore('a\nb\nc', 5, 2)).toBe(2)
    expect(startOfLinesBefore('a\nb\nc\n', 6, 9)).toBe(0)
  })
})

describe('coupures et comptes sûrs (relecture fiche 192)', () => {
  it('jamais au milieu d’une paire de substitution', () => {
    const text = '😀'.repeat(150 * 1024)
    const cap = outputCap(text)
    expect(cap.byChars).toBe(true)
    const shown = text.slice(cap.start)
    expect(shown.codePointAt(0)).toBe(0x1f600)
    expect(safeCut('a😀b', 2)).toBe(3)
  })

  it('jamais au milieu d’une séquence ANSI', () => {
    const text = 'x\x1b[31mrouge'
    expect(safeCut(text, 3)).toBe(6)
    expect(safeCut(text, 1)).toBe(1)
    expect(safeCut(text, 6)).toBe(6)
  })

  it('fin de ligne finale double, \\r seul', () => {
    expect(lineCount('a\n\n')).toBe(2)
    expect(lineCount('a\rb\rc')).toBe(1)
    expect(lineCount('\n')).toBe(1)
    expect(outputCap('a\n\n')).toMatchObject({ totalLines: 2, hiddenLines: 0, start: 0 })
  })

  it('comptes à la suite d’un morceau : comme comptés en entier, octets sans réencoder', () => {
    const first = textCounts('ab\né')
    const next = textCounts('ab\né😀\nfin\n', first)
    expect(next).toEqual(textCounts('ab\né😀\nfin\n'))
    expect(next.bytes).toBe(new TextEncoder().encode('ab\né😀\nfin\n').length)
    expect(utf8Length('é😀a')).toBe(7)
    // Paire de substitution coupée entre deux morceaux : recomptée en entier.
    const half = textCounts('a\ud83d')
    expect(textCounts('a😀', half).bytes).toBe(5)
  })
})

describe('plafond des diffs (fiche 192)', () => {
  it('diff ligne à ligne : une seule tranche', () => {
    const diff = computeDiff(lines(1000), lines(1000).replace(/ligne (\d*0)\n/g, 'L$1\n'))
    expect(diff.simplified).toBe(false)
    expect(diffSegments(diff.rows, false)).toHaveLength(1)
  })

  it('diff simplifié : les retirées puis les ajoutées, chacune plafonnée', () => {
    const before = Array.from({ length: 5000 }, (_, i) => `a${i}`).join('\n')
    const after = Array.from({ length: 5000 }, (_, i) => `b${i}`).join('\n')
    const diff = computeDiff(`début\n${before}\nfin\n`, `début\n${after}\nfin\n`)
    const segments = diffSegments(diff.rows, true)
    expect(segments.map((s) => [s.kind, linesOf(s.rows)])).toEqual([
      ['lines', 1],
      ['removed', 5000],
      ['added', 5000],
      ['lines', 1]
    ])
    expect(segments[1]?.limit).toBe(DIFF_BLOCK)
  })

  it('rangées à rendre : les plages repliées ne comptent pas', () => {
    const rows = computeDiff(lines(100), lines(100).replace('ligne 50\n', 'L\n')).rows
    expect(rows[0]).toMatchObject({ type: 'skip' })
    expect(rowsForLines(rows, 2)).toBe(3)
    expect(rowsForLines(rows, 1000)).toBe(rows.length)
  })
})
