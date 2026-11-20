import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { childProposalSchema, type ChildProposalItem } from '@shared/children'
import type { ProposalsInfo } from './ChildProposals'
import type { RespondElicitation } from './ElicitationCard'
import { WorkGroup } from './WorkGroup'

/** La carte de groupe d'un tour de propositions (fiche 264), telle que le fil la pose. */
function ProposedWorks({
  items,
  info,
  onRespond
}: {
  items: ChildProposalItem[]
  info: ProposalsInfo
  onRespond: RespondElicitation
}) {
  return (
    <WorkGroup
      group={{ at: items[0]?.id ?? 0, rows: items.map((p) => ({ key: p.requestId, proposal: p })) }}
      items={items}
      info={undefined}
      proposals={info}
      onRespond={onRespond}
    />
  )
}

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
  const childFolder = vi.fn()
  const commitForChildren = vi.fn()
  beforeEach(() => {
    view.mockReset().mockResolvedValue({ snapshot: { controls: [model] } })
    startChild.mockReset().mockResolvedValue({ id: 'f' })
    // Dossier de la mère propre (fiche 240), sauf dans les essais qui le modifient.
    childFolder.mockReset().mockResolvedValue({ place: 'worktree', root: '/d', head: 'h1' })
    commitForChildren.mockReset().mockResolvedValue({ hash: 'abc1234def', short: 'abc1234' })
    window.api.conversations = {
      view,
      startChild,
      childFolder,
      commitForChildren
    } as unknown as Window['api']['conversations']
  })
  const show = async (items: ChildProposalItem[], onRespond = vi.fn()) => {
    render(<ProposedWorks items={items} info={{ mother, profiles }} onRespond={onRespond} />)
    // Le modèle de la mère arrive après le premier rendu.
    await act(async () => {})
    return onRespond
  }
  const row = (title: string) =>
    screen.getByTestId('work-group').querySelector(`[data-title="${title}"]`) as HTMLElement
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
      <ProposedWorks
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
      <ProposedWorks
        items={[proposal(1, 'Relecture')]}
        info={{ mother, profiles: profiles.map((p) => ({ ...p, childModel: false })) }}
        onRespond={onRespond}
      />
    )
    await act(async () => {})
    expect(view).not.toHaveBeenCalled()
    click('Relecture', 'options')
    expect(screen.queryByTestId('proposal-model')).toBeNull()
    expect(screen.getByTestId('work-group').textContent).toContain('L’agent choisit son modèle.')
    click('Relecture', 'start')
    expect(onRespond).toHaveBeenLastCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start' }
    })
  })

  it('une ligne par proposition, le compte, la consigne dépliable', async () => {
    await show([proposal(1, 'Import CSV'), proposal(2, 'Page d’aide')])
    const card = screen.getByTestId('work-group')
    expect(screen.getByTestId('work-group-title').textContent).toBe('2 travaux proposés')
    expect(card.dataset['stage']).toBe('proposed')
    expect(screen.getByTestId('work-group-where').textContent).toContain(
      'Chaque travail part du dernier commit, dans sa branche'
    )
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
    expect(states).toEqual(['Lancé', 'Fait ici', 'Refusé', 'Expiré'])
    // Plus rien à décider : « 4 travaux », et les décisions prises.
    expect(screen.getByTestId('work-group-title').textContent).toBe('4 travaux')
    expect(screen.getByTestId('work-group-counts').textContent).toBe(
      '· 1 lancé, 1 fait ici, 1 refusé, 1 expiré'
    )
    expect(screen.queryByTestId('work-group-start-all')).toBeNull()
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
    const card = screen.getByTestId('work-group')
    expect(document.activeElement).toBe(card)
    fireEvent.keyDown(card, { key: 'ArrowDown' })
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onRespond).toHaveBeenCalledWith('r2', expect.objectContaining({ action: 'accept' }))
  })

  it('arrivée pendant le tour : sous les lignes affichées, la ligne dépliée ne bouge pas (fiche 124)', async () => {
    const onRespond = vi.fn()
    const { rerender } = render(
      <ProposedWorks
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
    expect(screen.getByTestId('work-group').hasAttribute('data-scroll-hold')).toBe(true)

    rerender(
      <ProposedWorks
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
    expect(
      screen.getByTestId('work-group').querySelector('.work-group-rows')?.firstElementChild
    ).toBe(opened)
    fireEvent.click(start as HTMLElement)
    expect(onRespond).toHaveBeenLastCalledWith('r1', expect.objectContaining({ action: 'accept' }))
  })
})

