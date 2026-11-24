import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { PrivacySettings } from './PrivacySettings'

/**
 * Réglages › Confidentialité (fiches 042, 072, 136, 269) : remplace les vérifications de composant
 * des e2e `settings` (n° 15, 16 : la note), `certificats` (n° 16) et `terminal` (n° 10, 11). Les
 * autorisations retenues, leur tri et leur relecture au lancement sont dans `approvals.test.ts`
 * (main) ; l'effacement réel de la partition, dans `settings-effects.test.ts` et l'IPC du navigateur.
 */

const view = (over: Partial<AgentSettingsView['approvals']> = {}): AgentSettingsView =>
  ({
    preferences: DEFAULT_PREFERENCES,
    rememberedTools: [],
    approvals: { sites: [], commands: [], worktreeSetups: [], ...over }
  }) as unknown as AgentSettingsView

/** Texte affiché, insécables de la typographie française ramenées à des espaces. */
const plain = (el: HTMLElement) => (el.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')

const api = window.api
let clearData: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearData = vi.fn(async () => undefined)
  Object.assign(window, { api: { ...api, browser: { clearData } } })
})
afterEach(() => {
  Object.assign(window, { api })
})

const show = (settings = view(), props: Partial<Parameters<typeof PrivacySettings>[0]> = {}) =>
  render(
    <PrivacySettings
      settings={settings}
      onPreferences={vi.fn()}
      onForgetTool={vi.fn()}
      onForgetApproval={vi.fn()}
      {...props}
    />
  )

describe('Réglages › Confidentialité : navigateur intégré (fiche 072)', () => {
  it('« Garder les connexions » coché par défaut ; décoché, la préférence part', () => {
    const onPreferences = vi.fn()
    show(view(), { onPreferences })
    const keep = screen.getByTestId('settings-browser-keep-cookies') as HTMLInputElement
    expect(keep.checked).toBe(true)
    fireEvent.click(keep)
    expect(onPreferences).toHaveBeenCalledWith({ browserKeepCookies: false })
  })

  it('« Effacer » vide les données du navigateur par le main, et le dit', async () => {
    show()
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-clear-browser-data'))
    })
    expect(clearData).toHaveBeenCalledTimes(1)
    expect(plain(screen.getByTestId('settings-clear-browser-data-note'))).toBe(
      'Données effacées : il faudra se reconnecter aux sites.'
    )
  })

  it('effacement refusé : la cause seule, le bouton revient', async () => {
    clearData.mockRejectedValueOnce(
      new Error("Error invoking remote method 'browser:clearData': Error: Partition occupée.")
    )
    show()
    fireEvent.click(screen.getByTestId('settings-clear-browser-data'))
    await waitFor(() =>
      expect(screen.getByTestId('settings-clear-browser-data-note').textContent).toBe(
        'Partition occupée.'
      )
    )
    expect((screen.getByTestId('settings-clear-browser-data') as HTMLButtonElement).disabled).toBe(
      false
    )
  })
})

describe('Réglages › Confidentialité : autorisé sans demander', () => {
  it('certificats : dans l’ordre du main (« toujours » d’abord), « (ancien) », empreinte en infobulle', () => {
    show(
      view({
        certificates: [
          {
            host: 'intra.test',
            port: 443,
            fingerprint: 'AA:BB',
            error: 'net::ERR_CERT_AUTHORITY_INVALID',
            remembered: true
          },
          {
            host: 'intra.test',
            port: 8443,
            fingerprint: 'CC:DD',
            error: 'net::ERR_CERT_AUTHORITY_INVALID',
            remembered: false,
            stale: true
          }
        ]
      })
    )
    const group = screen.getByTestId('settings-accepted-certificates')
    expect(group.textContent).toBe('Certificats acceptés')
    const rows = screen
      .getAllByTestId('forget-certificate')
      .map((b) => b.closest('li') as HTMLElement)
    expect(rows.map((r) => r.querySelector('.settings-list-main')?.textContent)).toEqual([
      'intra.test',
      'intra.test:8443'
    ])
    const sides = rows.map((r) => r.querySelector('.settings-list-side') as HTMLElement)
    expect(sides.map((s) => s.textContent)).toEqual(['toujours', 'jusqu’à la fermeture (ancien)'])
    expect(sides[0]?.getAttribute('title')).toBe('SHA-256 AA:BB')
  })

  it('certificat oublié : confirmation dans la ligne, puis l’exception exacte part au main', () => {
    const onForgetApproval = vi.fn()
    const certificate = {
      host: 'intra.test',
      port: 443,
      fingerprint: 'AA:BB',
      error: 'net::ERR_CERT_DATE_INVALID'
    }
    show(view({ certificates: [{ ...certificate, remembered: true }] }), { onForgetApproval })
    fireEvent.click(screen.getByTestId('forget-certificate'))
    expect(onForgetApproval).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    expect(onForgetApproval).toHaveBeenCalledWith({ certificate })
  })

  it('commande retenue listée sous son dossier, en chasse fixe', () => {
    show(view({ commands: [{ workspace: '/projets/bobine', commands: ['pnpm dev', 'make'] }] }))
    const group = screen.getByTestId('settings-approved-commands')
    expect(group.textContent).toBe('Commandes · bobine')
    const list = group.parentElement as HTMLElement
    const commands = within(list)
      .getAllByTestId('forget-command')
      .map((b) => b.closest('li')?.querySelector('.settings-list-main') as HTMLElement)
    expect(commands.map((c) => c.textContent)).toEqual(['pnpm dev', 'make'])
    expect(commands.every((c) => c.classList.contains('mono'))).toBe(true)
  })

  it('commande retenue oubliée : rien avant la confirmation, puis dossier et commande au main', () => {
    const onForgetApproval = vi.fn()
    show(view({ commands: [{ workspace: '/projets/bobine', commands: ['pnpm dev'] }] }), {
      onForgetApproval
    })
    fireEvent.click(screen.getByTestId('forget-command'))
    expect(onForgetApproval).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-row-keep'))
    expect(screen.queryByTestId('confirm-row-confirm')).toBeNull()
    fireEvent.click(screen.getByTestId('forget-command'))
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    expect(onForgetApproval).toHaveBeenCalledWith({
      workspace: '/projets/bobine',
      command: 'pnpm dev'
    })
  })

  it('rien de retenu : la liste le dit', () => {
    show()
    expect(screen.getByTestId('settings-allowed-none')).toBeTruthy()
  })
})
