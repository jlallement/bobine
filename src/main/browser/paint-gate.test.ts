/**
 * Entrées de l'agent retenues jusqu'à la première peinture du document (fiche 250) : sinon
 * Chromium les jette sans le dire. Le vrai Chromium reste dans l'e2e `browser`.
 */
import { describe, expect, it, vi } from 'vitest'
import { notPaintedMessage, PaintGate } from './paint-gate'

function gate(results: boolean[], reveal?: () => (() => void) | undefined) {
  const probe = vi.fn(async () => results.shift() ?? true)
  return { gate: new PaintGate({ probe, timeoutMs: 1000, ...(reveal ? { reveal } : {}) }), probe }
}

describe('entrées de l’agent et première peinture (fiche 250)', () => {
  it('page peinte : l’entrée passe, une seule attente par document', async () => {
    const { gate: g, probe } = gate([true])
    await g.beforeInput()
    await g.beforeInput()
    expect(probe).toHaveBeenCalledTimes(1)
    expect(probe).toHaveBeenCalledWith(1000)
  })

  it('nouvelle page après une navigation : on attend à nouveau sa peinture', async () => {
    const { gate: g, probe } = gate([true, true])
    await g.beforeInput()
    g.navigated()
    await g.beforeInput()
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('pas de peinture dans la borne : erreur claire, rien d’envoyé ; l’essai suivant passe', async () => {
    const { gate: g, probe } = gate([false])
    await expect(g.beforeInput()).rejects.toThrow(notPaintedMessage(1000))
    await expect(g.beforeInput()).resolves.toBeUndefined()
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('onglet caché : peint le temps de l’attente, remis comme avant même en échec', async () => {
    const restore = vi.fn()
    const reveal = vi.fn(() => restore)
    const { gate: g } = gate([false], reveal)
    await expect(g.beforeInput()).rejects.toThrow('not been rendered')
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('entrées simultanées : une seule attente', async () => {
    const { gate: g, probe } = gate([true])
    await Promise.all([g.beforeInput(), g.beforeInput(), g.beforeInput()])
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('navigation pendant l’attente : c’est la nouvelle page qu’on attend', async () => {
    let release: (painted: boolean) => void = () => {}
    const probe = vi
      .fn<(ms: number) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockResolvedValue(true)
    const g = new PaintGate({ probe })
    const input = g.beforeInput()
    await Promise.resolve()
    g.navigated()
    release(true)
    await input
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('sonde en échec (page fermée…) : l’erreur remonte, l’essai suivant sonde à nouveau', async () => {
    const probe = vi
      .fn<(ms: number) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error('Object has been destroyed'))
      .mockResolvedValue(true)
    const g = new PaintGate({ probe })
    await expect(g.beforeInput()).rejects.toThrow('destroyed')
    await g.beforeInput()
    expect(probe).toHaveBeenCalledTimes(2)
  })
})
