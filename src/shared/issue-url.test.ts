import { describe, expect, it } from 'vitest'
import { ISSUE_URL_LIMIT, REPOSITORY_URL, issueUrl } from './issue-url'

const params = (url: string) => new URL(url).searchParams

describe('issue GitHub préremplie (fiche 105)', () => {
  it('gabarit bug.yml, version et rapport dans les champs du gabarit', () => {
    const { url, truncated } = issueUrl({
      version: '0.3.0',
      report:
        'Diagnostic de Bobine — 2026-10-21 18:00\nTout va bien\n\nBobine\n  ✓ Version : 0.3.0',
      truncatedNote: '[coupé]'
    })
    expect(
      url.startsWith(`${REPOSITORY_URL}/issues/new?template=bug.yml&version=0.3.0&report=`)
    ).toBe(true)
    expect(params(url).get('template')).toBe('bug.yml')
    expect(params(url).get('version')).toBe('0.3.0')
    expect(params(url).get('report')).toBe(
      'Diagnostic de Bobine — 2026-10-21 18:00\nTout va bien\n\nBobine\n  ✓ Version : 0.3.0'
    )
    expect(truncated).toBe(false)
    expect(url.length).toBeLessThanOrEqual(ISSUE_URL_LIMIT)
  })

  it('rapport trop long : coupé à une ligne entière, sous la limite, avec la ligne à coller', () => {
    const lines = Array.from(
      { length: 400 },
      (_, i) => `  ✓ Vérification ${i} : détail en français, é`
    )
    const { url, truncated } = issueUrl(
      {
        version: '0.3.0',
        report: lines.join('\n'),
        truncatedNote: '[Rapport coupé : coller le reste.]'
      },
      2_000
    )
    expect(truncated).toBe(true)
    expect(url.length).toBeLessThanOrEqual(2_000)
    const report = params(url).get('report') ?? ''
    const kept = report.split('\n')
    expect(kept.at(-1)).toBe('[Rapport coupé : coller le reste.]')
    // Des lignes entières seulement, dans l'ordre, et le plus possible.
    expect(kept.slice(0, -1)).toEqual(lines.slice(0, kept.length - 1))
    expect(kept.length).toBeGreaterThan(10)
    // Une ligne de plus (avec la ligne à coller) ne tiendrait pas.
    const prefix = url.indexOf('&report=') + '&report='.length
    const oneMore = encodeURIComponent(
      [...lines.slice(0, kept.length), '[Rapport coupé : coller le reste.]'].join('\n')
    )
    expect(prefix + oneMore.length).toBeGreaterThan(2_000)
  })

  it('tient toujours dans la limite, même avec une seule ligne trop longue', () => {
    const { url, truncated } = issueUrl(
      { version: 'v', report: 'x'.repeat(5_000), truncatedNote: 'coupé' },
      500
    )
    expect(truncated).toBe(true)
    expect(url.length).toBeLessThanOrEqual(500)
    expect(params(url).get('report')).toBe('\ncoupé')
  })
})
