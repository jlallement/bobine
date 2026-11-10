import { describe, expect, it } from 'vitest'
import {
  activeChildren,
  capabilitiesContext,
  CHILDREN_REQUEST,
  childContext,
  childDecisionContent,
  childProposalGroups,
  childProposalSchema,
  parseChildDecision,
  childNews,
  childReport,
  childState,
  originContext,
  childRecommendations,
  recommendedIds,
  replyRecap,
  recapLead,
  LEAD_CHARS,
  reportLine,
  REPORT_CHARS,
  RECAP_CHARS,
  sameOrigin,
  type ChildReport
} from './children'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from './transcript'

const child = { id: 'f1', title: 'Import CSV', branch: 'bobine/x', workspace: '/depot/.wt/x' }

const report: ChildReport = {
  childId: 'f1',
  title: 'Import CSV',
  outcome: 'done',
  branch: 'bobine/x',
  files: [{ path: 'src/import.ts', added: 40, removed: 2 }],
  fileCount: 1,
  added: 40,
  removed: 2,
  excerpt: 'Les tests passent.',
  at: 2
}

describe('conversations filles (fiche 097)', () => {
  it('récapitulatif : le début de la réponse, lignes vides retirées, borné (fiche 160)', () => {
    expect(replyRecap('\nun\n\ndeux\ntrois\n')).toBe('un\ndeux\ntrois')
    const long = replyRecap('x'.repeat(1000))
    expect(long.length).toBe(RECAP_CHARS)
    expect(long.endsWith('…')).toBe(true)
    // Coupé sur un blanc quand il y en a un assez loin.
    const words = replyRecap('mot '.repeat(200))
    expect(words.length).toBeLessThanOrEqual(RECAP_CHARS)
    expect(words).toMatch(/mot…$/)
  })

  it('compte rendu : fichiers relatifs au dossier de la fille, issue, fin de la réponse', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Fais' },
      {
        kind: 'tool',
        id: 2,
        toolCallId: 't',
        title: 'Écrit',
        status: 'completed',
        content: [{ type: 'diff', path: '/depot/.wt/x/a.ts', oldText: 'a\n', newText: 'a\nb\n' }],
        locations: []
      },
      { kind: 'agent', id: 3, text: 'Fait.\nTout passe.' }
    ]
    expect(childReport(child, items, { stopReason: 'end_turn' }, 5)).toEqual({
      childId: 'f1',
      title: 'Import CSV',
      outcome: 'done',
      branch: 'bobine/x',
      files: [{ path: 'a.ts', added: 1, removed: 0 }],
      fileCount: 1,
      added: 1,
      removed: 0,
      excerpt: 'Fait.\nTout passe.',
      at: 5
    })
    expect(childReport(child, items, { stopReason: 'cancelled' }).outcome).toBe('stopped')
    expect(childReport(child, items, { error: 'Plus de budget' })).toMatchObject({
      outcome: 'error',
      excerpt: 'Plus de budget'
    })
    // Rien écrit pendant le dernier tour : pas d'extrait d'un tour précédent.
    const silent = [...items, { kind: 'user', id: 4, text: 'Encore' } as const]
    expect(childReport(child, silent, { stopReason: 'end_turn' }).excerpt).toBe('')
  })

  it('les nouvelles à transmettre sont celles d’après le dernier message de l’utilisateur', () => {
    let state = reduceTranscript(emptyTranscript, { type: 'user-message', text: 'Avant' })
    state = reduceTranscript(state, {
      type: 'child-started',
      child: { childId: 'f1', title: 'Import CSV', branch: 'bobine/x', prompt: 'Fais', at: 1 }
    })
    expect(childNews(state.items).map((n) => n.kind)).toEqual(['child-started'])
    state = reduceTranscript(state, { type: 'child-report', report })
    expect(state.items.at(-1)).toMatchObject({ kind: 'child-report', childId: 'f1', id: 3 })
    expect(childNews(state.items).map((n) => n.kind)).toEqual(['child-started', 'child-report'])
    state = reduceTranscript(state, { type: 'user-message', text: 'Après' })
    expect(childNews(state.items)).toEqual([])
  })

  it('contexte pour l’agent de la mère : lancements et comptes rendus, en anglais', () => {
    expect(childContext([])).toBeUndefined()
    const text = childContext([
      {
        kind: 'child-started',
        id: 1,
        childId: 'f1',
        title: 'Import CSV',
        branch: 'bobine/x',
        prompt: 'Ajoute un import.\nAvec des tests.',
        at: 1
      },
      { kind: 'child-report', id: 2, ...report },
      {
        kind: 'child-report',
        id: 3,
        ...report,
        outcome: 'error',
        fileCount: 0,
        files: [],
        excerpt: 'Boom'
      }
    ])
    expect(text).toContain('<child_conversations>')
    expect(text).toContain(
      'I started the child conversation "Import CSV" on branch bobine/x, with this instruction:\n  > Ajoute un import.\n  > Avec des tests.'
    )
    expect(text).toContain(
      'finished its turn. 1 file(s) changed so far (+40 −2): src/import.ts (+40 −2).'
    )
    expect(text).toContain('Start of its last reply:\n  > Les tests passent.')
    // Le compte rendu n'est pas une preuve (fiche 160).
    expect(text).toContain('not proof')
    expect(text).toContain('recommend_merge')
    expect(text).toContain('the user merges')
    expect(text).toContain('ended its turn with an error. No files changed so far.')
    expect(text).toContain('Error:\n  > Boom')
    expect(text?.endsWith('</child_conversations>')).toBe(true)
  })

  it('état d’une fille pour la liste et la carte', () => {
    expect(childState({ status: 'busy' })).toBe('running')
    expect(childState({ status: 'starting' })).toBe('running')
    expect(childState({ status: 'busy' }, 'request')).toBe('waiting')
    expect(childState({ status: 'needs-action' })).toBe('waiting')
    expect(childState({ status: 'ready' }, 'error')).toBe('error')
    expect(childState({ status: 'exited' })).toBe('error')
    expect(childState({ status: 'ready' }, 'done')).toBe('unread')
    expect(childState({ status: 'stopped' })).toBe('done')
  })

  it('filles en cours d’une mère (ADR-0020) : celles qui travaillent ou attendent', () => {
    const of = (id: string, status: 'busy' | 'ready' | 'starting', mother = 'm') => ({
      id,
      status,
      startedFrom: { id: mother, title: mother }
    })
    const list = [
      of('a', 'busy'),
      of('b', 'ready'),
      of('c', 'starting'),
      of('d', 'ready'),
      of('e', 'busy', 'autre'),
      { id: 'm', status: 'busy' as const }
    ]
    expect(activeChildren('m', list, {})).toBe(2)
    // Une fille au repos qui attend une réponse de l'utilisateur compte aussi.
    expect(activeChildren('m', list, { d: 'request', b: 'done' })).toBe(3)
  })

  it('provenance d’un message : comparaison, contexte pour l’agent', () => {
    const parent = { kind: 'parent', id: 'm', title: 'Carnet' } as const
    expect(sameOrigin(undefined, undefined)).toBe(true)
    expect(sameOrigin(parent, { ...parent, title: 'Renommée' })).toBe(true)
    expect(sameOrigin(parent, undefined)).toBe(false)
    expect(sameOrigin(parent, { kind: 'child', id: 'm', title: 'x' })).toBe(false)
    expect(sameOrigin({ kind: 'wake' }, { kind: 'wake' })).toBe(true)
    expect(originContext(parent)).toContain(
      'comes from your parent conversation "Carnet" (the conversation that started you)'
    )
    expect(originContext(parent)).toContain('message_parent')
    expect(originContext({ kind: 'child', id: 'f', title: 'Import' })).toContain(
      'comes from your child conversation "Import" (id: f)'
    )
    expect(originContext({ kind: 'wake' })).toBeUndefined()
  })

  it('lancement par l’agent : dit à l’agent que c’est lui qui l’a lancée', () => {
    const text = childContext([
      {
        kind: 'child-started',
        id: 1,
        childId: 'f1',
        title: 'Import CSV',
        prompt: 'Fais-le',
        by: 'agent',
        at: 1
      }
    ])
    expect(text).toContain('- You started (start_child) the child conversation "Import CSV"')
  })
})

