import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { AlwaysScope } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { AgentCardContext } from './agent-card-context'
import { ToolCall, WorkspaceContext } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const WS = '/Users/ada/projet'
const BOB: AlwaysScope = { lasts: 'conversation', covers: { execute: 'parts', edit: 'all-edits' } }

const permission = (withAlways: boolean, risks?: unknown[]) =>
  ({
    requestId: 'p1',
    state: 'pending' as const,
    options: [
      { optionId: 'allow', name: 'Allow once', kind: 'allow_once' as const },
      ...(withAlways
        ? [{ optionId: 'always', name: 'Always allow', kind: 'allow_always' as const }]
        : []),
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' as const }
    ],
    ...(risks ? { risks } : {})
  }) as NonNullable<ToolItem['permission']>

const tool = (extra: Partial<ToolItem>): ToolItem => ({
  kind: 'tool',
  id: 1,
  toolCallId: 't',
  title: 'x',
  status: 'pending',
  content: [],
  locations: [],
  permission: permission(true),
  ...extra
})

const view = (item: ToolItem, scope?: AlwaysScope, name = 'IBM Bob') =>
  render(
    <WorkspaceContext.Provider value={WS}>
      <AgentCardContext.Provider value={{ name, alwaysScope: scope }}>
        <ToolCall item={item} onRespond={vi.fn()} />
      </AgentCardContext.Provider>
    </WorkspaceContext.Provider>
  )

const title = () => screen.getByTestId('permission').querySelector('.pc-title')?.textContent
const buttons = () => [...document.querySelectorAll('.pc-actions button')].map((b) => b.textContent)

describe('« Toujours » dit par le profil de l’agent (fiche 214)', () => {
  const run = tool({ title: 'npm test', toolKind: 'execute', command: { text: 'npm test' } })

  it('portée déclarée : « Toujours dans cette conversation » et UNE seule note, l’agent en gras (recette QA)', () => {
    view(run, BOB)
    expect(buttons()).toContain(i18next.t('toolCall.permission.alwaysConversation'))
    // Décision Q1 : la phrase générique est réservée aux agents sans déclaration.
    expect(screen.queryByTestId('permission-agent-always-note')).toBeNull()
    const note = screen.getByTestId('permission-always-scope')
    expect(note.textContent).toBe(
      i18next.t('toolCall.permission.alwaysScope.execute', { agent: 'IBM Bob' })
    )
    expect(note.querySelector('strong')?.textContent).toBe('IBM Bob')
  })

  it('ligne de réponse : même libellé que le bouton choisi (recette QA)', () => {
    const answered = (scope?: AlwaysScope) =>
      view(
        {
          ...run,
          permission: {
            ...permission(true),
            state: { optionId: 'always', name: 'Always allow', kind: 'allow_always' }
          }
        },
        scope
      )
    answered(BOB)
    expect(screen.getByTestId('permission-answer').textContent).toContain(
      i18next.t('toolCall.permission.alwaysConversation')
    )
    document.body.innerHTML = ''
    answered(undefined)
    expect(screen.getByTestId('permission-answer').textContent).toContain(
      i18next.t('permissionOption.allow_always')
    )
  })

  it('modification : la précision dit « toutes les modifications », pas seulement celle-ci', () => {
    view(tool({ title: 'Writing file a.txt', toolKind: 'edit' }), BOB)
    expect(screen.getByTestId('permission-always-scope').textContent).toContain(
      i18next.t('toolCall.permission.alwaysScope.edit', { agent: 'IBM Bob' })
    )
  })

  it('agent sans déclaration : « Toujours autoriser » et « c’est l’agent qui décide », rien de plus', () => {
    view(run, undefined, 'OpenCode')
    expect(buttons()).not.toContain(i18next.t('toolCall.permission.alwaysConversation'))
    expect(buttons()).toContain(i18next.t('permissionOption.allow_always'))
    expect(screen.getByTestId('permission-agent-always-note')).toBeTruthy()
    expect(screen.queryByTestId('permission-always-scope')).toBeNull()
  })

  it('genre que le profil ne déclare pas (outil MCP…) : le bouton dit la conversation, pas de précision inventée', () => {
    view(tool({ title: 'Removing a.txt', toolKind: 'delete' }), BOB)
    expect(buttons()).toContain(i18next.t('toolCall.permission.alwaysConversation'))
    expect(screen.queryByTestId('permission-always-scope')).toBeNull()
  })

  it('retenu par Bobine (fiche 042) : « Toujours autoriser » et la portée exacte, sans le profil', () => {
    view(tool({ title: 'Running Meteo', toolKind: 'other' }), BOB)
    expect(buttons()).toContain(i18next.t('permissionOption.allow_always'))
    expect(screen.getByTestId('permission-remember-note').textContent).toBe(
      i18next.t('toolCall.permission.rememberNote', { name: '« Running Meteo »', agent: 'IBM Bob' })
    )
    expect(screen.queryByTestId('permission-always-scope')).toBeNull()
  })

  it('carte à risque : pas de « Toujours », une ligne dit pourquoi', () => {
    view(
      tool({
        title: 'echo x > /tmp/x',
        toolKind: 'execute',
        command: { text: 'echo x > /tmp/x' },
        permission: permission(true, [{ kind: 'outside-folder', path: '/tmp/x' }])
      }),
      BOB
    )
    expect(buttons()).not.toContain(i18next.t('toolCall.permission.alwaysConversation'))
    expect(screen.getByTestId('permission-risk-no-always').textContent).toBe(
      i18next.t('toolCall.permission.riskNoAlways')
    )
  })

  it('carte ordinaire sans « Toujours » offert : aucune ligne', () => {
    view(tool({ permission: permission(false) }), BOB)
    expect(screen.queryByTestId('permission-risk-no-always')).toBeNull()
  })
})

