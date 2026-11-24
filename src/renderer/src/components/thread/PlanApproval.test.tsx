import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { PlanApproval } from './PlanApproval'

/**
 * Sortie du mode plan (autorisation `switch_mode`) : remplace la vérification de composant de
 * `e2e/suites/questions.mjs` (n° 8). Le plan reçu d'OpenCode par ACP reste à l'e2e `questions`.
 */

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const asking = (state: NonNullable<ToolItem['permission']>['state'] = 'pending'): ToolItem => ({
  kind: 'tool',
  id: 1,
  toolCallId: 'exit-plan',
  title: 'ExitPlanMode',
  toolKind: 'switch_mode',
  status: 'pending',
  content: [
    { type: 'content', content: { type: 'text', text: '## Plan\n\n1. Lire le code\n2. Corriger' } }
  ],
  locations: [],
  permission: {
    requestId: 'r1',
    state,
    options: [
      { optionId: 'yes', name: 'Oui, et accepter les modifications', kind: 'allow_always' },
      { optionId: 'no', name: 'Non, continuer à planifier', kind: 'reject_once' }
    ]
  }
})

describe('plan à valider (sortie du mode plan)', () => {
  it('le plan en clair, rendu en Markdown, avant les choix ; la carte a le focus (questions n° 8)', () => {
    const onRespond = vi.fn()
    render(<PlanApproval item={asking()} onRespond={onRespond} />)
    const card = screen.getByTestId('plan-approval')
    const doc = screen.getByTestId('plan-doc')
    expect(doc.querySelector('h2')?.textContent).toBe('Plan')
    expect([...doc.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Lire le code',
      'Corriger'
    ])
    const [first] = screen.getAllByTestId('plan-choice')
    if (!first) throw new Error('aucun choix')
    expect(doc.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.activeElement).toBe(card)
    // Rien n'est choisi d'avance ; « 2 » au clavier répond.
    expect(onRespond).not.toHaveBeenCalled()
    fireEvent.keyDown(card, { key: '2' })
    expect(onRespond).toHaveBeenCalledWith('r1', 'no')
  })

  it('répondu : le plan replié sous « Plan proposé », et la réponse', () => {
    render(
      <PlanApproval
        item={asking({ optionId: 'yes', name: 'Oui', kind: 'allow_always' })}
        onRespond={vi.fn()}
      />
    )
    const answered = screen.getByTestId('plan-answered')
    expect(answered.querySelector('details')?.open).toBe(false)
    expect(screen.getByTestId('permission-answer').textContent?.trim()).toBe('Oui')
  })
})