describe('mère tech lead (fiche 160)', () => {
  it('compte rendu borné : titre, fichiers et réponse démesurés, jamais de diff', () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `src/${'dossier/'.repeat(20)}fichier-${i}.ts`,
      added: 10,
      removed: 1
    }))
    const huge: ChildReport = {
      ...report,
      title: 'Titre '.repeat(100),
      branch: `bobine/${'b'.repeat(200)}`,
      files,
      fileCount: 250,
      excerpt: 'Récapitulatif. '.repeat(500)
    }
    const line = reportLine(huge)
    expect(line.length).toBeLessThanOrEqual(REPORT_CHARS)
    expect(line).toContain('250 file(s) changed so far')
    expect(line).not.toContain('fichier-8.ts')
    expect(line).toContain('Start of its last reply')
    // Un compte rendu ordinaire n'est pas coupé.
    expect(reportLine(report)).toBe(
      '- The child conversation "Import CSV" (id: f1) on branch bobine/x finished its turn. 1 file(s) changed so far (+40 −2): src/import.ts (+40 −2).\n  Start of its last reply:\n  > Les tests passent.'
    )
    // Dans le contexte : un compte rendu ne porte que des noms et des compteurs, pas de diff.
    const text = childContext([{ kind: 'child-report', id: 1, ...huge }]) ?? ''
    expect(text).not.toMatch(/^[+-]{3} |^@@/m)
    expect(text.length).toBeLessThan(REPORT_CHARS + 1000)
  })

  it('recommandations : la dernière par fille, caduque après un nouveau tour', () => {
    const recommend = (id: number, childId: string, ready: boolean) =>
      ({
        kind: 'child-recommendation',
        id,
        childId,
        title: childId,
        ready,
        note: ready ? 'Vérifiée' : 'Tests manquants',
        at: id
      }) as const
    const items: TranscriptItem[] = [
      recommend(1, 'f1', false),
      recommend(2, 'f1', true),
      recommend(3, 'f2', true),
      { kind: 'child-report', id: 4, ...report, childId: 'f2' },
      recommend(5, 'f3', false)
    ]
    const verdicts = childRecommendations(items)
    expect(verdicts.get('f1')).toMatchObject({ ready: true, note: 'Vérifiée', stale: false })
    expect(verdicts.get('f2')).toMatchObject({ ready: true, stale: true })
    expect(verdicts.get('f3')).toMatchObject({ ready: false, stale: false })
    expect([...recommendedIds(verdicts)]).toEqual(['f1'])
    // Par le réducteur : l'évènement devient un élément du fil.
    const state = reduceTranscript(emptyTranscript, {
      type: 'child-recommendation',
      recommendation: { childId: 'f1', title: 'Import CSV', ready: true, note: 'ok', at: 1 }
    })
    expect(state.items.at(-1)).toMatchObject({ kind: 'child-recommendation', ready: true })
  })

  it('réveil et contexte de session : vérifier, recommander, ne jamais fusionner soi-même', () => {
    const session = capabilitiesContext('whenFitting') ?? ''
    expect(session).toContain('tech lead')
    expect(session).toContain('recommend_merge')
    expect(session).toContain('Never merge a branch yourself')
  })
})

