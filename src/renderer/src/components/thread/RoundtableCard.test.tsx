/**
 * Carte « Tour de table » dans le fil (fiche 285) : rendue par `Transcript`, comme l'utilisateur la
 * voit, pour chaque phase du tour construite avec le réducteur du contrat — recueil, erreurs,
 * modèle refusé, synthèse en cours, pas assez d'avis, carte repliée, synthèse et ses lettres,
 * réplique, décision, reprise après un redémarrage, arrêt.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { Roundtable, RoundtableEvent } from '@shared/roundtable'
import type { TranscriptItem } from '@shared/transcript'
import { onRoundtableMenuRequest } from '../roundtable/roundtable-menu-request'
import { answered, opinion, rebutted, roundtable, T0, thread } from '../roundtable/test-fixtures'
import type { SubtasksInfo } from './Subtasks'
import { Transcript } from './Transcript'

const wrap = (ui: ReactNode) => render(ui, { wrapper: Tooltip.Provider })
/** Espaces insécables de la typographie française ramenées à des espaces. */
const plain = (text: unknown) => String(text).replace(/[  ]/g, ' ')

const api = {
  synthesize: vi.fn(async () => undefined),
  rebuttal: vi.fn(async () => undefined),
  decide: vi.fn(async () => undefined),
  relaunch: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined)
}
const saved = window.api
beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockClear()
  window.api = { ...saved, roundtable: api } as unknown as typeof window.api
})
afterEach(() => {
  window.api = saved
})

const child = (id: string, extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id,
  title: id,
  profileId: 'agent-a',
  profileLabel: 'Agent A',
  workspace: '/tmp/projet',
  updatedAt: '',
  status: 'stopped',
  draft: false,
  startedFrom: { id: 'mother', title: 'Mère' },
  ...extra
})

function info(extra: Partial<SubtasksInfo> = {}): SubtasksInfo {
  return {
    children: [child('child-A'), child('child-B'), child('child-C')],
    attention: {},
    onOpen: vi.fn(),
    onAsk: vi.fn(),
    onWarn: vi.fn(),
    motherId: 'mother',
    ...extra
  }
}

function show(items: TranscriptItem[], subtasks: SubtasksInfo | null = info()) {
  wrap(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      {...(subtasks ? { subtasks } : {})}
    />
  )
  return subtasks ?? undefined
}

const card = () => screen.getByTestId('roundtable-card')
const row = (letter: string) =>
  card().querySelector(`[data-testid=roundtable-row][data-letter=${letter}]`) as HTMLElement
const failed = (letter: 'A' | 'B' | 'C', detail?: string): RoundtableEvent => ({
  type: 'seat-failed',
  letter,
  error: 'agent-error',
  ...(detail ? { detail } : {}),
  at: T0 + 38_000
})
const OPINIONS = {
  A: [opinion('Redis + BullMQ : retries et tableau de bord prêts.', 'moyenne')],
  B: [opinion('pg-boss sur Postgres : aucune infra en plus.', 'haute')],
  C: [opinion('Un service géré (SQS).', 'basse')]
}

