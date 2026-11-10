import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { commitSubject } from '@shared/worktree-cycle'
import { agentTitle, proposedTitle, summaryOf, titleFrom } from './helpers'
import type { ConversationRecord } from './store'

describe('titre tiré du premier message', () => {
  it('raccourci à un mot entier, jamais au milieu (fiche 126)', () => {
    const text =
      'Ajoute dans README.md une section « Contribuer » de trois lignes avec un lien vers le guide'
    const title = titleFrom(text)
    expect(title).toBe('Ajoute dans README.md une section « Contribuer » de trois…')
    // Le sujet de commit proposé (fiche 110) en hérite : pas de mot coupé.
    expect(commitSubject(title)).toBe('ajoute dans README.md une section « Contribuer » de trois')
  })

  it('court : tel quel ; un seul mot trop long : coupé quand même', () => {
    expect(titleFrom('Corrige le bug\nDétails…')).toBe('Corrige le bug')
    expect(titleFrom('x'.repeat(80))).toBe(`${'x'.repeat(59)}…`)
  })
})

describe('agentTitle : titre proposé par l’agent (fiche 125)', () => {
  it('sans ce que l’app joint au message ; rien s’il ne reste rien', () => {
    expect(
      agentTitle({ titleSource: 'message' }, 'Salut <bobine_capabilities> For context, about')
    ).toBe('Salut')
    expect(
      agentTitle({ titleSource: 'agent' }, 'This conversation started with another a…')
    ).toBeUndefined()
    expect(agentTitle({ titleSource: 'message' }, '<child_conversations_request>')).toBeUndefined()
    expect(agentTitle({ titleSource: 'agent' }, 'Explique le projet')).toBe('Explique le projet')
  })

  it('un renommage ou un titre posé par l’app (branche, bascule) ne sont pas remplacés', () => {
    expect(agentTitle({ titleSource: 'user' }, 'Autre chose')).toBeUndefined()
    expect(agentTitle({ titleSource: 'app' }, 'Autre chose')).toBeUndefined()
  })
})

describe('proposedTitle : titre lu dans un évènement de l’agent', () => {
  it('seulement `session_info_update` avec un titre, filtré par agentTitle', () => {
    const info = (title: string): AgentEvent => ({
      type: 'update',
      update: { sessionUpdate: 'session_info_update', title }
    })
    expect(proposedTitle({ titleSource: 'message' }, info('Explique le projet'))).toBe(
      'Explique le projet'
    )
    expect(proposedTitle({ titleSource: 'user' }, info('Autre'))).toBeUndefined()
    expect(proposedTitle({ titleSource: 'message' }, { type: 'turn-error', message: 'x' })).toBe(
      undefined
    )
  })
})

describe('summaryOf : le projet de la conversation (fiche 131)', () => {
  const record = (change: Partial<ConversationRecord> = {}): ConversationRecord => ({
    id: 'c',
    title: 'Carnet',
    titleSource: 'message',
    profileId: 'mock',
    workspace: '/depots/carnet',
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z',
    ...change
  })
  const summary = (r: ConversationRecord) =>
    summaryOf(
      { record: r, draft: false },
      [{ id: 'mock', label: 'Agent factice' }],
      () => undefined
    )

  it('hors worktree : son dossier de travail', () => {
    expect(summary(record()).project).toBe('/depots/carnet')
  })

  it('en worktree : la racine du dépôt, pas le dossier du worktree', () => {
    const inWorktree = record({
      workspace: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
      worktree: {
        root: '/depots/carnet',
        path: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
        branch: 'bobine/20261023-1747-ef93',
        base: 'abc123'
      }
    })
    expect(summary(inWorktree)).toMatchObject({
      project: '/depots/carnet',
      workspace: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
      branch: 'bobine/20261023-1747-ef93'
    })
  })
})
