/**
 * Tour de table (fiche 285) : ce que l'interface dit, sans rendu — forme de la ligne et Entrée,
 * infobulle, cases du menu (bornes, ordre stable, recherche), pied « Consommé », lettres, réponses
 * d'un participant, tours de synthèse et de décision.
 */
import { describe, expect, it } from 'vitest'
import {
  roundtableTotal,
  toggleChoice,
  type RoundtableChoice,
  type RoundtableSeat
} from '@shared/roundtable'
import type { RoundtableAgentOption } from '@shared/roundtable-ipc'
import type { TranscriptItem } from '@shared/transcript'
import { workLayout } from '@shared/work-groups'
import {
  agentOnly,
  enterAction,
  letterNames,
  lineState,
  menuEntries,
  participantGroups,
  rebuttalSummary,
  roundtableTurns,
  searchEntries,
  seatElapsed,
  seatReports,
  sendsKey,
  totalText
} from './roundtable-view'
import { answered, opinion, options, roundtable, T0, thread } from './test-fixtures'

const deep: RoundtableChoice = {
  profileId: 'agent-a',
  model: { controlId: 'model', value: 'deep', name: 'vendor/DeepSeek V4.1 Flash' }
}
const glm: RoundtableChoice = {
  profileId: 'agent-a',
  model: { controlId: 'model', value: 'glm', name: 'GLM 5.3 Flash' }
}
const b: RoundtableChoice = { profileId: 'agent-b' }
const other = (value: string): RoundtableChoice => ({
  profileId: 'agent-a',
  model: { controlId: 'model', value, name: value }
})

describe('ligne du tour de table', () => {
  it('premier usage : moins de deux participants, Entrée ouvre le menu', () => {
    expect(lineState([], options())).toEqual({ kind: 'choose' })
    expect(lineState([deep], options())).toEqual({ kind: 'choose' })
    expect(enterAction(lineState([], undefined))).toBe('menu')
  })

  it('prête dès deux participants : N + 1 fois les jetons, Entrée envoie', () => {
    const state = lineState([deep, glm, b], options())
    expect(state).toEqual({ kind: 'ready', count: 3, multiplier: 4 })
    expect(enterAction(state)).toBe('send')
    // Options pas encore lues : seule la quantité compte (le main vérifie à l'envoi).
    expect(lineState([deep, b], undefined)).toEqual({ kind: 'ready', count: 2, multiplier: 3 })
  })

  it('question plus longue que la borne : dite avant l’envoi, Entrée ne fait rien', () => {
    expect(lineState([deep, b], options(), 8_000).kind).toBe('ready')
    const state = lineState([deep, b], options(), 8_001)
    expect(state).toEqual({ kind: 'question', max: 8_000 })
    expect(enterAction(state)).toBe('none')
  })

  it('places manquantes : la ligne le dit, rien ne part', () => {
    const state = lineState([deep, glm, b], options({ freeSlots: 1 }))
    expect(state).toEqual({ kind: 'slots', missing: 2, count: 3 })
    expect(enterAction(state)).toBe('none')
  })

  it('participant devenu indisponible : nommé, Entrée ouvre le menu', () => {
    const opts = options()
    opts.agents[1] = {
      ...(opts.agents[1] as RoundtableAgentOption),
      available: false,
      reason: 'retiré'
    }
    const state = lineState([deep, b], opts)
    expect(state).toEqual({ kind: 'unavailable', agent: 'Agent B' })
    expect(enterAction(state)).toBe('menu')
    // Agent retiré : un libellé générique, jamais son identifiant brut.
    expect(lineState([deep, { profileId: 'gone' }], options())).toEqual({
      kind: 'unavailable',
      agent: 'Un agent retiré'
    })
    // Modèle sorti du catalogue, ou modèle sur un agent qui n'en laisse pas choisir.
    expect(lineState([deep, other('retired')], options())).toEqual({
      kind: 'unavailable',
      agent: 'retired'
    })
    expect(lineState([deep, { ...b, model: deep.model }], options())).toMatchObject({
      kind: 'unavailable'
    })
  })

  it('refus du main (travail, archivée, discussion, tour en cours) : avant tout le reste', () => {
    for (const refused of ['task', 'archived', 'discussion', 'running'] as const) {
      const state = lineState([deep, b], options({ refused }))
      expect(state).toEqual({ kind: 'refused', refused })
      expect(enterAction(state)).toBe('none')
    }
  })

  it('infobulle : les modèles groupés par agent, leur destination, jamais un identifiant brut', () => {
    // `vendor` n'est qu'un préfixe de modèle : l'agent suffit ; un service déclaré se dit.
    expect(participantGroups([deep, glm, b], options())).toEqual([
      { agent: 'Agent A', models: ['DeepSeek V4.1 Flash', 'GLM 5.3 Flash'], destinations: [] },
      { agent: 'Agent B', models: ['Agent B'], destinations: ['service en ligne B'] }
    ])
    expect(sendsKey(false, false)).toBe('roundtable.line.sendsQuestion')
    expect(sendsKey(true, false)).toBe('roundtable.line.sendsFiles')
    expect(sendsKey(false, true)).toBe('roundtable.line.sendsExchange')
    expect(sendsKey(true, true)).toBe('roundtable.line.sendsAll')
  })
})

