import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelProvider, ProvidersView, ProviderTestResult } from '@shared/providers'
import { ProvidersSection } from './ProvidersSettings'
import { NetworkSection } from './NetworkSettings'

const view = (providers: ProvidersView['providers'], only = false): ProvidersView => ({
  profileId: 'opencode',
  label: 'OpenCode',
  file: '~/.config/opencode/opencode.json',
  providers,
  only
})

const llmaas: ProvidersView['providers'][number] = {
  id: 'llmaas',
  name: 'LLMaaS interne',
  baseURL: 'https://llm.interne.test/v1',
  models: [
    { id: 'qwen3-32b', name: 'Qwen 3 32B' },
    { id: 'mistral-small', name: 'mistral-small' }
  ],
  enabled: true,
  key: { kind: 'env', env: 'LLMAAS_API_KEY' },
  keyStored: false,
  keyFromEnvironment: false
}

const original = window.api
let views: ProvidersView[]
/** La vue de l'agent factice des essais (toujours là). */
const current = (): ProvidersView => views[0] ?? view([])
const api = {
  list: vi.fn(async () => views),
  save: vi.fn(async (_p: string, provider: ModelProvider, previousId?: string) => {
    views = [
      view([
        ...current().providers.filter((p) => p.id !== (previousId ?? provider.id)),
        { ...llmaas, ...provider, key: { kind: 'env', env: 'X_API_KEY' } }
      ])
    ]
    return views
  }),
  remove: vi.fn(async () => (views = [view([])])),
  setEnabled: vi.fn(async (_p: string, id: string, enabled: boolean) => {
    views = [view(current().providers.map((p) => (p.id === id ? { ...p, enabled } : p)))]
    return views
  }),
  setOnly: vi.fn(async (_p: string, only: boolean) => (views = [view(current().providers, only)])),
  setKey: vi.fn(async () => {
    views = [view(current().providers.map((p) => ({ ...p, keyStored: true })))]
    return views
  }),
  removeKey: vi.fn(async () => views),
  test: vi.fn<() => Promise<ProviderTestResult>>(async () => ({ ok: true, models: 2, ms: 320 })),
  diagnose: vi.fn()
}
const network = {
  network: vi.fn(async () => ({
    settings: { proxy: 'http://saisi:1' },
    fromShell: { caCerts: '/shell/ca.pem' }
  })),
  setNetwork: vi.fn(async (change: Record<string, string | undefined>) => ({
    settings: change,
    fromShell: { caCerts: '/shell/ca.pem' }
  }))
}

beforeEach(() => {
  views = [view([llmaas])]
  vi.clearAllMocks()
  window.api = { ...original, providers: api, settings: network } as unknown as Window['api']
})
afterEach(() => {
  window.api = original
})

const renderProviders = async () => {
  render(<ProvidersSection installed={['opencode']} />)
  await act(async () => {})
}