describe('recueil des avis', () => {
  it('bulle de la question, puis une ligne par participant : nom, agent, état, durée', () => {
    show(thread(roundtable([answered('A')]), OPINIONS))
    const bubble = screen.getByTestId('roundtable-bubble')
    expect(bubble.textContent).toContain('Tour de table')
    expect(bubble.textContent).toContain('Quelle file de tâches ?')
    expect(within(card()).getByTestId('roundtable-progress').textContent).toBe('1 avis sur 3')
    expect(row('A').textContent).toContain('DeepSeek V4.1 Flash · Agent A')
    expect(within(row('A')).getByTestId('roundtable-row-side').textContent).toBe('a répondu · 0:51')
    expect(row('C').textContent).toContain('Agent B')
    // Un agent sans choix de modèle : son nom une seule fois.
    expect(row('C').textContent).not.toContain('Agent B · Agent B')
    expect(row('B').getAttribute('data-state')).toBe('working')
    // Ni « Synthétiser sans attendre » avec un seul avis, mais « Arrêter » le tour.
    expect(screen.queryByTestId('roundtable-synthesize')).toBeNull()
    expect(screen.getByTestId('roundtable-foot').textContent).toContain(
      'Lecture seule · chacun répond sans voir les autres'
    )
  })

  it('« Synthétiser sans attendre » dès deux avis ; « Arrêter » tout ou une ligne', async () => {
    show(thread(roundtable([answered('A'), answered('B')]), OPINIONS))
    expect(screen.getByTestId('roundtable-progress').textContent).toBe('2 avis sur 3')
    fireEvent.click(screen.getByTestId('roundtable-synthesize'))
    expect(api.synthesize).toHaveBeenCalledWith('mother', 'rt1')
    fireEvent.click(screen.getByTestId('roundtable-stop'))
    expect(api.stop).toHaveBeenCalledWith('mother', 'rt1', undefined)
    const stopC = within(row('C')).getByTestId('roundtable-stop-seat')
    expect(stopC.getAttribute('aria-label')).toBe('Arrêter Agent B')
    fireEvent.click(stopC)
    expect(api.stop).toHaveBeenCalledWith('mother', 'rt1', 'C')
  })

  it('participant en erreur : la raison en clair, la durée, « Relancer »', () => {
    show(thread(roundtable([answered('A'), failed('C', 'Server Error (-32603)')]), OPINIONS))
    expect(plain(within(row('C')).getByTestId('roundtable-row-meta').textContent)).toBe(
      'En erreur : Server Error (-32603) au bout de 0:38'
    )
    fireEvent.click(within(row('C')).getByTestId('roundtable-relaunch'))
    expect(api.relaunch).toHaveBeenCalledWith('mother', 'rt1', 'C')
  })

  it('modèle refusé : dit sans substitution, « Choisir un autre modèle » ouvre le menu', () => {
    const requested = vi.fn()
    const off = onRoundtableMenuRequest(requested)
    show(
      thread(
        roundtable([
          { type: 'seat-failed', letter: 'B', error: 'model-not-applied', at: T0 + 1000 }
        ])
      )
    )
    expect(row('B').textContent).toContain('Modèle non proposé par Agent A pour le moment.')
    expect(within(row('B')).queryByTestId('roundtable-relaunch')).toBeNull()
    fireEvent.click(within(row('B')).getByTestId('roundtable-other-model'))
    expect(requested).toHaveBeenCalled()
    off()
  })

  it('marques de la ligne : fichiers modifiés, lecture seule seulement demandée', () => {
    const rt = roundtable([{ type: 'seat-changed-folder', letter: 'B', at: T0 }])
    const seats = rt.seats.map((s) =>
      s.letter === 'B' ? { ...s, readOnly: 'requested' as const } : s
    )
    show(thread({ ...rt, seats }))
    expect(within(row('B')).getByTestId('roundtable-changed').textContent).toContain(
      'a modifié des fichiers du dossier'
    )
    expect(row('B').textContent).toContain('Lecture seule demandée')
    // Lecture seule garantie : pas de texte sur la ligne, un bouclier discret.
    expect(row('A').textContent).not.toContain('Lecture seule')
  })

  it('fil en lecture seule (sans conversation) : aucun geste', () => {
    show(thread(roundtable([answered('A'), answered('B')]), OPINIONS), null)
    expect(screen.queryByTestId('roundtable-synthesize')).toBeNull()
    expect(screen.queryByTestId('roundtable-stop')).toBeNull()
  })

  it('les participants ne sont ni dans « Sous-tâches » ni en comptes rendus séparés', () => {
    show(thread(roundtable([answered('A')]), OPINIONS))
    expect(screen.queryByTestId('subtasks')).toBeNull()
    expect(screen.queryAllByTestId('work-card')).toHaveLength(0)
    expect(screen.getAllByTestId('roundtable-row')).toHaveLength(3)
  })
})