describe('propositions de filles (fiche 112)', () => {
  it('décision : aller-retour par le contenu de l’élicitation, illisible = rien', () => {
    const full = {
      action: 'start' as const,
      profileId: 'opencode',
      model: { controlId: 'model', value: 'q' }
    }
    expect(childDecisionContent(full)).toEqual({
      decision: 'start',
      profileId: 'opencode',
      modelControl: 'model',
      modelValue: 'q'
    })
    expect(parseChildDecision(childDecisionContent(full))).toEqual(full)
    expect(parseChildDecision({ decision: 'here' })).toEqual({ action: 'here' })
    // Un modèle sans sa valeur, un agent vide : ignorés.
    expect(
      parseChildDecision({ decision: 'start', modelControl: 'model', profileId: ' ' })
    ).toEqual({
      action: 'start'
    })
    expect(parseChildDecision({ decision: 'launch' })).toBeUndefined()
    expect(parseChildDecision(null)).toBeUndefined()
    // Le schéma n'accepte que ces champs, et la décision est obligatoire.
    expect(childProposalSchema()).toMatchObject({
      required: ['decision'],
      properties: { decision: { enum: ['start', 'here', 'refuse'] } }
    })
  })

  it('regroupement par tour : une carte à la place de la première, les appels cachés', () => {
    const proposal = (id: number, title: string, toolCallId?: string): TranscriptItem => ({
      kind: 'elicitation',
      id,
      requestId: `r${id}`,
      state: 'pending',
      prompt: {
        mode: 'form',
        message: title,
        schema: childProposalSchema(),
        child: { title, prompt: 'Fais' },
        ...(toolCallId ? { toolCallId } : {})
      }
    })
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      proposal(2, 'Un', 'c1'),
      { kind: 'agent', id: 3, text: 'Et aussi :' },
      proposal(4, 'Deux', 'c2'),
      { kind: 'user', id: 5, text: 'Encore' },
      proposal(6, 'Trois'),
      {
        kind: 'elicitation',
        id: 7,
        requestId: 'q',
        state: 'pending',
        prompt: { mode: 'form', message: 'Question ?', schema: { type: 'object', properties: {} } }
      }
    ]
    const groups = childProposalGroups(items)
    expect([...groups.groups.keys()]).toEqual([2, 6])
    expect(groups.groups.get(2)?.map((i) => i.prompt.child.title)).toEqual(['Un', 'Deux'])
    expect([...groups.hidden]).toEqual([4])
    expect([...groups.toolCallIds]).toEqual(['c1', 'c2'])
  })
})

