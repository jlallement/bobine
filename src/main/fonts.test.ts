import { describe, expect, it, vi } from 'vitest'
import { fontLister, parseFontconfig, parseFonts } from './fonts'
import { fontSource } from './platform'

describe('polices installées (fiche 136)', () => {
  it('garde les noms posables dans le CSS, triés, sans doublon', () => {
    expect(
      parseFonts(
        JSON.stringify({
          families: ['Menlo', 'Avenir Next', 'Menlo', 'Bad"Font', 'Brace{'],
          monospace: ['Menlo', 'PT Mono']
        })
      )
    ).toEqual({ families: ['Avenir Next', 'Menlo'], monospace: ['Menlo', 'PT Mono'] })
    expect(parseFonts('pas du JSON')).toEqual({ families: [], monospace: [] })
    expect(parseFonts('{"families": 3}')).toEqual({ families: [], monospace: [] })
  })

  it('lues une seule fois ; vides sans source ou si la lecture échoue', async () => {
    const run = vi.fn(async (_command: string, _args: string[]) =>
      JSON.stringify({ families: ['Menlo'], monospace: ['Menlo'] })
    )
    const list = fontLister('appkit', run)
    expect(await list()).toEqual({ families: ['Menlo'], monospace: ['Menlo'] })
    await list()
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0]?.[0]).toBe('osascript')
    const none = vi.fn(async () => '{}')
    expect(await fontLister(undefined, none)()).toEqual({ families: [], monospace: [] })
    expect(none).not.toHaveBeenCalled()
    const failing = fontLister('appkit', () => Promise.reject(new Error('osascript')))
    expect(await failing()).toEqual({ families: [], monospace: [] })
  })

  it('sous Linux, lues par fc-list : chasse fixe d’après l’espacement (fiche 145)', async () => {
    const output = [
      'DejaVu Sans\t0',
      'DejaVu Sans Mono\t100',
      'Noto Sans Mono CJK JP\t90',
      'Terminus\t110',
      'DejaVu Sans Mono\t100',
      'Bad"Font\t100',
      '',
      'Sans espacement'
    ].join('\n')
    expect(parseFontconfig(output)).toEqual({
      families: [
        'DejaVu Sans',
        'DejaVu Sans Mono',
        'Noto Sans Mono CJK JP',
        'Sans espacement',
        'Terminus'
      ],
      monospace: ['DejaVu Sans Mono', 'Noto Sans Mono CJK JP', 'Terminus']
    })
    const run = vi.fn(async (_command: string, _args: string[]) => output)
    expect((await fontLister('fontconfig', run)()).monospace).toContain('DejaVu Sans Mono')
    expect(run.mock.calls[0]?.[0]).toBe('fc-list')
  })

  it('source choisie d’après le système', () => {
    expect(fontSource('darwin')).toBe('appkit')
    expect(fontSource('linux')).toBe('fontconfig')
    expect(fontSource('win32')).toBeUndefined()
  })
})