it('les quatre niveaux de lecture seule, discrètement, avec leur nom en clair', () => {
  const rt = roundtable()
  const levels = ['enforced', 'native', 'unverified'] as const
  const seats = rt.seats.map((s, i) => ({ ...s, readOnly: levels[i] ?? ('requested' as const) }))
  show(thread({ ...rt, seats }))
  const marks = screen.getAllByTestId('roundtable-readonly')
  expect(marks.map((m) => [m.dataset.level, m.getAttribute('aria-label')])).toEqual([
    ['enforced', 'Lecture seule'],
    ['native', 'Lecture seule, tenue par le rôle Participant installé'],
    ['unverified', 'Lecture seule demandée, non vérifiée (dossier hors git)']
  ])
  expect(row('C').textContent).toContain('non vérifiée (dossier hors git)')
})

describe('avis rendus et synthèse en cours', () => {
  const synthesizing = (extra: RoundtableEvent[] = []) =>
    roundtable([answered('A'), answered('B'), failed('C'), ...extra])

  it('réponse courte et confiance en mots ; l’absent nommé au pied', () => {
    show(thread(synthesizing(), OPINIONS))
    expect(plain(screen.getByTestId('roundtable-progress').textContent)).toBe(
      '2 avis · synthèse en attente : l’agent répond'
    )
    expect(row('A').textContent).toContain('Redis + BullMQ : retries et tableau de bord prêts.')
    expect(within(row('A')).getByTestId('roundtable-row-side').textContent).toBe(
      'confiance moyenne'
    )
    expect(within(row('B')).getByTestId('roundtable-row-side').textContent).toBe('confiance haute')
    expect(within(row('C')).getByTestId('roundtable-row-side').textContent).toBe('sans avis')
    expect(plain(screen.getByTestId('roundtable-note').textContent)).toBe(
      'Synthèse avec 2 avis : un participant n’a pas répondu.'
    )
  })

  it('déplié : l’avis entier en Markdown et « Ouvrir sa conversation », un seul à la fois', () => {
    const subtasks = show(
      thread(synthesizing([{ type: 'step-sent', step: 'synthesis', at: T0 }]), OPINIONS)
    )
    expect(plain(screen.getByTestId('roundtable-progress').textContent)).toBe(
      '2 avis · synthèse en cours'
    )
    fireEvent.click(within(row('A')).getByTestId('roundtable-row-toggle'))
    const open = within(row('A')).getByTestId('roundtable-row-open')
    expect(open.querySelector('h2')?.textContent).toBe('Réponse courte')
    fireEvent.click(within(open).getByTestId('roundtable-open'))
    expect(subtasks?.onOpen).toHaveBeenCalledWith('child-A')
    fireEvent.click(within(row('B')).getByTestId('roundtable-row-toggle'))
    expect(within(row('A')).queryByTestId('roundtable-row-open')).toBeNull()
    expect(within(row('B')).getByTestId('roundtable-row-open')).toBeTruthy()
  })

  it('format non suivi : l’avis tel quel, la mention discrète', () => {
    show(thread(synthesizing(), { A: ['Juste une phrase sans rubriques.'], B: OPINIONS.B }))
    expect(within(row('A')).getByTestId('roundtable-format').textContent).toBe('format non suivi')
  })

  it('synthèse retenue par le plafond de la conversation : dit dans l’en-tête', () => {
    show(thread(synthesizing([{ type: 'step-held', step: 'synthesis' }]), OPINIONS))
    expect(plain(screen.getByTestId('roundtable-progress').textContent)).toBe(
      '2 avis · synthèse retenue : plafond de la conversation atteint'
    )
  })
})