describe('menu des participants', () => {
  it('récents d’abord, une seule ligne pour un agent sans choix de modèle, les autres derrière', () => {
    const { main, others } = menuEntries(options(), [deep, b])
    expect(main.map((e) => [e.label, e.agentLabel, e.checked])).toEqual([
      ['DeepSeek V4.1 Flash', 'Agent A', true],
      ['GLM 5.3 Flash', 'Agent A', false],
      ['Agent B', 'Agent B', true]
    ])
    expect(main[2]?.choice).toEqual({ profileId: 'agent-b' })
    expect(others.map((e) => e.label)).toEqual([
      'MiMo v2.6 Flash',
      'Nemotron 3.5 Super',
      'Qwen3 32B'
    ])
  })

  it('un retenu qui n’existe plus : en tête, coché, décochable, avec sa raison', () => {
    const { main } = menuEntries(options(), [deep, other('retired'), { profileId: 'gone' }])
    expect(
      main
        .slice(0, 2)
        .map((e) => [e.label, e.checked, e.disabled, e.reason?.replace(/[\u00a0\u202f]/g, ' ')])
    ).toEqual([
      ['retired', true, undefined, 'Modèle indisponible : décochez-le'],
      ['Un agent retiré', true, undefined, 'N’existe plus : décochez-le']
    ])
    // Décocher retire le couple tel qu'il est retenu, modèle compris.
    const orphan = main[0] as (typeof main)[number]
    expect(toggleChoice([deep, other('retired')], orphan.choice, orphan.modelChoice)).toEqual([
      deep
    ])
  })

  it('un modèle coché parmi les autres est montré avec les récents', () => {
    const { main, others } = menuEntries(options(), [deep, other('qwen')])
    expect(main.map((e) => e.label)).toContain('Qwen3 32B')
    expect(others.map((e) => e.label)).not.toContain('Qwen3 32B')
  })

  it('5 cochés : les autres cases désactivées, avec la raison ; les cochées restent', () => {
    const five = [deep, glm, b, other('mimo'), other('nemo')]
    const { main, others } = menuEntries(options(), five)
    expect(main.every((e) => e.checked && !e.disabled)).toBe(true)
    expect(others.map((e) => [e.label, e.disabled, e.reason])).toEqual([
      ['Qwen3 32B', 'full', '5 participants au plus']
    ])
  })

  it('agent non installé : absent du menu ; déjà retenu, en tête avec sa raison', () => {
    const opts = options()
    opts.agents[1] = {
      ...(opts.agents[1] as RoundtableAgentOption),
      available: false,
      reason: 'Non installé'
    }
    const all = (choices: RoundtableChoice[]) => {
      const { main, others } = menuEntries(opts, choices)
      return [...main, ...others]
    }
    expect(all([]).some((e) => e.agentLabel === 'Agent B')).toBe(false)
    const kept = all([{ profileId: 'agent-b' }]).find((e) => e.agentLabel === 'Agent B')
    expect(kept).toMatchObject({ checked: true, reason: 'Non installé' })
  })

  it('aucune mention de gratuité ni de prix dans les cases', () => {
    const { main, others } = menuEntries(options(), [])
    const text = JSON.stringify([...main, ...others])
    expect(text).not.toMatch(/gratuit|free|prix|price|\$/i)
  })

  it('recherche sans casse ni accents, sur le modèle et l’agent', () => {
    const { others } = menuEntries(options(), [])
    expect(searchEntries(others, 'NEMO').map((e) => e.label)).toEqual(['Nemotron 3.5 Super'])
    expect(searchEntries(others, 'agent a')).toHaveLength(3)
    expect(searchEntries(others, '')).toHaveLength(3)
  })
})