describe('filles proposées par l’agent (fiche 118)', () => {
  it('contexte de session : rien pour « Jamais », un bloc générique sinon', () => {
    expect(capabilitiesContext('never')).toBeUndefined()
    const fitting = capabilitiesContext('whenFitting') ?? ''
    expect(fitting.startsWith('<bobine_capabilities>')).toBe(true)
    expect(fitting.endsWith('</bobine_capabilities>')).toBe(true)
    for (const text of [
      'several independent pieces of work in one message',
      'start_child',
      'its own git worktree',
      'Proposing one costs nothing',
      'Start, Do it here, Refuse',
      'change different files',
      'follow it separately',
      'to answer a question, for a small fix',
      'depend on one another',
      'change the same files',
      'Your own sub-agents',
      'end your turn'
    ]) {
      expect(fitting).toContain(text)
    }
    // Générique : aucun agent nommé, rien en français.
    expect(fitting).not.toMatch(/\bBob\b|OpenCode|spawn_subagent|conversation fille/)
  })

  it('« Toujours demander » : proposer avant tout travail en plusieurs parties', () => {
    const always = capabilitiesContext('always') ?? ''
    expect(always).toContain('always propose child conversations before starting work that has')
    expect(always).not.toContain('Do not propose them')
    expect(always).toContain('Proposing one costs nothing')
  })

  it('demande de /split : une fille par chantier, chacune dans son worktree, fin du tour', () => {
    expect(CHILDREN_REQUEST).toContain('call start_child once')
    expect(CHILDREN_REQUEST).toContain('per independent piece of work')
    expect(CHILDREN_REQUEST).toContain('its own git worktree')
    expect(CHILDREN_REQUEST).toContain('end your turn')
  })
})

describe('première phrase d’un compte rendu replié (fiche 171)', () => {
  it('texte brut de la première ligne, coupé à la première phrase', () => {
    expect(
      recapLead('Voici un exemple de réponse **en Markdown**, avec une liste :\n\n1. un point')
    ).toBe('Voici un exemple de réponse en Markdown, avec une liste :')
    expect(recapLead('## Bilan\nrien')).toBe('Bilan')
    expect(recapLead('- *Import* fait dans `src/import.ts`. 37 tests verts.')).toBe(
      'Import fait dans src/import.ts.'
    )
    expect(recapLead('Voir [la fiche](docs/a.md) ! Ensuite')).toBe('Voir la fiche !')
    expect(recapLead('snake_case_name reste tel quel')).toBe('snake_case_name reste tel quel')
  })

  it('saute les blocs de code et les lignes vides ; vide sans texte', () => {
    expect(recapLead('```ts\nconst a = 1\n```\n\nFini.')).toBe('Fini.')
    expect(recapLead('\n\n')).toBe('')
    expect(recapLead('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a · b')
  })

  it('bornée à LEAD_CHARS', () => {
    const lead = recapLead('mot '.repeat(100))
    expect(lead.length).toBeLessThanOrEqual(LEAD_CHARS)
    expect(lead.endsWith('…')).toBe(true)
  })
})
