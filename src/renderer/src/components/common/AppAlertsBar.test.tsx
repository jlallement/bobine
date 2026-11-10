import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import type { AppAlert } from '@shared/app-alerts'
import { AppAlertsBar } from './AppAlertsBar'

describe('avis de l’app en haut de la fenêtre (fiche 194)', () => {
  let api: Window['api']['app']
  let push: (alerts: AppAlert[]) => void = () => {}
  const calls = { dismiss: vi.fn(), report: vi.fn(), log: vi.fn() }
  beforeEach(() => {
    api = window.api.app
    window.api.app = {
      alerts: async () => [{ kind: 'crashed', report: '/profil/crash-reports/x' }],
      onAlerts: (listener: (alerts: AppAlert[]) => void) => {
        push = listener
        return () => {}
      },
      dismissAlert: async (kind: string) => calls.dismiss(kind),
      showCrashReport: async () => calls.report(),
      showLog: async () => calls.log()
    } as unknown as Window['api']['app']
  })
  afterEach(() => {
    window.api.app = api
    vi.clearAllMocks()
  })

  it('plantage précédent : rien n’a été envoyé, « Afficher le rapport », ✕', async () => {
    render(<AppAlertsBar />)
    const card = await screen.findByTestId('app-alert-crashed')
    expect(card.textContent).toContain(t('appAlert.crashed.title'))
    expect(card.textContent).toContain('rien n’a été envoyé')
    expect(card.textContent).toContain('relisez-le avant de le joindre')
    fireEvent.click(screen.getByRole('button', { name: t('appAlert.crashed.show') }))
    expect(calls.report).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: t('appAlert.close') }))
    expect(calls.dismiss).toHaveBeenCalledWith('crashed')
  })

  it('problème interne : le compte suit, détail replié, « Afficher le journal »', async () => {
    render(<AppAlertsBar />)
    await screen.findByTestId('app-alert-crashed')
    act(() => push([{ kind: 'internal-error', count: 3, detail: 'TypeError: x' }]))
    const card = screen.getByTestId('app-alert-internal-error')
    expect(card.textContent).toContain(t('appAlert.internal.title', { count: 3 }))
    expect(card.querySelector('details')?.open).toBe(false)
    expect(card.getAttribute('role')).toBe('status')
    fireEvent.click(screen.getByRole('button', { name: t('errorBoundary.showLog') }))
    expect(calls.log).toHaveBeenCalled()
    act(() => push([]))
    expect(screen.queryByTestId('app-alerts')).toBeNull()
  })
})
