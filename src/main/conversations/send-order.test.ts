import { describe, expect, it, vi } from 'vitest'
import { SendOrder } from './send-order'

/** Envoi dont la préparation attend `release` ; rend combien de fois l'arrêt l'a suivi. */
function sendThrough(order: SendOrder, prepare: () => Promise<void> = () => Promise.resolve()) {
  const host = { cancel: vi.fn(() => Promise.resolve()) }
  const sending = order.run('c', async () => {
    await prepare()
    return { done: order.follow('c', Promise.resolve(), host) }
  })
  return { host, sending }
}

describe('SendOrder : « Arrêter » pendant une préparation (fiche 278)', () => {
  it('retenu pour l’envoi en route, qui l’emporte une seule fois', async () => {
    const order = new SendOrder()
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const first = sendThrough(order, () => gate)
    order.stopPending('c')
    release()
    await first.sending
    expect(first.host.cancel).toHaveBeenCalledOnce()
    const next = sendThrough(order)
    await next.sending
    expect(next.host.cancel).not.toHaveBeenCalled()
  })

  it('sans envoi en route : rien de retenu, le message suivant part normalement', async () => {
    const order = new SendOrder()
    order.stopPending('c')
    const next = sendThrough(order)
    await next.sending
    expect(next.host.cancel).not.toHaveBeenCalled()
  })

  it('préparation en échec : l’arrêt retenu est oublié', async () => {
    const order = new SendOrder()
    const failing = order.run('c', () => Promise.reject(new Error('dossier disparu')))
    order.stopPending('c')
    await expect(failing).rejects.toThrow('dossier disparu')
    const next = sendThrough(order)
    await next.sending
    expect(next.host.cancel).not.toHaveBeenCalled()
  })
})
