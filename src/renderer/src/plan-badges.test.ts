import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
import { planActionsFor } from './plan-badges'

const snapshot = {
  status: 'ready',
  controls: [
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: 'plan',
      options: [
        { value: 'build', name: 'Build' },
        { value: 'plan', name: 'Plan' }
      ]
    }
  ]
} as unknown as AgentSnapshot

const original = window.api.agent
afterEach(() => {
  window.api.agent = original
})

describe('« Exécuter le plan » (revue de la fiche 272)', () => {
  it('deux clics rapprochés pendant le changement de mode : un seul envoi', async () => {
    let release = () => {}
    const switched = new Promise<void>((resolve) => (release = resolve))
    window.api.agent = { setControl: vi.fn(() => switched) } as unknown as Window['api']['agent']
    const send = vi.fn(() => Promise.resolve())
    const actions = planActionsFor('c1', snapshot, [], send)
    actions?.onExecute()
    actions?.onExecute()
    release()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('Exécute ce plan.')
    // L'envoi fini (ou échoué), une exécution reste possible.
    actions?.onExecute()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
  })
})
