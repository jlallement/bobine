import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { byProject, heldOrder, nestChildren } from './history-order'

const conversation = (id: string, from?: string): ConversationSummary => ({
  id,
  title: id,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: '/projet',
  updatedAt: '2026-10-20T18:00:00.000Z',
  status: 'stopped',
  draft: false,
  ...(from ? { branchedFrom: { id: from, title: from } } : {})
})
const ids = (items: readonly { id: string }[]) => items.map((c) => c.id).join(' ')
/** `↳` devant une fille sous sa mère ; `^` sur la première, `$` sur la dernière. */
const rows = (items: ConversationSummary[]) =>
  nestChildren(items)
    .map(
      (r) => `${r.nested ? '↳' : ''}${r.conversation.id}${r.first ? '^' : ''}${r.last ? '$' : ''}`
    )
    .join(' ')

describe('ordre figé de la liste (fiche 095)', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => conversation(id)) as [
    ConversationSummary,
    ConversationSummary,
    ConversationSummary,
    ConversationSummary
  ]

  it('garde l’ordre figé quand l’activité retrie la liste', () => {
    expect(ids(heldOrder([c, a, b], ['a', 'b', 'c']))).toBe('a b c')
  })

  it('met les nouvelles à la fin, sans rien décaler ; oublie les disparues', () => {
    expect(ids(heldOrder([d, c, a], ['a', 'b', 'c']))).toBe('a c d')
  })

  it('sans ordre figé : l’ordre reçu', () => {
    expect(ids(heldOrder([c, a, b], null))).toBe('c a b')
  })
})

describe('branches à plat (fiche 131)', () => {
  it('une branche garde sa place : elle n’est plus rangée sous son origine', () => {
    expect(
      rows([conversation('b1', 'a'), conversation('x'), conversation('a'), conversation('b2', 'a')])
    ).toBe('b1 x a b2')
  })
})

describe('conversations filles sous leur mère (fiches 097, 131)', () => {
  const child = (id: string, mother: string, project = '/projet'): ConversationSummary => ({
    ...conversation(id),
    workspace: `/worktrees/${id}`,
    project,
    branch: `bobine/${id}`,
    startedFrom: { id: mother, title: mother }
  })

  it('range chaque fille sous sa mère, première et dernière marquées ; pas la branche', () => {
    expect(
      rows([
        child('f1', 'm'),
        conversation('x'),
        conversation('m'),
        child('f2', 'm'),
        conversation('b', 'm')
      ])
    ).toBe('x m ↳f1^ ↳f2$ b')
  })

  it('une seule fille : première et dernière', () => {
    expect(rows([conversation('m'), child('f', 'm')])).toBe('m ↳f^$')
  })

  it('la fille d’une fille suit la mère, au même niveau', () => {
    expect(rows([child('ff', 'f'), conversation('m'), child('f', 'm')])).toBe('m ↳f^ ↳ff$')
  })

  it('mère absente de la section : la fille garde sa place', () => {
    expect(rows([conversation('x'), child('f', 'ailleurs')])).toBe('x f')
  })

  it('filles qui se citent en boucle : aucune ne disparaît', () => {
    expect(rows([child('p', 'q'), child('q', 'p')])).toBe('p ↳q^$')
  })
})

describe('regroupement par projet (fiche 131)', () => {
  const groups = (items: ConversationSummary[]) =>
    byProject(items)
      .map((g) => `${g.project}: ${ids(g.items)}`)
      .join(' | ')
  const at = (id: string, workspace: string, change: Partial<ConversationSummary> = {}) => ({
    ...conversation(id),
    workspace,
    ...change
  })

  it('par projet, pas par dossier de worktree ; une fille dans le dossier de sa mère', () => {
    expect(
      groups([
        at('f1', '/wt/f1', { project: '/carnet', startedFrom: { id: 'm', title: 'm' } }),
        at('n', '/notes'),
        at('m', '/carnet/app'),
        at('w', '/wt/w', { project: '/carnet' }),
        at('f2', '/wt/f2', { project: '/carnet', startedFrom: { id: 'm', title: 'm' } })
      ])
    ).toBe('/carnet/app: f1 m f2 | /notes: n | /carnet: w')
  })

  it('sans projet (données anciennes) : le dossier de travail', () => {
    expect(groups([at('a', '/a'), at('b', '/b'), at('c', '/a')])).toBe('/a: a c | /b: b')
  })
})