describe('Carte de liste de tâches (fiche 214)', () => {
  const todos = [
    { text: 'Lire', state: 'completed' as const },
    { text: 'Tester', state: 'in_progress' as const },
    { text: 'Livrer', state: 'pending' as const }
  ]

  it('question dédiée, tâches avec leur état dit aux lecteurs d’écran, et le compte', () => {
    view(tool({ title: 'Updating todo list', toolKind: 'other', todos }), BOB)
    expect(title()).toBe(i18next.t('toolCall.permission.question.todos'))
    const items = [...document.querySelectorAll('[data-testid=permission-todos] li')]
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual([
      'completed',
      'in_progress',
      'pending'
    ])
    expect(items[1]?.textContent).toContain(i18next.t('toolCall.todos.inProgress'))
    expect(items[1]?.textContent).toContain('Tester')
    expect(screen.getByTestId('permission-todos-count').textContent).toBe(
      [
        i18next.t('toolCall.todos.doneCount', { count: 1 }),
        i18next.t('toolCall.todos.doingCount', { count: 1 }),
        i18next.t('toolCall.todos.todoCount', { count: 1 })
      ].join(' · ')
    )
    // Retenu par Bobine : la note dit la portée exacte (la liste de tâches).
    expect(screen.getByTestId('permission-remember-note').textContent).toContain(
      i18next.t('toolCall.permission.rememberTodos')
    )
  })

  it('compte au pluriel correct : « 1 faite », « 2 faites »', () => {
    expect(i18next.t('toolCall.todos.doneCount', { count: 1 })).toBe('1 faite')
    expect(i18next.t('toolCall.todos.doneCount', { count: 2 })).toBe('2 faites')
    expect(i18next.t('toolCall.todos.doneCount', { count: 0 })).toBe('0 faite')
  })

  it('reconnue aux tâches, pas au titre : un autre titre, même carte', () => {
    view(tool({ title: 'Mise à jour', toolKind: 'other', todos }), undefined, 'Autre')
    expect(screen.getByTestId('permission-todos')).toBeTruthy()
    // L'icône de la ligne d'outil est celle de la liste, pas la clé à molette d'un outil « other ».
    expect(document.querySelector('.lucide-list-todo')).toBeTruthy()
  })
})

describe('Carte d’outil MCP (fiche 214)', () => {
  it('arguments tels que reçus, question générique', () => {
    view(
      tool({
        title: 'Running Meteo',
        toolKind: 'other',
        args: [
          { name: 'ville', value: '"Lyon"' },
          { name: 'jours', value: '3' }
        ]
      }),
      BOB
    )
    expect(title()).toBe(i18next.t('toolCall.permission.question.other'))
    const args = screen.getByTestId('permission-args')
    expect(args.textContent).toContain(i18next.t('toolCall.permission.args'))
    expect(args.textContent).toContain('ville')
    expect(args.textContent).toContain('"Lyon"')
  })
})

describe('Pastille du dossier de la conversation dans la commande (fiche 214)', () => {
  it('pastille au nom du dossier, chemin entier en infobulle et nom accessible', () => {
    view(
      tool({
        title: `cd ${WS} && npm test`,
        toolKind: 'execute',
        command: { text: `cd ${WS} && npm test` }
      }),
      BOB
    )
    const chip = screen.getByTestId('command-chip')
    expect(chip.textContent).toBe('projet')
    expect(chip.getAttribute('title')).toBe(WS)
    expect(chip.getAttribute('aria-label')).toBe(
      i18next.t('toolCall.command.chipTitle', { path: WS })
    )
    // Le texte de la commande n'est pas altéré : copié, c'est celui de l'agent.
    expect(screen.getByTestId('command-text').textContent).toContain('cd projet')
  })

  it('un mot « projet » de l’agent, ou un autre chemin : du texte, jamais une pastille', () => {
    view(
      tool({
        title: 'ls projet /Users/ada/projet-copie',
        toolKind: 'execute',
        command: { text: 'ls projet /Users/ada/projet-copie' }
      })
    )
    expect(screen.queryByTestId('command-chip')).toBeNull()
  })
})

describe('Pied de carte (point d’insertion de la fiche 215)', () => {
  it('vide aujourd’hui : la carte garde ses boutons et notes', () => {
    view(tool({}), BOB)
    expect(document.querySelectorAll('.pc-actions button')).toHaveLength(3)
  })
})