describe('pied « Consommé »', () => {
  /** Espaces insécables de la typographie française ramenées à des espaces. */
  const plain = (text: string | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

  it('jetons traités (entrée + sortie) en abrégé, coûts par unité, sans conversion (fiche 292)', () => {
    const total = roundtableTotal([
      { input: 19_000, output: 1_000, total: 60_000, cost: { amount: 0.02, currency: 'USD' } },
      undefined,
      { input: 27_000, output: 512 },
      { cost: { amount: 0.42, currency: 'bobcoins' } }
    ])
    const text = plain(totalText(total))
    expect(text).toMatch(/^47,5k jetons · /)
    expect(text).toContain('0,42 Bobcoins')
  })

  it('modèles gratuits à 0 $ : « gratuit », jamais « coût inconnu » (recette de la 1.2.0-beta.1, G-B1)', () => {
    const zero = { amount: 0, currency: 'USD' }
    const free = roundtableTotal([
      { input: 30_000, output: 0, cost: zero, free: true },
      { input: 34_000, output: 0, cost: zero, free: true },
      { input: 69_000, output: 1_000, cost: zero, free: true }
    ])
    expect(plain(totalText(free))).toBe('134k jetons · gratuit')
    // Tour mixte : « gratuit + 0,21 Bobcoins ».
    const mixed = roundtableTotal([
      { input: 30_000, output: 0, cost: zero, free: true },
      { cost: { amount: 0.2134, currency: 'bobcoins' } }
    ])
    expect(totalText(mixed)).toContain('gratuit + 0,21')
    // Un coût nul d'un modèle qui ne se dit pas gratuit reste inconnu.
    const paid = roundtableTotal([
      { input: 10, cost: zero },
      { input: 10, cost: zero, free: true }
    ])
    expect(totalText(paid)).toContain('coût inconnu')
  })

  it('coût connu pour certains seulement : « + coût inconnu », comme le compteur (testeur, T8)', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' })
    const total = roundtableTotal([
      { input: 1_000, output: 200, cost: usd(0.0125) },
      // Participant qui donne ses jetons, pas son coût (agent sans coût, comme Codex).
      { input: 1_000, output: 200 },
      { input: 900, output: 100, cost: usd(0.0125) }
    ])
    expect(plain(totalText(total))).toBe('3,4k jetons · ≈ 0,025 $US + coût inconnu')
    // Personne ne donne de coût : rien de partiel à dire.
    expect(plain(totalText(roundtableTotal([{ input: 10, output: 0 }])))).toBe('10 jetons')
  })

  it('très petit coût payant : jamais « coût inconnu » (arrondi du total, testeur)', () => {
    const tiny = roundtableTotal([
      { input: 10, output: 5, cost: { amount: 0.0000004, currency: 'USD' } }
    ])
    expect(tiny.costs[0]?.amount).toBeGreaterThan(0)
    expect(totalText(tiny)).not.toContain('coût inconnu')
  })

  it('rien de communiqué : pas de pied', () => {
    expect(totalText(roundtableTotal([undefined, undefined]))).toBeUndefined()
  })
})

