import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { UpdateView } from '@shared/update-check'
import { UpdateLine } from './UpdateLine'
import { UpdateCheckCard } from '../settings/UpdateCheckCard'

/** La ligne, dans le fournisseur d'infobulles de l'app. */
const Line = () => (
  <Tooltip.Provider>
    <UpdateLine />
  </Tooltip.Provider>
)

const base: UpdateView = {
  current: '1.0.0',
  enabled: true,
  lastCheckedAt: null,
  checking: false,
  available: null,
  dismissed: false,
  manual: null
}
const available = {
  version: '1.0.1',
  prerelease: false,
  url: 'https://github.com/jlallement/bobine/releases/tag/v1.0.1'
}

describe('avis de nouvelle version (fiche 274)', () => {
  let api: Window['api']['app']
  let push: (view: UpdateView) => void = () => {}
  let first: UpdateView = base
  const calls = { open: vi.fn(), dismiss: vi.fn(), check: vi.fn() }
  beforeEach(() => {
    api = window.api.app
    window.api.app = {
      update: async () => first,
      onUpdate: (listener: (view: UpdateView) => void) => {
        push = listener
        return () => {}
      },
      openUpdate: async (version: string) => calls.open(version),
      dismissUpdate: async (version: string) => calls.dismiss(version),
      checkUpdate: async () => calls.check()
    } as unknown as Window['api']['app']
  })
  afterEach(() => {
    window.api.app = api
    first = base
    vi.clearAllMocks()
  })

  it('barre latérale : « Voir » et ✕ passent le numéro, jamais une adresse', async () => {
    first = { ...base, available }
    render(<Line />)
    const line = await screen.findByTestId('update-line')
    expect(line.textContent).toContain('Bobine 1.0.1 est disponible')
    // Nom accessible avec la version (recette rc.4) : « Voir » seul ne dit pas quoi.
    fireEvent.click(
      screen.getByRole('button', { name: t('updates.line.viewLabel', { version: '1.0.1' }) })
    )
    expect(calls.open).toHaveBeenCalledWith('1.0.1')
    fireEvent.click(
      screen.getByRole('button', { name: t('updates.line.later', { version: '1.0.1' }) })
    )
    expect(calls.dismiss).toHaveBeenCalledWith('1.0.1')
  })

  it('✕ et « Voir » : le focus va à la zone de saisie, pas sur la page (recette rc.4)', async () => {
    const composer = document.createElement('textarea')
    composer.dataset.testid = 'composer-input'
    document.body.append(composer)
    first = { ...base, available }
    render(<Line />)
    for (const id of ['update-line-later', 'update-line-open']) {
      const button = await screen.findByTestId(id)
      button.focus()
      fireEvent.click(button)
      expect(document.activeElement).toBe(composer)
    }
    composer.remove()
  })

  it('préversion : « Préversion disponible » sous le numéro', async () => {
    first = {
      ...base,
      current: '1.0.0-rc.3',
      available: { ...available, version: '1.0.0-rc.4', prerelease: true }
    }
    render(<Line />)
    const line = await screen.findByTestId('update-line')
    expect(line.textContent).toContain('Bobine 1.0.0-rc.4')
    expect(line.textContent).toContain(t('updates.line.preAvailable'))
  })

  it('rien si l’avis est fermé, la vérification coupée, ou rien de nouveau', async () => {
    first = { ...base, available }
    render(<Line />)
    await screen.findByTestId('update-line')
    act(() => push({ ...base, available, dismissed: true }))
    expect(screen.queryByTestId('update-line')).toBeNull()
    act(() => push({ ...base, available, enabled: false }))
    expect(screen.queryByTestId('update-line')).toBeNull()
    act(() => push(base))
    expect(screen.queryByTestId('update-line')).toBeNull()
  })

  it('un numéro piégé reste du texte', async () => {
    first = { ...base, available: { ...available, version: '<img src=x onerror=alert(1)>' } }
    const { container } = render(<Line />)
    await screen.findByTestId('update-line')
    expect(container.querySelector('img')).toBeNull()
  })

  it('Réglages : version déjà connue, « Vérifier maintenant » qui échoue le dit, la version reste (recette rc.4)', async () => {
    first = { ...base, available }
    render(<UpdateCheckCard enabled onEnabled={() => {}} />)
    await screen.findByTestId('settings-update-available')
    act(() => push({ ...base, available, manual: { result: 'failed', failure: 'offline' } }))
    expect(screen.getByTestId('settings-update-available').textContent).toContain('1.0.1')
    expect(screen.getByTestId('settings-update-failed').textContent).toBe(
      t('updates.settings.failed.offline')
    )
    // Pendant une nouvelle vérification, l'ancien échec s'efface ; la version reste.
    act(() =>
      push({ ...base, available, checking: true, manual: { result: 'failed', failure: 'offline' } })
    )
    expect(screen.queryByTestId('settings-update-failed')).toBeNull()
    expect(screen.getByTestId('settings-update-available')).toBeTruthy()
  })

  it('Réglages : jamais vérifié, à jour, nouvelle version, échec, en cours', async () => {
    const onEnabled = vi.fn()
    render(<UpdateCheckCard enabled onEnabled={onEnabled} />)
    const card = await screen.findByTestId('settings-update')
    expect(card.textContent).toContain(t('updates.settings.never'))
    fireEvent.click(screen.getByTestId('settings-update-check'))
    expect(onEnabled).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByTestId('settings-update-now'))
    expect(calls.check).toHaveBeenCalled()

    act(() =>
      push({ ...base, lastCheckedAt: new Date().toISOString(), manual: { result: 'up-to-date' } })
    )
    expect(screen.getByTestId('settings-update-current').textContent).toContain('1.0.0')
    expect(card.textContent).toContain(t('updates.settings.todayAt', { time: '' }).trim())

    act(() => push({ ...base, available, manual: { result: 'up-to-date' } }))
    expect(screen.queryByTestId('settings-update-current')).toBeNull()
    fireEvent.click(screen.getByTestId('settings-update-open'))
    expect(calls.open).toHaveBeenCalledWith('1.0.1')

    act(() => push({ ...base, manual: { result: 'failed', failure: 'limit' } }))
    expect(screen.getByTestId('settings-update-failed').textContent).toBe(
      t('updates.settings.failed.limit')
    )

    act(() => push({ ...base, checking: true, manual: { result: 'failed', failure: 'limit' } }))
    expect(screen.queryByTestId('settings-update-failed')).toBeNull()
    expect((screen.getByTestId('settings-update-now') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('settings-update-now').textContent).toBe(
      t('updates.settings.checking')
    )
  })
})
