import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NetworkSettings, NetworkView } from '@shared/providers'
import { onSettingsRequest, requestNetworkSettings } from '../../open-settings'
import { NetworkSection } from './NetworkSettings'

/**
 * Réglages › Agents › Avancé › Réseau d'entreprise (fiches 104, 136, 275) : remplace les
 * vérifications de composant des e2e `providers` (n° 8, 13) et `pannes-visibles` (n° 2). Le
 * nettoyage de la saisie côté main est dans `network-env.test.ts`.
 */

const api = window.api
let view: NetworkView
let setNetwork: ReturnType<typeof vi.fn>

beforeEach(() => {
  view = { settings: {}, fromShell: { noProxy: 'localhost' } }
  // Le main nettoie la saisie (espaces, vides omis) et rend la vue relue.
  setNetwork = vi.fn(async (next: NetworkSettings) => {
    const settings = Object.fromEntries(
      Object.entries(next).filter(([, value]) => typeof value === 'string' && value.trim())
    ) as NetworkSettings
    view = { ...view, settings }
    return view
  })
  Object.assign(window, {
    api: { ...api, settings: { network: async () => view, setNetwork } }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

const advanced = () => screen.getByTestId('settings-agents-advanced') as HTMLDetailsElement
/** Texte du résumé, espaces insécables de la typographie française ramenées à des espaces. */
const summary = () =>
  (advanced().querySelector('summary')?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')
const proxy = () => screen.getByTestId('network-proxy') as HTMLInputElement

const show = async () => {
  render(<NetworkSection />)
  await waitFor(() => expect(proxy().disabled).toBe(false))
}

describe('réseau d’entreprise (fiches 104, 136)', () => {
  it('fermé, « Avancé » dit qu’il n’y a rien ; la valeur du shell est en indication', async () => {
    await show()
    expect(advanced().open).toBe(false)
    expect(summary()).toContain('réseau d’entreprise : rien de défini')
    expect((screen.getByTestId('network-noProxy') as HTMLInputElement).placeholder).toBe(
      'localhost (shell)'
    )
  })

  it('proxy enregistré sur Entrée : « Avancé » fermé résume ce qui est défini', async () => {
    await show()
    fireEvent.change(proxy(), { target: { value: 'http://proxy.test:3128' } })
    fireEvent.keyDown(proxy(), { key: 'Enter' })
    await waitFor(() => expect(summary()).toContain('réseau d’entreprise : proxy'))
    expect(setNetwork).toHaveBeenCalledWith({ proxy: 'http://proxy.test:3128' })
    expect(screen.getByTestId('network-note').textContent).toContain('Enregistré')
    fireEvent.change(screen.getByTestId('network-caCerts'), { target: { value: '/etc/ca.pem' } })
    fireEvent.blur(screen.getByTestId('network-caCerts'))
    await waitFor(() => expect(summary()).toContain('réseau d’entreprise : proxy, certificats'))
  })

  it('proxy effacé par une saisie blanche : champ vidé, résumé revenu à « rien de défini »', async () => {
    view = { settings: { proxy: 'http://proxy.test:3128' }, fromShell: {} }
    await show()
    expect(summary()).toContain('réseau d’entreprise : proxy')
    fireEvent.change(proxy(), { target: { value: '   ' } })
    fireEvent.blur(proxy())
    await waitFor(() => expect(summary()).toContain('rien de défini'))
    expect(setNetwork).toHaveBeenCalledWith({ proxy: undefined })
    expect(proxy().value).toBe('')
  })

  it('refus du main : la cause seule, en alerte', async () => {
    setNetwork.mockRejectedValueOnce(
      new Error("Error invoking remote method 'settings:setNetwork': Error: Adresse invalide.")
    )
    await show()
    fireEvent.change(proxy(), { target: { value: 'pas une adresse' } })
    fireEvent.blur(proxy())
    const note = await screen.findByRole('alert')
    expect(note.textContent).toBe('Adresse invalide.')
  })

  it('« Réglages réseau » d’un bandeau : Agents demandé, « Avancé » déplié, focus sur le proxy', async () => {
    const opened: string[] = []
    const off = onSettingsRequest((section) => opened.push(String(section)))
    // Demandé avant que les Réglages s'affichent : le réseau se montre à leur arrivée.
    act(() => requestNetworkSettings())
    expect(opened).toEqual(['agents'])
    await show()
    await waitFor(() => expect(document.activeElement).toBe(proxy()))
    expect(advanced().open).toBe(true)
    off()
  })
})
