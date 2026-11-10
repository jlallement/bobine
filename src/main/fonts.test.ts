import { describe, expect, it, vi } from 'vitest'
import { fontLister, parseFonts } from './fonts'

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

  it('lues une seule fois ; vides hors macOS ou si le script échoue', async () => {
    const run = vi.fn(async () => JSON.stringify({ families: ['Menlo'], monospace: ['Menlo'] }))
    const list = fontLister(run, 'darwin')
    expect(await list()).toEqual({ families: ['Menlo'], monospace: ['Menlo'] })
    await list()
    expect(run).toHaveBeenCalledTimes(1)
    const linux = vi.fn(async () => '{}')
    expect(await fontLister(linux, 'linux')()).toEqual({ families: [], monospace: [] })
    expect(linux).not.toHaveBeenCalled()
    const failing = fontLister(() => Promise.reject(new Error('osascript')), 'darwin')
    expect(await failing()).toEqual({ families: [], monospace: [] })
  })
})
