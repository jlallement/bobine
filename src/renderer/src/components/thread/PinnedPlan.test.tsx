import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PlanEntry } from '../../../../shared/acp-sdk.mts'
import type { TranscriptItem } from '@shared/transcript'
import { PinnedPlan } from './PinnedPlan'
import { currentEntry, pinnedPlanOf, turnPlan } from './PlanList'
import { Transcript } from './Transcript'

const entry = (content: string, status: PlanEntry['status']): PlanEntry => ({
  content,
  status,
  priority: 'medium'
})
const done = entry('Analyser le projet', 'completed')
const doing = entry('Modifier la configuration', 'in_progress')
const todo = entry('Vérifier le résultat', 'pending')
const entries = [done, doing, todo]
const plan = (id: number, list = entries): TranscriptItem => ({ kind: 'plan', id, entries: list })

describe('plan du tour (fiche 077)', () => {
  it('seulement le plan arrivé après le dernier message de l’utilisateur', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Modifie la configuration' },
      plan(2),
      { kind: 'agent', id: 3, text: 'Je regarde.' }
    ]
    expect(turnPlan(items)?.id).toBe(2)
    // Nouveau tour sans plan : celui du tour précédent n'est pas épinglé.
    expect(turnPlan([...items, { kind: 'user', id: 4, text: 'Et ensuite ?' }])).toBeUndefined()
    expect(turnPlan([])).toBeUndefined()
  })

  it('épinglé tant que l’agent travaille, et s’il y a des tâches', () => {
    const user: TranscriptItem = { kind: 'user', id: 1, text: 'Vas-y' }
    expect(pinnedPlanOf([user, plan(2)], true)?.id).toBe(2)
    expect(pinnedPlanOf([user, plan(2)], false)).toBeUndefined()
    expect(pinnedPlanOf([user, plan(2, [])], true)).toBeUndefined()
  })

  it('tâche montrée sur la ligne repliée : en cours, sinon la prochaine, sinon la dernière', () => {
    expect(currentEntry(entries)?.content).toBe('Modifier la configuration')
    expect(currentEntry([done, todo])?.content).toBe('Vérifier le résultat')
    expect(currentEntry([done])?.content).toBe('Analyser le projet')
    expect(currentEntry([])).toBeUndefined()
  })
})

describe('PinnedPlan (fiche 077)', () => {
  beforeEach(() => localStorage.clear())

  it('dépliée : titre, progression, tâche en cours marquée et qui tourne', () => {
    render(<PinnedPlan entries={entries} />)
    const toggle = screen.getByTestId('pinned-plan-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent).toContain('Tâches')
    expect(toggle.textContent).toContain('1 / 3')
    const items = screen.getByTestId('pinned-plan').querySelectorAll('li')
    expect([...items].map((li) => li.className)).toEqual(['completed', 'in_progress', 'pending'])
    expect(items[1]?.getAttribute('aria-current')).toBe('step')
    expect(items[1]?.querySelector('svg.spin')).not.toBeNull()
  })

  it('repliée d’un clic sur une ligne, et retenue', () => {
    const { unmount } = render(<PinnedPlan entries={entries} />)
    fireEvent.click(screen.getByTestId('pinned-plan-toggle'))
    expect(screen.getByTestId('pinned-plan-toggle').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByTestId('pinned-plan-current').textContent).toBe('Modifier la configuration')
    expect(
      screen.getByTestId('pinned-plan').querySelector<HTMLElement>('.pinned-plan-body')?.hidden
    ).toBe(true)
    unmount()
    render(<PinnedPlan entries={entries} />)
    expect(screen.getByTestId('pinned-plan-toggle').getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Transcript : carte du plan épinglé (fiche 077)', () => {
  const items: TranscriptItem[] = [{ kind: 'user', id: 1, text: 'Vas-y' }, plan(2)]
  const view = (hiddenPlanId?: number) =>
    render(
      <Transcript
        items={items}
        onRespondPermission={() => {}}
        onRespondElicitation={() => {}}
        {...(hiddenPlanId ? { hiddenPlanId } : {})}
      />
    )

  it('masquée pendant le tour, montrée sinon', () => {
    const { container, unmount } = view(2)
    expect(container.querySelector('.plan')).toBeNull()
    unmount()
    expect(view().container.querySelector('.plan li.in_progress')?.textContent).toBe(
      'Modifier la configuration'
    )
  })
})