describe('carte « Tâches proposées » et dossier modifié (fiches 240, 262)', () => {
  const dirty = {
    count: 2,
    files: [
      { path: 'server/index.js', status: 'untracked' as const },
      { path: 'public/app.js', status: 'untracked' as const }
    ],
    commit: '9970242',
    title: 'Carnet'
  }
  const folder = (d?: typeof dirty, head = '9970242aa') => ({
    place: 'worktree' as const,
    root: '/depot',
    head,
    ...(d ? { dirty: d } : {})
  })
  const childFolder = vi.fn()
  const commitForChildren = vi.fn()
  beforeEach(() => {
    childFolder.mockReset().mockResolvedValue(folder(dirty))
    commitForChildren.mockReset().mockImplementation(async () => {
      childFolder.mockResolvedValue(folder(undefined, 'abc1234def'))
      return { hash: 'abc1234def', short: 'abc1234' }
    })
    window.api.conversations = {
      view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } }),
      startChild: vi.fn(),
      childFolder,
      commitForChildren
    } as unknown as Window['api']['conversations']
  })
  const show = async (items: ChildProposalItem[]) => {
    const onRespond = vi.fn()
    render(<ProposedWorks items={items} info={{ mother, profiles }} onRespond={onRespond} />)
    await act(async () => {})
    return onRespond
  }
  const start = (title: string) =>
    screen
      .getByTestId('work-group')
      .querySelector(`[data-title="${title}"] [data-testid=proposal-start]`) as HTMLButtonElement
  const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')
  const openCommit = async () => {
    fireEvent.pointerDown(screen.getByTestId('launch-line-change'), { button: 0, ctrlKey: false })
    await act(async () => void fireEvent.click(await screen.findByTestId('launch-line-commit')))
  }

  it('une ligne discrète pour la carte, sans encadré ; « Lancer » part sans elles, dit', async () => {
    const onRespond = await show([proposal(1, 'API'), proposal(2, 'Page web')])
    expect(childFolder).toHaveBeenCalledWith('m')
    // Une ligne pour la carte, son seul bouton « Changer… » : pas d'encadré à boutons.
    expect(screen.getAllByTestId('launch-line')).toHaveLength(1)
    const place = screen.getByTestId('proposals-launch-place')
    expect([...place.querySelectorAll('button')].map((b) => b.dataset.testid)).toEqual([
      'launch-line-change'
    ])
    expect(plain(screen.getByTestId('launch-line').textContent)).toBe(
      'Partiront du dernier commit, sans vos 2 modifications'
    )
    expect(start('API').disabled).toBe(false)
    fireEvent.click(start('API'))
    expect(onRespond).toHaveBeenCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', uncommitted: 'anyway' }
    })
  })

  it('pas de « Juste un avis » sur la carte : committer d’abord, partir sans elles, voir', async () => {
    await show([proposal(1, 'API')])
    fireEvent.pointerDown(screen.getByTestId('launch-line-change'), { button: 0, ctrlKey: false })
    await screen.findByTestId('launch-line-menu')
    expect(screen.getByTestId('launch-line-commit')).toBeTruthy()
    expect(screen.getByTestId('launch-line-without')).toBeTruthy()
    expect(screen.getByTestId('launch-line-show')).toBeTruthy()
    expect(screen.queryByTestId('launch-line-opinion')).toBeNull()
  })

  it('dossier pas encore lu : « Lancer » attend un instant (le choix affiché n’est pas connu)', async () => {
    childFolder.mockReturnValue(new Promise(() => {}))
    const onRespond = await show([proposal(1, 'API')])
    expect(start('API').disabled).toBe(true)
    fireEvent.click(start('API'))
    expect(onRespond).not.toHaveBeenCalled()
  })

  it('« Committer d’abord » : commit dans le dossier de la mère, puis « Lancer » sans choix', async () => {
    const onRespond = await show([proposal(1, 'API')])
    await openCommit()
    // Commit ouvert : « Lancer » attend.
    expect(start('API').disabled).toBe(true)
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    await act(async () => void fireEvent.click(screen.getByTestId('launch-line-commit-confirm')))
    expect(commitForChildren).toHaveBeenCalledWith('m', {
      message: expect.any(String),
      files: ['server/index.js', 'public/app.js']
    })
    expect(screen.queryByTestId('launch-line')).toBeNull()
    fireEvent.click(start('API'))
    expect(onRespond).toHaveBeenCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start' }
    })
  })

  it('une ligne d’un rôle en lecture seule n’attend pas : elle travaille dans ce dossier', async () => {
    const readOnly = proposal(1, 'Relecture', {
      prompt: {
        mode: 'form',
        message: 'Relecture',
        schema: childProposalSchema(),
        child: {
          title: 'Relecture',
          prompt: 'Relis',
          role: {
            name: 'security-expert',
            label: 'Expert sécu',
            icon: 'shield-check',
            color: 'orange',
            description: 'd',
            readOnly: true,
            prompt: 'p',
            scope: 'builtin'
          }
        }
      }
    } as Partial<ChildProposalItem>)
    await show([readOnly])
    expect(childFolder).not.toHaveBeenCalled()
    expect(screen.queryByTestId('launch-line')).toBeNull()
    expect(start('Relecture').disabled).toBe(false)
  })

  it('dépôt sans commit : dans ce dossier, ni worktree ni choix ; « Lancer » part sans rien', async () => {
    childFolder.mockResolvedValue({ place: 'here', reason: 'noCommit' })
    const onRespond = await show([proposal(1, 'API')])
    expect(plain(screen.getByTestId('launch-line').textContent)).toBe(
      'Ce dépôt n’a pas encore de commit : ce travail se fera dans ce dossier, en même temps que l’agent, sans branche ni rien à fusionner'
    )
    expect(plain(screen.getByTestId('work-group').textContent)).not.toContain('worktree')
    expect(screen.queryByTestId('launch-line-change')).toBeNull()
    fireEvent.click(start('API'))
    expect(onRespond).toHaveBeenCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start' }
    })
  })

  it('dépôt sans commit : un rôle qui écrit est dit « dans ce dossier », pas « dans son worktree »', async () => {
    childFolder.mockResolvedValue({ place: 'here', reason: 'noCommit' })
    const writer = proposal(1, 'Page', {
      prompt: {
        mode: 'form',
        message: 'Page',
        schema: childProposalSchema(),
        child: {
          title: 'Page',
          prompt: 'Écris la page',
          role: {
            name: 'front-architect',
            label: 'Architecte front',
            icon: 'layout-dashboard',
            color: 'violet',
            description: 'd',
            readOnly: false,
            prompt: 'p',
            scope: 'builtin'
          }
        }
      }
    } as Partial<ChildProposalItem>)
    await show([writer])
    expect(plain(screen.getByTestId('proposal-place').textContent)).toBe('écrit dans ce dossier')
  })

  it('fiche 244 : un fichier décoché ne part pas ; « Lancer » part sans lui', async () => {
    commitForChildren.mockImplementation(async () => {
      childFolder.mockResolvedValue(
        folder({ ...dirty, count: 1, files: dirty.files.slice(1) }, 'abc1234def')
      )
      return { hash: 'abc1234def', short: 'abc1234' }
    })
    const onRespond = await show([proposal(1, 'API')])
    await openCommit()
    fireEvent.click(
      screen
        .getAllByTestId('launch-line-commit-file')
        .find((li) => li.dataset.path === 'public/app.js')
        ?.querySelector('input') as HTMLInputElement
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    await act(async () => void fireEvent.click(screen.getByTestId('launch-line-commit-confirm')))
    expect(commitForChildren).toHaveBeenCalledWith('m', {
      message: expect.not.stringContaining('public/app.js'),
      files: ['server/index.js']
    })
    expect(plain(screen.getByTestId('launch-line').textContent)).toBe(
      'Partira du dernier commit, sans votre modification'
    )
    fireEvent.click(start('API'))
    expect(onRespond).toHaveBeenCalledWith('r1', {
      action: 'accept',
      content: { decision: 'start', uncommitted: 'anyway' }
    })
  })
})
