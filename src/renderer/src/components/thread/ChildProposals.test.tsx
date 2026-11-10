import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { childProposalSchema, type ChildProposalItem } from '@shared/children'
import { ChildProposals } from './ChildProposals'

const mother: ConversationSummary = {
  id: 'm',
  title: 'Carnet',
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: '/depot',
  updatedAt: '2026-10-21T00:00:00Z',
  status: 'ready',
  draft: false
}
const profiles = [
  { id: 'mock', label: 'Factice', available: true, childModel: true },
  { id: 'opencode', label: 'OpenCode', available: true }
] as unknown as ProfileSummary[]

const proposal = (
  id: number,
  title: string,
  extra: Partial<ChildProposalItem> = {}
): ChildProposalItem =>
  ({
    kind: 'elicitation',
    id,
    requestId: `r${id}`,
    state: 'pending',
    prompt: {
      mode: 'form',
      message: title,
      schema: childProposalSchema(),
      child: { title, prompt: `Consigne de ${title}` }
    },
    ...extra
  }) as ChildProposalItem

const model = {
  id: 'model',
  name: 'Modèle',
  category: 'model',
  type: 'select',
  currentValue: 'rapide',
  options: [
    { value: 'rapide', name: 'Rapide' },
    { value: 'soigne', name: 'Soigné' }
  ]
}

