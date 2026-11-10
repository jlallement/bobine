import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import type { ScheduledTask } from '@shared/schedule'
import { TipsContext } from '../../useTips'
import { ScheduledPage } from './ScheduledPage'

const profiles = [{ id: 'mock', label: 'Agent factice', available: true }] as ProfileSummary[]

const task: ScheduledTask = {
  id: 't1',
  name: 'Revue du matin',
  instruction: 'Relis les PR ouvertes',
  folder: '/Users/moi/projet',
  profileId: 'mock',
  schedule: { kind: 'daily', time: '09:00' },
  worktree: true,
  catchUp: true,
  cap: { amount: 2 },
  paused: false,
  createdAt: '2026-11-06T08:00:00.000Z',
  nextRunAt: '2026-11-07T08:00:00.000Z',
  runs: [
    {
      id: 'r1',
      at: '2026-11-06T08:00:00.000Z',
      outcome: 'done',
      conversationId: 'c1',
      cost: { amount: 1.5, currency: 'USD' }
    },
    { id: 'r0', at: '2026-11-05T08:00:00.000Z', outcome: 'skipped' }
  ]
}

const original = window.api
let api: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  api = {
    list: vi.fn(async () => [task]),
    save: vi.fn(async () => [task]),
    setPaused: vi.fn(async () => [{ ...task, paused: true }]),
    runNow: vi.fn(async () => [task]),
    remove: vi.fn(async () => []),
    onChanged: vi.fn(() => () => {})
  }
  window.api = { ...original, schedule: api } as unknown as Window['api']
})
afterEach(() => {
  window.api = original
})

describe('ScheduledPage (fiche 178)', () => {
  it('liste la tâche : fréquence, prochaine échéance, coût estimé, plafond, exécutions', async () => {
    const onOpen = vi.fn()
    render(<ScheduledPage onOpenConversation={onOpen} profiles={profiles} />)
    expect(await screen.findByText('Revue du matin')).toBeTruthy()
    expect(screen.getByText('Chaque jour à 09:00')).toBeTruthy()
    expect(screen.getByTestId('scheduled-cost').textContent).toMatch(/1,50.*\$/)
    // Unité connue d'une exécution passée : le plafond dans cette unité, pas « devise de l'agent ».
    expect(screen.getByTestId('scheduled-cost').textContent).toMatch(/Plafond\s?:\s?2,00\s?\$/)
    expect(screen.getByTestId('scheduled-cost').textContent).not.toContain('par jour')
    expect(screen.getAllByTestId('scheduled-run')).toHaveLength(2)
    expect(screen.getByTestId('scheduled-open-only').textContent).toContain('Bobine est ouverte')
    fireEvent.click(screen.getByTestId('scheduled-run-open'))
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('actions : lancer maintenant, pause, suppression confirmée', async () => {
    render(<ScheduledPage onOpenConversation={vi.fn()} profiles={profiles} />)
    await screen.findByText('Revue du matin')
    fireEvent.click(screen.getByTestId('scheduled-run-now'))
    expect(api.runNow).toHaveBeenCalledWith('t1')
    fireEvent.click(screen.getByTestId('scheduled-pause'))
    expect(api.setPaused).toHaveBeenCalledWith('t1', true)
    await waitFor(() => expect(screen.getByTestId('scheduled-next').textContent).toBe('En pause'))
    // Supprimer est dans « … », et demande confirmation.
    fireEvent.keyDown(screen.getByTestId('scheduled-more'), { key: 'Enter' })
    fireEvent.click(screen.getByTestId('scheduled-delete'))
    expect(api.remove).not.toHaveBeenCalled()
    expect(screen.getByTestId('scheduled-confirm-delete').textContent).toContain(
      'Les conversations déjà lancées restent'
    )
    fireEvent.click(screen.getByTestId('scheduled-delete-confirm'))
    expect(api.remove).toHaveBeenCalledWith('t1')
    expect(await screen.findByTestId('scheduled-empty')).toBeTruthy()
  })

  it('nouvelle tâche : enregistrée seulement quand la consigne et le dossier sont là', async () => {
    window.api = {
      ...window.api,
      workspace: { ...original.workspace, choose: vi.fn(async () => '/Users/moi/autre') }
    } as unknown as Window['api']
    render(<ScheduledPage onOpenConversation={vi.fn()} profiles={profiles} />)
    await screen.findByText('Revue du matin')
    fireEvent.click(screen.getByTestId('scheduled-new'))
    const save = screen.getByTestId('scheduled-save') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('scheduled-instruction'), {
      target: { value: 'Mets à jour les dépendances' }
    })
    fireEvent.click(screen.getByText('Choisir…'))
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.change(screen.getByTestId('scheduled-kind'), { target: { value: 'interval' } })
    // Toutes les 4 heures sans plafond : avertissement (6 exécutions par jour).
    expect(screen.getByTestId('scheduled-no-cap-warning').textContent).toContain('6 exécutions')
    fireEvent.change(screen.getByTestId('scheduled-cap-amount'), { target: { value: '0,5' } })
    expect(screen.queryByTestId('scheduled-no-cap-warning')).toBeNull()
    fireEvent.click(save)
    expect(api.save).toHaveBeenCalledWith(null, {
      name: '',
      instruction: 'Mets à jour les dépendances',
      folder: '/Users/moi/autre',
      profileId: 'mock',
      schedule: { kind: 'interval', hours: 4 },
      worktree: false,
      catchUp: true,
      cap: { amount: 0.5 }
    })
  })

  it('tâche fréquente : coût estimé par jour', async () => {
    api.list = vi.fn(async () => [{ ...task, schedule: { kind: 'interval' as const, hours: 6 } }])
    render(<ScheduledPage onOpenConversation={vi.fn()} profiles={profiles} />)
    await screen.findByText('Revue du matin')
    // 1,50 $ par exécution, quatre par jour.
    expect(screen.getByTestId('scheduled-cost').textContent).toMatch(/6,00\s?\$.*par jour/)
  })
})

describe('astuce « Planifier… » (fiche 191)', () => {
  it('ouvre une nouvelle tâche préremplie ; enregistrée, l’astuce ne reviendra plus', async () => {
    const tips = {
      current: null,
      offer: vi.fn(),
      close: vi.fn(),
      never: vi.fn(),
      used: vi.fn(),
      plan: { instruction: 'Fais le point sur les PR ouvertes', folder: '/Users/moi/projet' },
      clearPlan: vi.fn()
    }
    render(
      <TipsContext.Provider value={tips}>
        <ScheduledPage onOpenConversation={vi.fn()} profiles={profiles} defaultProfileId="mock" />
      </TipsContext.Provider>
    )
    const instruction = (await screen.findByTestId('scheduled-instruction')) as HTMLTextAreaElement
    expect(instruction.value).toBe('Fais le point sur les PR ouvertes')
    expect(tips.clearPlan).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('scheduled-save'))
    await waitFor(() => expect(tips.used).toHaveBeenCalledWith('scheduled'))
    expect(api.save).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        folder: '/Users/moi/projet',
        instruction: 'Fais le point sur les PR ouvertes'
      })
    )
  })
})
