import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstallChoice, InstallOffer, InstallScope } from '@shared/install'
import { InstallDialog } from './InstallDialog'

function withApi(offer: InstallOffer | null, install: (scope: InstallScope) => Promise<undefined>) {
  const api = {
    installOffer: vi.fn(async () => offer),
    install: vi.fn(install),
    dismissInstall: vi.fn(async () => undefined)
  }
  Object.assign(window, { api: { app: api } })
  return api
}

afterEach(() => {
  delete (window as { api?: unknown }).api
})

const EVERYONE: InstallChoice = {
  scope: 'everyone',
  target: '/Applications/Bobine.app',
  allowed: false,
  replacing: false
}
const ME: InstallChoice = {
  scope: 'me',
  target: '/Users/ada/Applications/Bobine.app',
  allowed: true,
  replacing: false
}

/** Sans droits d'administrateur, depuis le .dmg. */
const OFFER: InstallOffer = { choices: [EVERYONE, ME], suggested: 'me', fromDiskImage: true }

const radio = (scope: InstallScope) =>
  screen.getByTestId(`install-choice-${scope}`).querySelector('input') as HTMLInputElement

describe('InstallDialog (fiche 073)', () => {
  it('rien quand il n’y a rien à proposer', async () => {
    withApi(null, async () => undefined)
    render(<InstallDialog />)
    await act(async () => {})
    expect(screen.queryByTestId('install-dialog')).toBeNull()
  })

  it('sans droits d’administrateur : « pour moi » coché, « pour tous » grisé et expliqué', async () => {
    const api = withApi(OFFER, () => new Promise(() => {}))
    render(<InstallDialog />)
    const dialog = await screen.findByTestId('install-dialog')
    expect(dialog.textContent).toContain('disque image sera éjecté')
    expect(radio('me').checked).toBe(true)
    expect(radio('everyone').disabled).toBe(true)
    expect(screen.getByTestId('install-choice-everyone').textContent).toContain(
      'Demande les droits d’administrateur'
    )
    expect(screen.getByTestId('install-choice-me').textContent).toContain('/Users/ada/Applications')
    fireEvent.click(screen.getByTestId('install-now'))
    expect(api.install).toHaveBeenCalledWith('me')
    expect(screen.getByTestId('install-now').textContent).toBe('Installation…')
  })

  it('administrateur : les deux choix ; la version déjà installée est signalée', async () => {
    const api = withApi(
      {
        ...OFFER,
        choices: [{ ...EVERYONE, allowed: true, replacing: true }, ME],
        suggested: 'everyone'
      },
      () => new Promise(() => {})
    )
    render(<InstallDialog />)
    await screen.findByTestId('install-dialog')
    expect(radio('everyone').checked).toBe(true)
    expect(screen.getByTestId('install-choice-everyone').textContent).toContain(
      'ira à la corbeille'
    )
    fireEvent.click(radio('me'))
    fireEvent.click(screen.getByTestId('install-now'))
    expect(api.install).toHaveBeenCalledWith('me')
  })

  it('échec dit en clair ; « Ne plus proposer » retient le refus', async () => {
    const api = withApi(OFFER, async () => {
      throw new Error("Error invoking remote method 'app:install': Error: Copie impossible")
    })
    render(<InstallDialog />)
    fireEvent.click(await screen.findByTestId('install-now'))
    expect((await screen.findByTestId('install-error')).textContent).toBe('Copie impossible')
    fireEvent.click(screen.getByTestId('install-never'))
    expect(api.dismissInstall).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('install-dialog')).toBeNull()
  })

  it('« Plus tard » ferme sans rien retenir', async () => {
    const api = withApi(OFFER, async () => undefined)
    render(<InstallDialog />)
    fireEvent.click(await screen.findByTestId('install-later'))
    expect(screen.queryByTestId('install-dialog')).toBeNull()
    expect(api.dismissInstall).not.toHaveBeenCalled()
  })
})
