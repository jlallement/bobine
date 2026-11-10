import { afterEach, describe, expect, it, vi } from 'vitest'

/** Familles d'une pile CSS, sans guillemets. */
const families = (css: string) => css.split(',').map((f) => f.trim().replace(/^"|"$/g, ''))

describe('police du terminal (fiche 201)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('Nerd Font livrée juste avant monospace, après les polices de lettres', async () => {
    const { terminalFontCss, TERMINAL_SYMBOLS_FAMILY } = await import('./appearance')
    const list = families(terminalFontCss(undefined))
    expect(list.at(-1)).toBe('monospace')
    expect(list.at(-2)).toBe(TERMINAL_SYMBOLS_FAMILY)
    expect(list.indexOf('Menlo')).toBeLessThan(list.indexOf(TERMINAL_SYMBOLS_FAMILY))
    expect(list.indexOf('SF Mono')).toBeLessThan(list.indexOf(TERMINAL_SYMBOLS_FAMILY))
    expect(list.filter((f) => f === TERMINAL_SYMBOLS_FAMILY)).toHaveLength(1)
  })

  it('la police choisie reste la première', async () => {
    const { terminalFontCss, TERMINAL_SYMBOLS_FAMILY } = await import('./appearance')
    const list = families(terminalFontCss('Fira Code'))
    expect(list[0]).toBe('Fira Code')
    expect(list).toContain(TERMINAL_SYMBOLS_FAMILY)
  })

  it('charge la police des icônes une seule fois, avec une icône', async () => {
    const load = vi.fn(() => Promise.resolve([]))
    vi.stubGlobal('document', { fonts: { load } })
    const { loadTerminalSymbols, terminalSymbolsSettled } = await import('./appearance')
    expect(terminalSymbolsSettled()).toBe(false)
    await Promise.all([loadTerminalSymbols(), loadTerminalSymbols()])
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('12px "Bobine Nerd Font"', '')
    expect(terminalSymbolsSettled()).toBe(true)
  })

  it('police illisible : ne rejette pas, le terminal s’ouvre quand même', async () => {
    vi.stubGlobal('document', { fonts: { load: () => Promise.reject(new Error('corrompue')) } })
    const { loadTerminalSymbols, terminalSymbolsSettled } = await import('./appearance')
    await expect(loadTerminalSymbols()).resolves.toBeUndefined()
    expect(terminalSymbolsSettled()).toBe(true)
  })

  it('chargement qui traîne : rend la main au bout du délai', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { fonts: { load: () => new Promise(() => undefined) } })
    const { loadTerminalSymbols, terminalSymbolsSettled } = await import('./appearance')
    const done = loadTerminalSymbols(100)
    await vi.advanceTimersByTimeAsync(100)
    await expect(done).resolves.toBeUndefined()
    expect(terminalSymbolsSettled()).toBe(true)
  })
})