describe('pas assez d’avis, arrêt, reprise', () => {
  it('un seul avis : pas de synthèse, « Relancer » sur les lignes sans avis', () => {
    show(
      thread(
        roundtable([
          answered('B'),
          failed('A'),
          { type: 'seat-stopped', letter: 'C', reason: 'user', at: T0 }
        ]),
        OPINIONS
      )
    )
    expect(card().getAttribute('data-phase')).toBe('insufficient')
    expect(plain(screen.getByTestId('roundtable-note').textContent)).toBe(
      'Un seul avis : pas de synthèse.'
    )
    expect(row('C').textContent).toContain('Arrêté par vous')
    expect(within(row('A')).getByTestId('roundtable-relaunch')).toBeTruthy()
    expect(within(row('C')).getByTestId('roundtable-relaunch')).toBeTruthy()
    expect(screen.queryByTestId('roundtable-synthesize')).toBeNull()
  })

  it('arrêté : l’en-tête le dit, plus aucun geste', () => {
    show(thread(roundtable([answered('A'), { type: 'stop', at: T0 }]), OPINIONS))
    expect(screen.getByTestId('roundtable-progress').textContent).toBe('tour de table arrêté')
    expect(row('B').textContent).toContain('Arrêté avec le tour de table')
    expect(screen.queryByTestId('roundtable-relaunch')).toBeNull()
  })

  it('après un redémarrage : « Synthétiser avec 2 avis », « Reprendre » ; rien ne part seul', async () => {
    const { settleRoundtable } = await import('@shared/roundtable')
    const rt = settleRoundtable(roundtable([answered('A'), answered('B')]), T0 + 1)
    show(thread(rt, OPINIONS))
    expect(screen.getByTestId('roundtable-progress').textContent).toBe(
      'interrompu par le redémarrage de l’app'
    )
    expect(row('C').textContent).toContain('Arrêté (redémarrage)')
    expect(api.synthesize).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('roundtable-synthesize'))
    expect(screen.getByTestId('roundtable-synthesize').textContent).toBe('Synthétiser avec 2 avis')
    expect(api.synthesize).toHaveBeenCalledWith('mother', 'rt1')
    fireEvent.click(screen.getByTestId('roundtable-resume'))
    expect(api.relaunch).toHaveBeenCalledWith('mother', 'rt1', 'C')
  })

  it('un refus du main est dit sur la carte, en clair', async () => {
    api.synthesize.mockRejectedValueOnce(
      new Error(
        "Error invoking remote method 'roundtable:synthesize': Error: Ce tour de table n’existe pas dans cette conversation."
      )
    )
    show(thread(roundtable([answered('A'), answered('B')]), OPINIONS))
    await act(async () => fireEvent.click(screen.getByTestId('roundtable-synthesize')))
    const refusal = await screen.findByTestId('roundtable-gesture-refusal')
    expect(refusal.getAttribute('role')).toBe('alert')
    expect(refusal.textContent).toBe('Ce tour de table n’existe pas dans cette conversation.')
  })

  it('redémarrage d’un tour avec pièces jointes : pas de « Relancer », la raison dite', async () => {
    const { settleRoundtable } = await import('@shared/roundtable')
    const rt = settleRoundtable(
      { ...roundtable([answered('A'), answered('B')]), attachments: ['plan.md'] },
      T0 + 1
    )
    show(thread(rt, OPINIONS))
    expect(screen.getByTestId('roundtable-bubble').textContent).toContain('plan.md')
    expect(plain(screen.getByTestId('roundtable-attachments-lost').textContent)).toContain(
      'Les pièces jointes de ce tour ne sont plus disponibles'
    )
    expect(screen.queryByTestId('roundtable-resume')).toBeNull()
    expect(within(row('C')).queryByTestId('roundtable-relaunch')).toBeNull()
    // La synthèse avec les avis présents reste possible.
    expect(screen.getByTestId('roundtable-synthesize')).toBeTruthy()
  })
})

/** Un tour synthétisé, avec la demande de l'app et la réponse de l'agent dans le fil. */
function synthesized(rt: Roundtable, answer: string, extra: TranscriptItem[] = []) {
  return thread(rt, OPINIONS, [
    {
      kind: 'user',
      id: 0,
      text: 'Synthesize the roundtable…',
      from: { kind: 'roundtable', id: 'rt1', title: 'Quelle file', step: 'synthesis' }
    },
    { kind: 'agent', id: 0, text: answer },
    ...extra
  ])
}

