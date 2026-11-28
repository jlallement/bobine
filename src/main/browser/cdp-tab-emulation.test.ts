/**
 * `CdpTab.emulate` (fiche 295) : la taille est notée dès que Chromium l'a prise. Si le tactile
 * échoue ensuite, l'état dit la taille vraiment posée (celle des clics × `scale`), pas l'ancienne ;
 * si la taille est refusée, rien n'est noté.
 */
import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'

vi.mock('electron', () => ({ nativeImage: {} }))

const { CdpTab } = await import('./cdp-tab')

function contents(refuse: string[]) {
  const commands: string[] = []
  const fake = {
    on: vi.fn(),
    loadURL: vi.fn(async () => {}),
    debugger: {
      isAttached: () => true,
      attach: () => {},
      on: vi.fn(),
      sendCommand: vi.fn(async (method: string) => {
        commands.push(method)
        if (refuse.includes(method)) throw new Error(`refused: ${method}`)
        return {}
      })
    }
  }
  return { contents: fake as unknown as WebContents, commands }
}

const IPHONE = { width: 390, height: 844, mobile: true, scale: 0.8 }

describe('taille posée par le CDP (fiche 295)', () => {
  it('tactile refusé après la taille : la taille posée est notée', async () => {
    const { contents: page } = contents(['Emulation.setTouchEmulationEnabled'])
    const tab = new CdpTab(page)
    await expect(tab.emulate(IPHONE)).rejects.toThrow('refused')
    expect(tab.emulation).toEqual(IPHONE)
  })

  it('taille refusée : rien de noté, le tactile n’est pas demandé', async () => {
    const { contents: page, commands } = contents(['Emulation.setDeviceMetricsOverride'])
    const tab = new CdpTab(page)
    await expect(tab.emulate(IPHONE)).rejects.toThrow('refused')
    expect(tab.emulation).toBeUndefined()
    expect(commands).not.toContain('Emulation.setTouchEmulationEnabled')
  })

  it('retour à la largeur du panneau : noté dès l’effacement, même si le tactile échoue', async () => {
    const { contents: page } = contents(['Emulation.setTouchEmulationEnabled'])
    const tab = new CdpTab(page)
    tab.emulation = IPHONE
    await expect(tab.emulate(undefined)).rejects.toThrow('refused')
    expect(tab.emulation).toBeUndefined()
  })

  it('effacement refusé : la taille reste notée', async () => {
    const { contents: page } = contents(['Emulation.clearDeviceMetricsOverride'])
    const tab = new CdpTab(page)
    tab.emulation = IPHONE
    await expect(tab.emulate(undefined)).rejects.toThrow('refused')
    expect(tab.emulation).toEqual(IPHONE)
  })
})
