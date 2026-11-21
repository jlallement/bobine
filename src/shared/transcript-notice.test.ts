import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent'
import { emptyTranscript, reduceTranscript } from './transcript'
import { withoutCardedRefusal } from './transcript-notice'

/**
 * Avis d'un message refusé (fiches 210, 259) : vrai jusqu'à la réponse suivante de l'agent. D6 de
 * l'exploration du 2026-11-19 : « … pas connecté à son fournisseur » restait affiché après la
 * connexion, quand le tour suivant était refusé pour une autre raison.
 */
const refused = (key: 'agentHost.modelAuthRefused' | 'agentHost.modelUnavailable'): AgentEvent => ({
  type: 'notice',
  level: 'warning',
  message: { key, params: { agent: 'OpenCode', model: 'GPT' } },
  refusal: true
})

const notices = (events: AgentEvent[]) =>
  events
    .reduce(reduceTranscript, emptyTranscript)
    .items.flatMap((i) => (i.kind === 'notice' ? [i.message?.key ?? i.text] : []))

const user: AgentEvent = { type: 'user-message', text: 'Ajoute un test' }

describe('avis d’un refus au tour (fiche 259)', () => {
  it('remplacé par l’avis d’un nouveau refus : un seul à la fois', () => {
    expect(
      notices([user, refused('agentHost.modelAuthRefused'), refused('agentHost.modelUnavailable')])
    ).toEqual(['agentHost.modelUnavailable'])
  })

  it('retiré quand l’agent répond (tour fini)', () => {
    expect(
      notices([
        user,
        refused('agentHost.modelAuthRefused'),
        { type: 'turn-end', stopReason: 'end_turn' }
      ])
    ).toEqual([])
  })

  it('retiré par une autre erreur du tour, qui dit la sienne', () => {
    expect(
      notices([
        user,
        refused('agentHost.modelAuthRefused'),
        { type: 'turn-error', message: 'boum' }
      ])
    ).toEqual(['transcript.notice.error'])
  })

  it('les autres avis ne bougent pas', () => {
    const other: AgentEvent = { type: 'notice', level: 'info', message: 'Contexte compacté' }
    expect(
      notices([
        other,
        user,
        refused('agentHost.modelAuthRefused'),
        { type: 'turn-end', stopReason: 'end_turn' },
        { type: 'notice', level: 'warning', message: 'Sans marque' },
        { type: 'turn-end', stopReason: 'end_turn' }
      ])
    ).toEqual(['Contexte compacté', 'Sans marque'])
  })

  it('l’élément du fil garde la marque (fil relu après un redémarrage)', () => {
    const state = [user, refused('agentHost.modelUnavailable')].reduce(
      reduceTranscript,
      emptyTranscript
    )
    expect(state.items.at(-1)).toMatchObject({ kind: 'notice', refusal: true })
  })
})

describe('avis d’un refus et sa carte (fiche 267, revue UX)', () => {
  const items = [user, refused('agentHost.modelUnavailable')].reduce(
    reduceTranscript,
    emptyTranscript
  ).items
  const card = {
    status: 'needs-action' as const,
    blocker: { kind: 'auth' as const, methods: [], authenticating: false, atTurn: true as const }
  }
  it('pas d’avis en double tant que la carte est à l’écran', () => {
    expect(withoutCardedRefusal(items, card).some((i) => i.kind === 'notice')).toBe(false)
    expect(withoutCardedRefusal(items, card).some((i) => i.kind === 'user')).toBe(true)
  })
  it('carte partie : l’avis reste jusqu’à la réponse suivante', () => {
    expect(withoutCardedRefusal(items, { status: 'busy' }).some((i) => i.kind === 'notice')).toBe(
      true
    )
  })
})

describe('avis de l’interface redonné (recette de la rc.3)', () => {
  const local = (message: string, extra: Partial<Extract<AgentEvent, { type: 'notice' }>> = {}) =>
    ({ type: 'notice', level: 'error', message, local: true, ...extra }) as AgentEvent
  const shown = (events: AgentEvent[]) =>
    events
      .reduce(reduceTranscript, emptyTranscript)
      .items.flatMap((i) => (i.kind === 'notice' ? [`${i.level}|${i.title ?? ''}|${i.text}`] : []))

  it('le même avis dans le tour : seul le plus récent remplacé, en bas', () => {
    expect(shown([user, local('x'), local('y'), local('x')])).toEqual(['error||y', 'error||x'])
  })

  it('niveau ou titre différent : un autre avis ; un tour précédent garde le sien', () => {
    expect(
      shown([
        user,
        local('x', { title: 'Contexte' }),
        local('x'),
        local('x', { level: 'info' }),
        local('x', { title: 'Contexte' })
      ])
    ).toEqual(['error||x', 'info||x', 'error|Contexte|x'])
    expect(shown([user, local('x'), user, local('x')])).toEqual(['error||x', 'error||x'])
  })

  it('un avis de l’agent au même texte n’est jamais retiré', () => {
    const agent: AgentEvent = { type: 'notice', level: 'error', message: 'x' }
    expect(shown([user, agent, local('x'), local('x')])).toEqual(['error||x', 'error||x'])
  })
})
