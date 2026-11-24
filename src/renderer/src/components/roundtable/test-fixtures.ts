/**
 * Fixtures des essais du tour de table (fiche 285) : des tours construits avec le réducteur du
 * contrat (`newSeats`, `reduceRoundtable`), jamais à la main, et le fil qui va avec (élément du
 * tour, lancements, réponses). Des agents neutres (`agent-a`, `agent-b`) : rien de propre à un
 * vrai agent. Utilisé seulement par les essais.
 */
import {
  newSeats,
  reduceRoundtable,
  type Roundtable,
  type RoundtableEvent,
  type RoundtableLetter,
  type RoundtableParticipant
} from '@shared/roundtable'
import type { RoundtableAgentOption, RoundtableOptions } from '@shared/roundtable-ipc'
import type { TranscriptItem } from '@shared/transcript'

export const T0 = 1_700_000_000_000

export const PARTICIPANTS: RoundtableParticipant[] = [
  {
    profileId: 'agent-a',
    model: { controlId: 'model', value: 'deep', name: 'vendor/DeepSeek V4.1 Flash' },
    label: 'DeepSeek V4.1 Flash',
    agentLabel: 'Agent A'
  },
  {
    profileId: 'agent-a',
    model: { controlId: 'model', value: 'glm', name: 'GLM 5.3 Flash' },
    label: 'GLM 5.3 Flash',
    agentLabel: 'Agent A'
  },
  { profileId: 'agent-b', label: 'Agent B', agentLabel: 'Agent B' }
]

/** Lettres tirées sans hasard : A, B, C dans l'ordre des participants. */
const NO_SHUFFLE = () => 0.999

/** Un tour lancé (participants créés, au travail), puis les évènements donnés. */
export function roundtable(
  events: RoundtableEvent[] = [],
  participants = PARTICIPANTS
): Roundtable {
  const seats = newSeats(participants, NO_SHUFFLE)
  let rt: Roundtable = {
    roundtableId: 'rt1',
    question: 'Quelle file de tâches ?',
    synthesizer: { profileId: 'agent-a', label: 'Agent A', model: 'GPT-6.1 Sol' },
    seats,
    phase: 'collecting',
    at: T0
  }
  for (const seat of seats) {
    rt = reduceRoundtable(rt, {
      type: 'seat-launched',
      letter: seat.letter,
      childId: `child-${seat.letter}`,
      readOnly: 'enforced',
      at: T0
    })
    rt = reduceRoundtable(rt, { type: 'seat-working', letter: seat.letter, at: T0 })
  }
  return events.reduce(reduceRoundtable, rt)
}

export const answered = (letter: RoundtableLetter, at = T0 + 51_000): RoundtableEvent => ({
  type: 'seat-answered',
  letter,
  at
})

/** Avis au format imposé. */
export const opinion = (short: string, confidence = 'haute') =>
  [
    '## Réponse courte',
    short,
    '## Arguments',
    '- un argument (`src/a.ts:1`)',
    '## Hypothèses',
    'aucune',
    '## Ce qui me ferait changer d’avis',
    'un débit soutenu',
    '## Confiance',
    `${confidence} : vérifié dans le code`
  ].join('\n')

/** Le fil d'un tour : l'élément, les lancements des participants, leurs réponses (dans l'ordre). */
export function thread(
  rt: Roundtable,
  replies: Partial<Record<RoundtableLetter, string[]>> = {},
  extra: TranscriptItem[] = []
): TranscriptItem[] {
  let id = 1
  const items: TranscriptItem[] = [{ kind: 'roundtable', id: id++, ...rt }]
  for (const seat of rt.seats) {
    if (!seat.childId) continue
    items.push({
      kind: 'child-started',
      id: id++,
      childId: seat.childId,
      title: seat.label,
      prompt: 'consigne',
      card: rt.roundtableId,
      at: T0
    })
  }
  for (const seat of rt.seats) {
    for (const [index, reply] of (replies[seat.letter] ?? []).entries()) {
      items.push({
        kind: 'child-report',
        id: id++,
        childId: seat.childId ?? '',
        title: seat.label,
        outcome: 'done',
        files: [],
        fileCount: 0,
        added: 0,
        removed: 0,
        excerpt: reply.slice(0, 100),
        reply,
        at: T0 + 60_000 * (index + 1)
      })
    }
  }
  for (const item of extra) items.push({ ...item, id: id++ })
  return items
}

const agentOption = (
  profileId: string,
  label: string,
  extra: Partial<RoundtableAgentOption> = {}
): RoundtableAgentOption => ({
  profileId,
  label,
  available: true,
  modelChoice: false,
  readOnly: 'enforced',
  destination: { kind: 'unknown' },
  recent: [],
  others: [],
  ...extra
})

/** Options du main : un agent à modèles (récents et autres), un agent sans choix de modèle. */
export function options(extra: Partial<RoundtableOptions> = {}): RoundtableOptions {
  return {
    agents: [
      agentOption('agent-a', 'Agent A', {
        modelChoice: true,
        controlId: 'model',
        readOnly: 'requested',
        recent: [
          {
            value: 'deep',
            name: 'vendor/DeepSeek V4.1 Flash',
            destination: { kind: 'prefix', provider: 'vendor' }
          },
          { value: 'glm', name: 'GLM 5.3 Flash', destination: { kind: 'unknown' } }
        ],
        others: [
          { value: 'mimo', name: 'MiMo v2.6 Flash', destination: { kind: 'unknown' } },
          { value: 'nemo', name: 'Nemotron 3.5 Super', destination: { kind: 'unknown' } },
          { value: 'qwen', name: 'Qwen3 32B', destination: { kind: 'unknown' } }
        ]
      }),
      agentOption('agent-b', 'Agent B', {
        destination: { kind: 'agent', text: 'service en ligne B' }
      })
    ],
    freeSlots: 5,
    inGit: true,
    lastExchange: false,
    ...extra
  }
}
