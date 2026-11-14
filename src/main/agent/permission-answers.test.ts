import { describe, expect, it } from 'vitest'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { askReadOnly, automaticAnswer, type PermissionRules } from './permission-answers'

const OPTIONS: RequestPermissionRequest['options'] = [
  { optionId: 'yes', name: 'Allow once', kind: 'allow_once' },
  { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
  { optionId: 'no', name: 'Reject', kind: 'reject_once' }
]

const request = (
  kind: RequestPermissionRequest['toolCall']['kind'],
  options = OPTIONS
): RequestPermissionRequest => ({
  sessionId: 's',
  toolCall: { toolCallId: 't', title: `Outil ${kind}`, kind },
  options
})

function rules(extra: Partial<PermissionRules> = {}) {
  const refused: string[] = []
  return {
    refused,
    rules: {
      autoAllowed: () => false,
      place: { workspace: '/projet', home: '/maison' },
      onRefused: (toolCall: RequestPermissionRequest['toolCall']) =>
        refused.push(toolCall.title ?? ''),
      ...extra
    } satisfies PermissionRules
  }
}

describe('réponses automatiques aux demandes d’autorisation', () => {
  it('rôle en lecture seule (fiche 223) : écrire, supprimer, déplacer, changer de mode sont refusés', () => {
    const { rules: readOnly, refused } = rules({ readOnly: true })
    for (const kind of ['edit', 'delete', 'move', 'switch_mode'] as const) {
      expect(automaticAnswer(request(kind), readOnly)).toEqual({
        outcome: { outcome: 'selected', optionId: 'no' }
      })
    }
    expect(refused).toEqual(['Outil edit', 'Outil delete', 'Outil move', 'Outil switch_mode'])
  })

  it('le refus passe avant les outils de l’app et ceux « toujours autorisés »', () => {
    const { rules: readOnly } = rules({
      readOnly: true,
      autoAllowed: () => true,
      remembered: { has: () => true }
    })
    expect(automaticAnswer(request('edit'), readOnly)).toEqual({
      outcome: { outcome: 'selected', optionId: 'no' }
    })
  })

  it('sans option de refus, la demande est annulée', () => {
    const { rules: readOnly } = rules({ readOnly: true })
    const answer = automaticAnswer(request('edit', OPTIONS.slice(0, 2)), readOnly)
    expect(answer).toEqual({ outcome: { outcome: 'cancelled' } })
  })

  it('lecture, recherche et commandes restent à l’utilisateur ; hors lecture seule, rien n’est refusé', () => {
    const { rules: readOnly, refused } = rules({ readOnly: true })
    for (const kind of ['read', 'search', 'execute', 'fetch', 'other'] as const) {
      expect(automaticAnswer(request(kind), readOnly)).toBeUndefined()
    }
    expect(automaticAnswer(request('edit'), rules().rules)).toBeUndefined()
    expect(refused).toEqual([])
  })

  it('lecture seule : un outil « toujours autorisé » est quand même demandé (relecture)', () => {
    const { rules: readOnly } = rules({ readOnly: true, remembered: { has: () => true } })
    expect(automaticAnswer(request('other'), readOnly)).toBeUndefined()
    expect(
      automaticAnswer(request('other'), rules({ remembered: { has: () => true } }).rules)
    ).toEqual({ outcome: { outcome: 'selected', optionId: 'always' } })
  })
})

describe('demande posée à une fille en lecture seule (essais réels avant 1.0.0-beta.2)', () => {
  const answer = (optionId: string) => ({ outcome: { outcome: 'selected' as const, optionId } })

  it('les options « toujours » de l’agent ne sont pas proposées ; une réponse « toujours » part en « une fois »', async () => {
    let asked: RequestPermissionRequest | undefined
    const result = await askReadOnly(request('execute'), true, async (r) => {
      asked = r
      return answer('always')
    })
    expect(asked?.options.map((o) => o.kind)).toEqual(['allow_once', 'reject_once'])
    expect(result).toEqual(answer('yes'))
  })

  it('pas d’option « une fois » de même sens : « toujours » reste (seul choix) ; hors lecture seule, tel quel', async () => {
    const onlyAlways = request('execute', [
      { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
      { optionId: 'no', name: 'Reject', kind: 'reject_once' }
    ])
    let asked: RequestPermissionRequest | undefined
    await askReadOnly(onlyAlways, true, async (r) => {
      asked = r
      return answer('no')
    })
    expect(asked?.options.map((o) => o.optionId)).toEqual(['always', 'no'])
    const plain = request('execute')
    expect(
      await askReadOnly(plain, false, async (r) => answer(r.options[1]?.optionId ?? ''))
    ).toEqual(answer('always'))
  })
})