const SYNTHESIS =
  '## Ce que je rejette\n- **Redis** (Participant A) : une base de plus.\n- `Participant B` reste en code.\n## Ma recommandation\npg-boss.'
const done = (extra: RoundtableEvent[] = []) =>
  roundtable([
    answered('A'),
    answered('B'),
    answered('C'),
    { type: 'step-sent', step: 'synthesis', at: T0 },
    {
      type: 'step-answered',
      step: 'synthesis',
      at: T0 + 1,
      usage: { cost: { amount: 0.42, currency: 'bobcoins' } }
    },
    ...extra
  ])

describe('synthèse', () => {
  it('la carte se replie en une ligne : participants, « 3 avis » ; un clic la rouvre', () => {
    const subtasks = info({
      children: [
        child('child-A', { usage: { total: 20_000 } }),
        child('child-B', { usage: { total: 27_500, cost: { amount: 0.06, currency: 'USD' } } }),
        child('child-C')
      ]
    })
    show(synthesized(done(), SYNTHESIS), subtasks)
    expect(card().getAttribute('data-collapsed')).toBe('true')
    expect(screen.queryAllByTestId('roundtable-row')).toHaveLength(0)
    const head = screen.getByTestId('roundtable-head-toggle')
    expect(head.textContent).toContain('DeepSeek V4.1 Flash, GLM 5.3 Flash et Agent B')
    expect(head.textContent).toContain('3 avis')
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(plain(screen.getByTestId('roundtable-used').textContent)).toMatch(
      /^Consommé : 47,5k jetons · ≈ 0,06 \$US \+ 0,42 Bobcoins · 1 participant sans chiffre$/
    )
    fireEvent.click(head)
    expect(screen.getAllByTestId('roundtable-row')).toHaveLength(3)
  })

  it('la demande de l’app devient une ligne ; la réponse porte l’étiquette et les vrais noms', () => {
    show(synthesized(done(), SYNTHESIS))
    const request = screen.getByTestId('roundtable-request')
    expect(request.textContent).toContain('Synthèse demandée · 3 avis')
    expect(document.body.textContent).not.toContain('Synthesize the roundtable')
    expect(screen.getByTestId('roundtable-answer-label').textContent).toBe(
      'Synthèse du tour de table · GPT-6.1 Sol'
    )
    const letters = screen.getAllByTestId('roundtable-letter')
    expect(letters).toHaveLength(1)
    expect(letters[0]?.textContent).toBe('Participant A (DeepSeek V4.1 Flash · Agent A)')
    expect(letters[0]?.getAttribute('tabindex')).toBe('0')
  })

  it('au survol ou au focus d’une lettre : le vrai nom en infobulle', async () => {
    show(synthesized(done(), SYNTHESIS))
    const letter = screen.getByTestId('roundtable-letter')
    fireEvent.focus(letter)
    fireEvent.pointerMove(letter)
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip').map((t) => t.textContent)).toContain(
        'DeepSeek V4.1 Flash · Agent A'
      )
    )
  })

  it('actions : appliquer (message ordinaire) et faire réagir, avec le rappel en jetons', () => {
    const subtasks = show(synthesized(done(), SYNTHESIS))
    const actions = screen.getByTestId('roundtable-actions')
    const apply = within(actions).getByTestId('roundtable-apply')
    expect(apply.textContent).toBe('Demander à Agent A de l’appliquer')
    fireEvent.click(apply)
    expect(subtasks?.onAsk).toHaveBeenCalledWith('Applique ta recommandation du tour de table.')
    expect(within(actions).getByTestId('roundtable-rebut-cost').textContent).toBe(
      '≈ 4 fois les jetons d’une question simple'
    )
    fireEvent.click(within(actions).getByTestId('roundtable-rebut'))
    expect(api.rebuttal).toHaveBeenCalledWith('mother', 'rt1')
  })

  it('synthèse pas encore rendue : ni actions ni appliquer', () => {
    const rt = roundtable([
      answered('A'),
      answered('B'),
      answered('C'),
      { type: 'step-sent', step: 'synthesis', at: T0 }
    ])
    show(synthesized(rt, 'Accords…'))
    expect(screen.queryByTestId('roundtable-actions')).toBeNull()
    expect(screen.getByTestId('roundtable-answer-label')).toBeTruthy()
  })
})

