import type { AgentEvent } from '@shared/agent'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { askReadOnly, automaticAnswer, type PermissionRules } from './permission-answers'
import { abs, ON_WINDOWS, tempDir } from '../test-platform'

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
      notify: (event: AgentEvent) => {
        if (event.type === 'notice' && typeof event.message === 'object')
          refused.push(String(event.message.params?.['tool'] ?? ''))
      },
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

  it('discussion (fiche 224) : réponse d’office dite dans le fil ; posée quand le dossier est inconnu', () => {
    const area = ON_WINDOWS ? tempDir('zone-') : realpathSync(mkdtempSync(join(tmpdir(), 'zone-')))
    const notes: AgentEvent[] = []
    const discussion = {
      autoAllowed: () => false,
      place: { workspace: area, home: '/maison' },
      writeArea: area,
      notify: (e: AgentEvent) => notes.push(e)
    } satisfies PermissionRules
    const at = (kind: 'edit' | 'execute', ...paths: string[]) => ({
      ...request(kind),
      toolCall: { ...request(kind).toolCall, locations: paths.map((path) => ({ path })) }
    })
    const yes = { outcome: { outcome: 'selected', optionId: 'yes' } }
    const no = { outcome: { outcome: 'selected', optionId: 'no' } }
    expect(automaticAnswer(at('edit', join(area, 'Synthèse.docx')), discussion)).toEqual(yes)
    expect(automaticAnswer(at('edit', abs('/tmp/ailleurs.md')), discussion)).toEqual(no)
    expect(automaticAnswer(at('execute', area), discussion)).toBeUndefined()
    expect(automaticAnswer(at('edit', '/absent/x'), { ...discussion, writeArea: '/absent' })).toBe(
      undefined
    )
    expect(notes.map((n) => (n.type === 'notice' ? n.level : ''))).toEqual(['info', 'warning'])
  })
})

describe('tour de table : participants et étapes (fiche 285, N8, S1)', () => {
  const yes = { outcome: { outcome: 'selected', optionId: 'yes' } }
  const no = { outcome: { outcome: 'selected', optionId: 'no' } }
  const at = (
    kind: RequestPermissionRequest['toolCall']['kind'],
    ...paths: string[]
  ): RequestPermissionRequest => ({
    ...request(kind),
    toolCall: { ...request(kind).toolCall, locations: paths.map((path) => ({ path })) }
  })

  it('N8 : un participant ne lit ou ne cherche d’office que dans son dossier ; tout le reste est refusé', () => {
    const { rules: participant, refused } = rules({
      readOnly: 'participant',
      place: { workspace: abs('/projet'), home: abs('/maison') },
      // Même un outil « toujours autorisé » ne passe pas : pas de carte pendant un tour.
      autoAllowed: () => true,
      remembered: { has: () => true }
    })
    expect(automaticAnswer(at('read', abs('/projet/src/a.ts')), participant)).toEqual(yes)
    expect(automaticAnswer(at('search', abs('/projet')), participant)).toEqual(yes)
    expect(automaticAnswer(at('read', 'src/relatif.ts'), participant)).toEqual(yes)
    const refusedCases = [
      at('read', abs('/maison/.ssh/id')),
      at('read', abs('/projet/a.ts'), abs('/ailleurs/b.ts')),
      at('read', abs('/projet/../ailleurs/b.ts')),
      at('read', abs('/projet-voisin/a.ts')),
      at('read'),
      at('fetch', abs('/projet/a.ts')),
      at('other', abs('/projet/a.ts')),
      at(undefined, abs('/projet/a.ts')),
      at('execute', abs('/projet')),
      at('edit', abs('/projet/a.ts')),
      at('think')
    ]
    for (const r of refusedCases) expect(automaticAnswer(r, participant)).toEqual(no)
    expect(refused).toHaveLength(refusedCases.length)
  })

  it('S1 : pendant la synthèse ou la décision, écrire, déplacer, supprimer, exécuter, changer de mode sont refusés', () => {
    const { rules: step, refused } = rules({ stepReadOnly: true, autoAllowed: () => true })
    for (const kind of ['edit', 'delete', 'move', 'execute', 'switch_mode'] as const)
      expect(automaticAnswer(request(kind), step)).toEqual(no)
    expect(refused).toHaveLength(5)
    // Une lecture reste possible (l'arbitre vérifie une affirmation décisive).
    expect(automaticAnswer(request('read'), step)).toEqual(yes)
    // Hors du tour de l'étape : la conversation redevient normale.
    const { rules: normal } = rules()
    expect(automaticAnswer(request('execute'), normal)).toBeUndefined()
  })
})