describe('Réglages › Agents › Fournisseurs de modèles (fiche 104)', () => {
  it('liste : nom, identifiant, adresse, modèles, clé ; rien sans agent qui en déclare', async () => {
    await renderProviders()
    const row = screen.getByTestId('provider')
    expect(row.textContent).toContain('LLMaaS interne')
    expect(row.textContent).toContain('llmaas')
    expect(row.textContent).toContain('https://llm.interne.test/v1')
    expect(row.textContent).toContain('2 modèles')
    expect(screen.getByTestId('provider-key-state').textContent).toBe('aucune (LLMAAS_API_KEY)')
    expect(screen.getByText(/opencode\.json/)).toBeTruthy()
    views = []
    const { container } = render(<ProvidersSection installed={['opencode']} />)
    await act(async () => {})
    expect(container.querySelector('h3')).toBeNull()
  })

  it('« Tester » : répond avec N modèles ; erreur avec la marche à suivre', async () => {
    await renderProviders()
    fireEvent.click(screen.getByTestId('provider-test'))
    await act(async () => {})
    expect(api.test).toHaveBeenCalledWith('opencode', 'llmaas')
    const line = screen.getByTestId('provider-test-result')
    expect(line.dataset['state']).toBe('ok')
    expect(line.textContent).toContain('Répond · 2 modèles')
    expect(screen.getByTestId('provider-dot').dataset['state']).toBe('ok')
    api.test.mockResolvedValueOnce({
      ok: false,
      cause: 'certificate',
      error: 'Certificat non reconnu : self signed',
      ms: 10
    })
    fireEvent.click(screen.getByTestId('provider-test'))
    await act(async () => {})
    const failed = screen.getByTestId('provider-test-result')
    expect(failed.dataset['cause']).toBe('certificate')
    expect(failed.textContent).toContain('self signed')
    expect(failed.textContent).toContain('fichier des certificats')
  })

  it('clé : définie depuis la ligne (jamais affichée), puis « enregistrée »', async () => {
    await renderProviders()
    fireEvent.click(screen.getByTestId('provider-key'))
    fireEvent.change(screen.getByTestId('provider-key-value'), { target: { value: 'sk-secret' } })
    fireEvent.submit(screen.getByTestId('provider-key-form'))
    await act(async () => {})
    expect(api.setKey).toHaveBeenCalledWith('opencode', 'llmaas', 'sk-secret')
    expect(screen.queryByTestId('provider-key-form')).toBeNull()
    expect(screen.getByTestId('provider-key-state').textContent).toBe('enregistrée')
    expect(document.body.textContent).not.toContain('sk-secret')
  })

  it('activation, « seulement ces fournisseurs », suppression confirmée dans la ligne (fiche 126)', async () => {
    await renderProviders()
    fireEvent.click(screen.getByTestId('provider-enabled'))
    await act(async () => {})
    expect(api.setEnabled).toHaveBeenCalledWith('opencode', 'llmaas', false)
    expect(screen.getByTestId('provider-dot').dataset['state']).toBe('off')
    fireEvent.click(screen.getByTestId('providers-only'))
    await act(async () => {})
    expect(api.setOnly).toHaveBeenCalledWith('opencode', true)
    expect((screen.getByTestId('providers-only') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByTestId('provider-remove'))
    // Un second clic au même endroit ne supprime rien : la confirmation est dans la ligne.
    fireEvent.click(screen.getByTestId('provider-remove'))
    expect(screen.queryByTestId('confirm-row')).toBeNull()
    fireEvent.click(screen.getByTestId('provider-remove'))
    const ask = screen.getByTestId('confirm-row')
    expect(ask.textContent).toContain('Supprimer le fournisseur')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('confirm-row-keep')
    expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-row-keep'))
    expect(screen.queryByTestId('confirm-row')).toBeNull()
    fireEvent.click(screen.getByTestId('provider-remove'))
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    await act(async () => {})
    expect(api.remove).toHaveBeenCalledWith('opencode', 'llmaas')
    expect(screen.getByTestId('providers-none')).toBeTruthy()
  })

  it('formulaire : ajout avec les modèles « id = libellé », erreur du main affichée', async () => {
    await renderProviders()
    fireEvent.click(screen.getByTestId('providers-add'))
    fireEvent.change(screen.getByTestId('provider-id'), { target: { value: 'interne' } })
    fireEvent.change(screen.getByTestId('provider-url'), {
      target: { value: 'https://llm.test/v1' }
    })
    fireEvent.change(screen.getByTestId('provider-models'), {
      target: { value: 'qwen = Qwen 3\nmistral\n' }
    })
    api.save.mockRejectedValueOnce(new Error('Un fournisseur « interne » existe déjà.'))
    fireEvent.submit(screen.getByTestId('provider-form'))
    await act(async () => {})
    expect(screen.getByTestId('providers-error').textContent).toContain('existe déjà')
    expect(screen.getByTestId('provider-form')).toBeTruthy()
    fireEvent.submit(screen.getByTestId('provider-form'))
    await act(async () => {})
    expect(api.save).toHaveBeenLastCalledWith(
      'opencode',
      {
        id: 'interne',
        name: 'interne',
        baseURL: 'https://llm.test/v1',
        models: [
          { id: 'qwen', name: 'Qwen 3' },
          { id: 'mistral', name: 'mistral' }
        ],
        enabled: true
      },
      undefined
    )
    expect(screen.queryByTestId('provider-form')).toBeNull()
    expect(screen.getAllByTestId('provider')).toHaveLength(2)
    // Modifier : le formulaire repart des valeurs du fournisseur, modèles en lignes.
    fireEvent.click(screen.getAllByTestId('provider-edit')[0] as HTMLElement)
    expect((screen.getByTestId('provider-models') as HTMLTextAreaElement).value).toBe(
      'qwen3-32b = Qwen 3 32B\nmistral-small'
    )
  })
})

describe('Réglages › Agents › Réseau d’entreprise (fiche 104)', () => {
  it('valeurs saisies, celles du shell en indication ; enregistré au blur', async () => {
    render(<NetworkSection />)
    await act(async () => {})
    const proxy = screen.getByTestId('network-proxy') as HTMLInputElement
    const certs = screen.getByTestId('network-caCerts') as HTMLInputElement
    expect(proxy.value).toBe('http://saisi:1')
    expect(certs.value).toBe('')
    expect(certs.placeholder).toBe('/shell/ca.pem (shell)')
    fireEvent.change(certs, { target: { value: ' ~/ca.pem ' } })
    fireEvent.blur(certs)
    await act(async () => {})
    expect(network.setNetwork).toHaveBeenCalledWith({
      proxy: 'http://saisi:1',
      caCerts: '~/ca.pem'
    })
    expect(screen.getByTestId('network-note').textContent).toContain('Enregistré')
    // Sans changement : rien n'est envoyé.
    fireEvent.blur(proxy)
    await act(async () => {})
    expect(network.setNetwork).toHaveBeenCalledTimes(1)
  })
})