describe('réplique et décision', () => {
  it('positions par ligne, puis la décision et « Appliquer » seul', () => {
    const rt = done([
      { type: 'rebuttal', at: T0 + 2 },
      rebutted('A', 'nuances'),
      rebutted('B', 'maintains'),
      rebutted('C', 'rallies'),
      { type: 'step-sent', step: 'verdict', at: T0 + 4 },
      { type: 'step-answered', step: 'verdict', at: T0 + 5 }
    ])
    const items = thread(
      rt,
      {
        A: [OPINIONS.A[0] ?? '', 'Position : nuance\nD’accord pour pg-boss à ce volume.'],
        B: [OPINIONS.B[0] ?? '', 'Position : maintient\nArchivage à 7 jours.'],
        C: [OPINIONS.C[0] ?? '', 'Position : se rallie\nSans outbox, SQS ne garantit rien.']
      },
      [
        {
          kind: 'user',
          id: 0,
          text: 'synthesize',
          from: { kind: 'roundtable', id: 'rt1', title: 'q', step: 'synthesis' }
        },
        { kind: 'agent', id: 0, text: SYNTHESIS },
        {
          kind: 'user',
          id: 0,
          text: 'decide',
          from: { kind: 'roundtable', id: 'rt1', title: 'q', step: 'verdict' }
        },
        { kind: 'agent', id: 0, text: 'pg-boss, confirmé (Participant C se rallie).' }
      ]
    )
    show(items)
    const rebuttal = screen.getByTestId('roundtable-rebuttal')
    expect(rebuttal.textContent).toContain('Réplique')
    expect(rebuttal.textContent).toContain('3 réponses')
    const rows = within(rebuttal).getAllByTestId('roundtable-rebuttal-row')
    expect(rows.map((r) => within(r).getByTestId('roundtable-row-side').textContent)).toEqual([
      'nuance',
      'maintient',
      'se rallie'
    ])
    expect(rows[0]?.textContent).toContain('D’accord pour pg-boss à ce volume.')
    // Plus de « Faire réagir » : une seule réplique.
    expect(screen.queryByTestId('roundtable-rebut')).toBeNull()
    const requests = screen.getAllByTestId('roundtable-request')
    expect(requests[1]?.textContent).toContain('Décision demandée · 3 répliques')
    const labels = screen.getAllByTestId('roundtable-answer-label').map((l) => l.textContent)
    expect(labels).toEqual([
      'Synthèse du tour de table · GPT-6.1 Sol',
      'Décision du tour de table · GPT-6.1 Sol'
    ])
    expect(screen.getAllByTestId('roundtable-apply')).toHaveLength(1)
    expect(screen.getAllByTestId('roundtable-letter')[1]?.textContent).toContain('Agent B')
  })

  it('après un redémarrage pendant la réplique : « Demander la décision »', async () => {
    const { settleRoundtable } = await import('@shared/roundtable')
    const rt = settleRoundtable(
      done([{ type: 'rebuttal', at: T0 + 2 }, rebutted('A', 'nuances')]),
      T0 + 9
    )
    show(thread(rt, OPINIONS))
    // Repliée seulement après la synthèse rendue ; interrompue, la carte reste ouverte.
    fireEvent.click(screen.getByTestId('roundtable-decide'))
    expect(api.decide).toHaveBeenCalledWith('mother', 'rt1')
  })
})