describe('lettres, réponses, durées', () => {
  it('table des lettres : le vrai nom, avec l’agent quand il diffère', () => {
    expect(letterNames(roundtable().seats)).toEqual({
      A: 'DeepSeek V4.1 Flash · Agent A',
      B: 'GLM 5.3 Flash · Agent A',
      C: 'Agent B'
    })
  })

  it('avis et réplique désignés par l’heure d’envoi (askedAt), jamais par l’ordre', () => {
    const rt = roundtable([answered('A')])
    const seat = rt.seats[0] as RoundtableSeat
    const items = thread(rt, { A: [opinion('pg-boss')] })
    // Un compte rendu d'avant (erreur puis relance) et un d'après (message de l'utilisateur).
    const extra = (id: number, reply: string, askedAt: number, outcome = 'done') =>
      ({
        kind: 'child-report',
        id,
        childId: 'child-A',
        title: 'x',
        outcome,
        files: [],
        fileCount: 0,
        added: 0,
        removed: 0,
        excerpt: reply,
        reply,
        askedAt,
        at: T0 + 99
      }) as TranscriptItem
    items.splice(4, 0, extra(90, 'erreur', seat.askedAt ?? 0, 'error'))
    items.push(extra(91, 'Suite libre', T0 + 9_999))
    const work = workLayout(items).roundtables.get(1)?.works.get('A')
    expect(seatReports(work, seat).opinion?.reply).toContain('pg-boss')
    expect(seatReports(work, seat).rebuttal).toBeUndefined()
    // Réplique demandée : la réponse dont l'heure d'envoi est celle de la réplique.
    const later = { ...seat, rebuttal: { state: 'answered' as const, askedAt: T0 + 9_999 } }
    expect(seatReports(work, later).rebuttal?.reply).toBe('Suite libre')
    // Sans heure connue : rien n'est deviné.
    expect(seatReports(work, { rebuttal: undefined })).toEqual({})
    expect(seatReports(undefined, seat)).toEqual({})
  })

  it('résumé d’une réplique : la première ligne après sa position', () => {
    expect(rebuttalSummary('**Position :** nuance\n\n- D’accord pour pg-boss à ce volume.')).toBe(
      'D’accord pour pg-boss à ce volume.'
    )
    expect(rebuttalSummary('Position: maintient')).toBeUndefined()
  })

  it('durée : depuis le départ en cours, du départ à la fin une fois fini', () => {
    expect(seatElapsed({ startedAt: T0, state: 'working' }, T0 + 5_000)).toBe(5_000)
    expect(
      seatElapsed({ startedAt: T0, endedAt: T0 + 51_000, state: 'answered' }, T0 + 99_000)
    ).toBe(51_000)
    expect(seatElapsed({ state: 'waiting' }, T0)).toBeUndefined()
  })
})

describe('tours de synthèse et de décision', () => {
  it('les réponses de l’agent après une demande du tour, jusqu’au message suivant', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'question' },
      { kind: 'agent', id: 2, text: 'réponse' },
      {
        kind: 'user',
        id: 3,
        text: 'synthesize',
        from: { kind: 'roundtable', id: 'rt1', title: 'q', step: 'synthesis' }
      },
      { kind: 'agent', id: 4, text: 'Accords' },
      { kind: 'agent', id: 5, text: 'Ma recommandation' },
      { kind: 'user', id: 6, text: 'merci' },
      { kind: 'agent', id: 7, text: 'de rien' }
    ]
    const turns = roundtableTurns(items)
    expect(turns.byRequest.get(3)).toMatchObject({ step: 'synthesis', answers: [4, 5] })
    expect(turns.byAnswer.get(5)?.roundtableId).toBe('rt1')
    expect(turns.byAnswer.has(2)).toBe(false)
    expect(turns.byAnswer.has(7)).toBe(false)
  })

  it('la réplique (conversation du participant) : une demande, aucune réponse encadrée', () => {
    const turns = roundtableTurns([
      {
        kind: 'user',
        id: 1,
        text: 'Rebuttal round',
        from: { kind: 'roundtable', id: 'rt1', title: 'q', step: 'rebuttal' }
      },
      { kind: 'agent', id: 2, text: 'Position : maintenue' }
    ])
    expect(turns.byRequest.get(1)?.step).toBe('rebuttal')
    expect(turns.byAnswer.size).toBe(0)
  })
})

