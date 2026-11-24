/**
 * Réglages › Confidentialité (fiches 072, 136, 269) : certificats acceptés dans le navigateur
 * intégré, cookies gardés, « Effacer » les données du navigateur. L'effet dans Chromium (partition
 * vidée, exception oubliée) reste dans le main et les e2e `certificats` et `reglages`.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { t } from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import type { ApprovalsView } from '@shared/approvals'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import { PrivacySettings } from './PrivacySettings'

const FP_NEW = `${'AB:'.repeat(31)}AB`
const FP_OLD = `${'CD:'.repeat(31)}CD`
const ERR = 'net::ERR_CERT_AUTHORITY_INVALID'

const view = (
  approvals: Partial<ApprovalsView> = {},
  preferences: Partial<Preferences> = {}
): AgentSettingsView =>
  ({
    rememberedTools: [],
    approvals: { sites: [], commands: [], worktreeSetups: [], ...approvals },
    preferences: { ...DEFAULT_PREFERENCES, ...preferences }
  }) as unknown as AgentSettingsView

const clearData = vi.fn()
beforeEach(() => {
  clearData.mockReset()
  window.api.browser = { clearData } as unknown as Window['api']['browser']
})

function renderPrivacy(
  settings: AgentSettingsView,
  handlers: { onPreferences?: () => void; onForgetApproval?: () => void } = {}
) {
  return render(
    <Tooltip.Provider>
      <PrivacySettings
        settings={settings}
        onPreferences={handlers.onPreferences ?? (() => {})}
        onForgetTool={() => {}}
        onForgetApproval={handlers.onForgetApproval ?? (() => {})}
      />
    </Tooltip.Provider>
  )
}

describe('certificats acceptés (fiche 269)', () => {
  it('dans l’ordre du main (« toujours » d’abord), « (ancien) », empreinte en infobulle ; révoquer après confirmation', () => {
    const onForgetApproval = vi.fn()
    renderPrivacy(
      view({
        certificates: [
          { host: 'localhost', port: 5173, fingerprint: FP_NEW, error: ERR, remembered: true },
          {
            host: 'localhost',
            port: 5173,
            fingerprint: FP_OLD,
            error: ERR,
            remembered: false,
            stale: true
          },
          { host: '192.168.1.20', port: 443, fingerprint: FP_NEW, error: ERR, remembered: false }
        ]
      }),
      { onForgetApproval }
    )
    const group = screen.getByTestId('settings-accepted-certificates')
    expect(group.textContent).toBe(t('settings.privacy.certificates.label'))
    const rows = screen
      .getAllByTestId('forget-certificate')
      .map((button) => button.closest('li') as HTMLElement)
    expect(rows).toHaveLength(3)
    const side = (row: HTMLElement) => row.querySelector('.settings-list-side') as HTMLElement
    expect(rows.map((row) => row.querySelector('.settings-list-main')?.textContent)).toEqual([
      'localhost:5173',
      'localhost:5173',
      // Port 443 : le site sans port.
      '192.168.1.20'
    ])
    expect(side(rows[0] as HTMLElement).textContent).toBe(
      t('settings.privacy.certificates.remembered')
    )
    expect(side(rows[1] as HTMLElement).textContent).toBe(
      `${t('settings.privacy.certificates.session')} ${t('settings.privacy.certificates.stale')}`
    )
    expect(side(rows[0] as HTMLElement).getAttribute('title')).toBe(`SHA-256 ${FP_NEW}`)
    expect(side(rows[1] as HTMLElement).getAttribute('title')).toBe(`SHA-256 ${FP_OLD}`)

    // Révoquer l'ancien : rien avant la confirmation, puis l'exception exacte.
    fireEvent.click(within(rows[1] as HTMLElement).getByTestId('forget-certificate'))
    expect(onForgetApproval).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    expect(onForgetApproval).toHaveBeenCalledWith({
      certificate: { host: 'localhost', port: 5173, fingerprint: FP_OLD, error: ERR }
    })
  })

  it('aucun certificat : pas de groupe', () => {
    renderPrivacy(view({ sites: ['exemple.com'] }))
    expect(screen.queryByTestId('settings-accepted-certificates')).toBeNull()
  })
})

describe('données du navigateur intégré (fiches 072, 136)', () => {
  it('cookies gardés par défaut ; décocher part dans les préférences', () => {
    const onPreferences = vi.fn()
    renderPrivacy(view(), { onPreferences })
    const box = screen.getByTestId('settings-browser-keep-cookies') as HTMLInputElement
    expect(DEFAULT_PREFERENCES.browserKeepCookies).toBe(true)
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(onPreferences).toHaveBeenCalledWith({ browserKeepCookies: false })
  })

  it('« Effacer » : bouton occupé pendant l’effacement, puis la note ; une erreur est dite', async () => {
    let done: () => void = () => {}
    clearData.mockReturnValueOnce(new Promise<void>((resolve) => (done = resolve)))
    renderPrivacy(view())
    const button = screen.getByTestId('settings-clear-browser-data') as HTMLButtonElement
    fireEvent.click(button)
    expect(clearData).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe(t('settings.privacy.browserData.clearing'))
    await act(async () => done())
    expect(button.disabled).toBe(false)
    expect(screen.getByTestId('settings-clear-browser-data-note').textContent).toBe(
      t('settings.privacy.browserData.cleared')
    )

    clearData.mockRejectedValueOnce(new Error('partition occupée'))
    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByTestId('settings-clear-browser-data-note').textContent).toContain(
      'partition occupée'
    )
  })
})