describe('carte « Tâches proposées » (fiche 112)', () => {
  const view = vi.fn()
  const startChild = vi.fn()
  beforeEach(() => {
    view.mockReset().mockResolvedValue({ snapshot: { controls: [model] } })
    startChild.mockReset().mockResolvedValue({ id: 'f' })
    window.api.conversations = { view, startChild } as unknown as Window['api']['conversations']
  })
  const show = async (items: ChildProposalItem[], onRespond = vi.fn()) => {
    render(<ChildProposals items={items} info={{ mother, profiles }} onRespond={onRespond} />)
    // Le modèle de la mère arrive après le premier rendu.
    await act(async () => {})
    return onRespond
  }
  const row = (title: string) =>
    screen.getByTestId('proposals').querySelector(`[data-title="${title}"]`) as HTMLElement
  const click = (title: string, action: string) =>
    fireEvent.click(row(title).querySelector(`[data-testid=proposal-${action}]`) as HTMLElement)

  it('agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160)', async () => {
    const chosen = (child: Record<string, unknown>) =>
      proposal(1, 'Relecture', {
        prompt: {
          mode: 'form',
          message: 'Relecture',
          schema: childProposalSchema(),
          child: { title: 'Relecture', prompt: 'Relis', ...child }
        }
      } as Partial<ChildProposalItem>)
    const onRespond = await show([
      chosen({ model: { controlId: 'model', value: 'soigne' }, why: 'relecture fine' })
    ])
    expect(screen.getByTestId('proposal-why').textContent).toBe(
      'Suggéré par la mère, à confirmer\u00a0: Soigné — relecture fine'
    )
    // Sélecteurs ouverts d'emblée : la suggestion se confirme ou se change.
    expect((screen.getByTestId('proposal-model') as HTMLSelectElement).value).toBe('soigne')
    // L'utilisateur garde le choix de la mère : il part avec « Lancer ».
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'soigne' }
    })
  })

  it('« Lancer » attend que le modèle suggéré soit lisible (fiche 160)', async () => {
    let ready: (value: unknown) => void = () => {}
    view.mockReset().mockReturnValue(new Promise((resolve) => (ready = resolve)))
    const onRespond = vi.fn()
    render(
      <ChildProposals
        items={[
          proposal(1, 'Relecture', {
            prompt: {
              mode: 'form',
              message: 'Relecture',
              schema: childProposalSchema(),
              child: {
                title: 'Relecture',
                prompt: 'Relis',
                model: { controlId: 'model', value: 'soigne' }
              }
            }
          } as Partial<ChildProposalItem>)
        ]}
        info={{ mother, profiles }}
        onRespond={onRespond}
      />
    )
    const start = row('Relecture').querySelector(
      '[data-testid=proposal-start]'
    ) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    click('Relecture', 'start')
    expect(onRespond).not.toHaveBeenCalled()
    await act(async () => ready({ snapshot: { controls: [model] } }))
    expect(start.disabled).toBe(false)
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'soigne' }
    })
  })

  it('un autre agent proposé : présélectionné, et l’utilisateur peut revenir au sien', async () => {
    const onRespond = await show([
      proposal(1, 'Relecture', {
        prompt: {
          mode: 'form',
          message: 'Relecture',
          schema: childProposalSchema(),
          child: { title: 'Relecture', prompt: 'Relis', profileId: 'opencode' }
        }
      } as Partial<ChildProposalItem>)
    ])
    expect(screen.getByTestId('proposal-why').textContent).toBe(
      'Suggéré par la mère, à confirmer\u00a0: OpenCode'
    )
    const agent = screen.getByTestId('proposal-agent') as HTMLSelectElement
    expect(agent.value).toBe('opencode')
    fireEvent.change(agent, { target: { value: 'mock' } })
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'rapide' }
    })
  })

  it('modèle suggéré puis changé par l’utilisateur : son choix part (fiche 160)', async () => {
    const onRespond = await show([
      proposal(1, 'Relecture', {
        prompt: {
          mode: 'form',
          message: 'Relecture',
          schema: childProposalSchema(),
          child: {
            title: 'Relecture',
            prompt: 'Relis',
            model: { controlId: 'model', value: 'soigne' }
          }
        }
      } as Partial<ChildProposalItem>)
    ])
    fireEvent.change(screen.getByTestId('proposal-model'), { target: { value: 'rapide' } })
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'rapide' }
    })
  })

  it('profil sans choix de modèle (comme Bob) : aucun champ modèle, rien n’est envoyé', async () => {
    const onRespond = vi.fn()
    render(
      <ChildProposals
        items={[proposal(1, 'Relecture')]}
        info={{ mother, profiles: profiles.map((p) => ({ ...p, childModel: false })) }}
        onRespond={onRespond}
      />
    )
    await act(async () => {})
    expect(view).not.toHaveBeenCalled()
    click('Relecture', 'options')
    expect(screen.queryByTestId('proposal-model')).toBeNull()
    expect(screen.getByTestId('proposals').textContent).toContain('L’agent choisit son modèle.')
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start' }
    })
  })

  it('une ligne par proposition, le compte, la consigne dépliable', async () => {
    await show([proposal(1, 'Import CSV'), proposal(2, 'Page d’aide')])
    const card = screen.getByTestId('proposals')
    expect(card.textContent).toContain('2 tâches proposées')
    expect(card.textContent).toContain('2 en attente')
    expect(screen.getAllByTestId('proposal-row')).toHaveLength(2)
    expect(screen.queryByTestId('proposal-prompt')).toBeNull()
    fireEvent.click(row('Import CSV').querySelector('[data-testid=proposal-title]') as HTMLElement)
    expect(screen.getByTestId('proposal-prompt').textContent).toBe('Consigne de Import CSV')
  })

  it('Lancer, Faire ici, Refuser : la décision part dans la réponse à l’élicitation', async () => {
    const onRespond = await show([proposal(1, 'Un'), proposal(2, 'Deux'), proposal(3, 'Trois')])
    click('Un', 'start')
    // Le modèle de la mère, tel quel : l'agent reste le sien.
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'rapide' }
    })
    click('Deux', 'here')
    expect(onRespond).toHaveBeenLastCalledWith('r2', {
      action: 'accept',
      content: { decision: 'here' }
    })
    click('Trois', 'refuse')
    expect(onRespond).toHaveBeenLastCalledWith('r3', {
      action: 'accept',
      content: { decision: 'refuse' }
    })
  })

  it('options : un autre agent (sans modèle), ou un autre modèle du même agent', async () => {
    const onRespond = await show([proposal(1, 'Un'), proposal(2, 'Deux')])
    click('Un', 'options')
    const agent = row('Un').querySelector('[data-testid=proposal-agent]') as HTMLSelectElement
    expect(agent.value).toBe('mock')
    expect(row('Un').querySelector('[data-testid=proposal-model]')).toBeTruthy()
    fireEvent.change(agent, { target: { value: 'opencode' } })
    expect(row('Un').querySelector('[data-testid=proposal-model]')).toBeNull()
    click('Un', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', profileId: 'opencode' }
    })
    click('Deux', 'options')
    fireEvent.change(
      row('Deux').querySelector('[data-testid=proposal-model]') as HTMLSelectElement,
      {
        target: { value: 'soigne' }
      }
    )
    click('Deux', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r2', {
      action: 'accept',
      content: { decision: 'start', modelControl: 'model', modelValue: 'soigne' }
    })
  })

  it('lignes répondues : leur issue ; expirée : « Lancer » passe par « Lancer en parallèle… »', async () => {
    await show([
      proposal(1, 'Lancée', { state: 'accept', content: { decision: 'start' } }),
      proposal(2, 'Ici', { state: 'accept', content: { decision: 'here' } }),
      proposal(3, 'Non', { state: 'decline' }),
      proposal(4, 'Vieille', { state: 'cancel' })
    ])
    const states = screen.getAllByTestId('proposal-state').map((s) => s.textContent)
    expect(states).toEqual(['Lancée', 'Faite ici', 'Refusée', 'Expirée'])
    expect(screen.getByTestId('proposals').textContent).toContain(
      '1 lancée, 1 faite ici, 1 refusée, 1 expirée'
    )
    expect(screen.getAllByTestId('proposal-start')).toHaveLength(1)
    expect(screen.queryByTestId('proposal-here')).toBeNull()
    click('Vieille', 'start')
    expect(startChild).toHaveBeenCalledWith('m', {
      text: 'Consigne de Vieille',
      title: 'Vieille',
      model: { controlId: 'model', value: 'rapide' }
    })
  })

  it('clavier : ↓ puis Entrée lance la deuxième ligne', async () => {
    const onRespond = await show([proposal(1, 'Un'), proposal(2, 'Deux')])
    const card = screen.getByTestId('proposals')
    expect(document.activeElement).toBe(card)
    fireEvent.keyDown(card, { key: 'ArrowDown' })
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onRespond).toHaveBeenCalledWith('r2', expect.objectContaining({ action: 'accept' }))
  })

  it('arrivée pendant le tour : sous les lignes affichées, la ligne dépliée ne bouge pas (fiche 124)', async () => {
    const onRespond = vi.fn()
    const { rerender } = render(
      <ChildProposals
        items={[proposal(1, 'Un'), proposal(2, 'Deux')]}
        info={{ mother, profiles }}
        onRespond={onRespond}
      />
    )
    await act(async () => {})
    fireEvent.click(row('Un').querySelector('[data-testid=proposal-title]') as HTMLElement)
    const opened = row('Un')
    const start = opened.querySelector('[data-testid=proposal-start]')
    // Le fil ne défile pas tout seul tant que le pointeur est sur la carte (`useThreadScroll`).
    expect(screen.getByTestId('proposals').hasAttribute('data-scroll-hold')).toBe(true)

    rerender(
      <ChildProposals
        items={[proposal(1, 'Un'), proposal(2, 'Deux'), proposal(3, 'Trois')]}
        info={{ mother, profiles }}
        onRespond={onRespond}
      />
    )
    expect(screen.getAllByTestId('proposal-row').map((r) => r.dataset['title'])).toEqual([
      'Un',
      'Deux',
      'Trois'
    ])
    // Même ligne, toujours dépliée, mêmes boutons : la nouvelle s'ajoute en dessous.
    expect(row('Un')).toBe(opened)
    expect(opened.querySelector('[data-testid=proposal-prompt]')?.textContent).toBe(
      'Consigne de Un'
    )
    expect(opened.querySelector('[data-testid=proposal-start]')).toBe(start)
    expect(screen.getByTestId('proposals').querySelector('.proposal-rows')?.firstElementChild).toBe(
      opened
    )
    fireEvent.click(start as HTMLElement)
    expect(onRespond).toHaveBeenLastCalledWith('r1', expect.objectContaining({ action: 'accept' }))
  })
})