describe('l’arbitre ne participe pas (décision du 2026-11-25)', () => {
  const all = (opts: ReturnType<typeof options>, choices: RoundtableChoice[] = []) => {
    const { main, others } = menuEntries(opts, choices)
    return [...main, ...others]
  }

  it('le modèle de la conversation : désactivé dans le menu, avec sa raison', () => {
    const opts = options({ arbiter: { profileId: 'agent-a', model: 'glm' } })
    const glm = all(opts).find((e) => e.choice.model?.value === 'glm')
    expect(glm?.disabled).toBe('arbiter')
    expect(glm?.reason?.replace(/[\u00a0\u202f]/g, ' ')).toBe(
      'C’est le modèle de cette conversation : il fait la synthèse'
    )
    expect(all(opts).find((e) => e.choice.model?.value === 'deep')?.disabled).toBeUndefined()
  })

  it('modèle de la conversation hors des récents (jamais répondu) : dans la liste principale (fix18)', () => {
    // Choisi dans la puce, il n'a encore répondu à rien : pas un récent (E7), mais toujours montré,
    // désactivé avec sa raison, pas rangé sous « Autres modèles… ».
    const { main, others } = menuEntries(
      options({ arbiter: { profileId: 'agent-a', model: 'nemo' } }),
      []
    )
    expect(main.find((e) => e.choice.model?.value === 'nemo')?.disabled).toBe('arbiter')
    expect(others.some((e) => e.choice.model?.value === 'nemo')).toBe(false)
  })

  it('profil neuf, aucun récent : les modèles annoncés restent proposés (fix18)', () => {
    const fresh = options({ arbiter: { profileId: 'agent-a', model: 'nemo' } })
    const a = fresh.agents[0] as RoundtableAgentOption
    fresh.agents[0] = { ...a, recent: [], others: [...a.recent, ...a.others] }
    const { main, others } = menuEntries(fresh, [])
    expect(main.map((e) => e.choice.model?.value ?? e.agentLabel)).toEqual(['nemo', 'Agent B'])
    // Les autres, cochables, sous « Autres modèles… » (recherche comprise) : deux au moins.
    expect(others.filter((e) => !e.disabled).length).toBeGreaterThanOrEqual(2)
  })

  it('un agent sans choix de modèle qui arbitre : montré désactivé, même indisponible', () => {
    const opts = options({ arbiter: { profileId: 'agent-b' } })
    opts.agents[1] = { ...(opts.agents[1] as RoundtableAgentOption), available: false, reason: 'x' }
    const entry = all(opts).find((e) => e.agentLabel === 'Agent B')
    expect(entry).toMatchObject({ disabled: 'arbiter' })
  })

  it('un retenu devenu l’arbitre : la ligne le dit, Entrée ouvre le menu', () => {
    const glm = {
      profileId: 'agent-a',
      model: { controlId: 'model', value: 'glm', name: 'GLM 5.3 Flash' }
    }
    const state = lineState(
      [glm, { profileId: 'agent-b' }],
      options({ arbiter: { profileId: 'agent-a', model: 'glm' } })
    )
    expect(state).toEqual({ kind: 'arbiter', name: 'GLM 5.3 Flash' })
    expect(enterAction(state)).toBe('menu')
  })
})

describe('modèle par défaut (contre-recette N2)', () => {
  it('infobulle : « <agent> · modèle par défaut », sans « · par <agent> »', () => {
    const [group] = participantGroups([{ profileId: 'agent-a' }], options())
    expect(group?.models).toEqual(['Agent A · modèle par défaut'])
    expect(group && agentOnly(group)).toBe(true)
  })
})

describe('infobulle des participants (revue finale, M15)', () => {
  it('chaque agent dit où vont les données, même quand son modèle ne le dit pas', () => {
    const opts = options()
    opts.agents[0] = {
      ...(opts.agents[0] as RoundtableAgentOption),
      destination: { kind: 'agent', text: 'service A' }
    }
    const groups = participantGroups(
      [
        { profileId: 'agent-a', model: { controlId: 'model', value: 'deep', name: 'DeepSeek' } },
        { profileId: 'agent-b' }
      ],
      opts
    )
    expect(groups.map((g) => g.destinations)).toEqual([['service A'], ['service en ligne B']])
  })
})
