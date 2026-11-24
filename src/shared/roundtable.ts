/**
 * Tour de table (fiche 285, ADR-0072) : une question posée à 2 à 5 participants (un couple agent
 * et modèle chacun), en lecture seule, sans qu'aucun voie les autres ; la conversation en cours
 * arbitre ensuite par une synthèse, puis, à la demande, une seule réplique et une décision.
 *
 * Ici, le contrat pur partagé par le main et le renderer, sans Electron :
 * - l'élément de fil `roundtable` (posé par le main, remplacé sur place par `roundtableId`) ;
 * - les évènements qui le font évoluer (`reduceRoundtable`) et la reprise après un redémarrage
 *   (`settleRoundtable`) ;
 * - la sélection des participants, le quorum, les lettres, le multiplicateur de jetons et le
 *   total consommé.
 *
 * Les messages envoyés aux agents sont dans `roundtable-prompts.ts` ; les canaux IPC dans
 * `roundtable-ipc.ts`.
 */
import type { TranscriptItem, TranscriptState } from './transcript'
import type { UsageDigest } from './usage'

/** Participants d'un tour, au moins et au plus (décision 7 de la fiche). */
export const ROUNDTABLE_MIN_SEATS = 2
export const ROUNDTABLE_MAX_SEATS = 5
/** Avis exploitables qu'il faut pour une synthèse : en dessous, rien à confronter. */
export const ROUNDTABLE_QUORUM = 2

/** Lettres qui désignent les participants auprès de l'agent qui synthétise (décision D1). */
export const ROUNDTABLE_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
export type RoundtableLetter = (typeof ROUNDTABLE_LETTERS)[number]

/**
 * Nom du rôle fourni « Participant » (décision 3 du 2026-11-24) : rôle de conseil, en lecture
 * seule. Installé dans un agent par « Installer dans… » (ADR-0047), il sert de mode natif garanti.
 */
export const ROUNDTABLE_PARTICIPANT_ROLE = 'participant'

/** Modèle choisi pour un participant : réglage de catégorie `model` de son agent. */
export interface RoundtableModel {
  controlId: string
  value: string
  /** Nom tel que l'agent le donne, pour l'affichage. */
  name: string
}

/** Un participant tel que le menu le retient : un agent, et son modèle s'il se choisit. */
export interface RoundtableChoice {
  profileId: string
  /** Absent : l'agent garde le sien (profil sans `childModelChoice`, Bob). */
  model?: RoundtableModel
}

/** Un participant d'un tour : son choix, et comment l'interface le nomme. */
export interface RoundtableParticipant extends RoundtableChoice {
  /** Libellé affiché : le nom du modèle, sinon celui de l'agent (« DeepSeek V4.1 Flash »). */
  label: string
  /** Agent, en gris à côté (« OpenCode ») ; égal à `label` pour un agent sans choix de modèle. */
  agentLabel: string
}

/**
 * État d'un participant : en attente (créé, modèle pas encore vérifié), au travail (question
 * partie), a répondu, arrêté, ou en erreur.
 */
export type RoundtableSeatState = 'waiting' | 'working' | 'answered' | 'stopped' | 'error'

/**
 * Raison d'une erreur (décision 4 : jamais de repli silencieux) :
 * - `model-not-found` : modèle absent du catalogue de l'agent ;
 * - `model-not-applied` : réglage refusé, ou valeur relue différente après `config_option_update` ;
 * - `agent-error` : erreur du tour (ACP, modèle injoignable, connexion) ;
 * - `start-failed` : la conversation ou l'agent n'a pas démarré ;
 * - `unavailable` : agent retiré des réglages ou indisponible.
 */
export type RoundtableSeatError =
  'model-not-found' | 'model-not-applied' | 'agent-error' | 'start-failed' | 'unavailable'

/**
 * Pourquoi un participant est arrêté : par l'utilisateur, par « Synthétiser sans attendre », avec
 * tout le tour, par le plafond de sa conversation (fiche 157, inchangé), par un redémarrage de
 * l'app, ou parce que sa conversation a été supprimée.
 */
export type RoundtableStopReason =
  'user' | 'early-synthesis' | 'roundtable-stopped' | 'cost-cap' | 'restart' | 'removed'

/**
 * Lecture seule d'un participant (décision 3) :
 * - `enforced` : l'agent demande avant d'écrire, Bobine refuse ;
 * - `native` : le rôle « Participant » installé dans l'agent (mode natif garanti) ;
 * - `requested` : seulement demandée (agent qui écrit sans demander), dossier surveillé ;
 * - `unverified` : demandée, hors dépôt git : l'empreinte du dossier est impossible.
 */
export type RoundtableReadOnly = 'enforced' | 'native' | 'requested' | 'unverified'

/** Position d'un participant après la réplique. */
export type RoundtableStance = 'maintains' | 'nuances' | 'rallies'

/** Réplique d'un participant (étape 7 de la fiche). */
export interface RoundtableRebuttal {
  state: RoundtableSeatState
  stance?: RoundtableStance
  error?: RoundtableSeatError
  stopped?: RoundtableStopReason
  /** Retenue par le plafond de sa conversation : « réplique retenue : plafond atteint ». */
  held?: true
  detail?: string
  /** Le dossier a changé pendant le tour de la réplique (pas celui de l'avis). */
  changedFolder?: true
  /**
   * Heure d'envoi de la réplique dans la conversation du participant (ajout du lot main) : le
   * compte rendu dont `askedAt` est égal porte la réplique.
   */
  askedAt?: number
}

/** Un participant dans l'élément du tour. */
export interface RoundtableSeat extends RoundtableParticipant {
  /** Lettre tirée au lancement, dans un ordre mélangé ; jamais dite à l'agent qui synthétise avec le nom. */
  letter: RoundtableLetter
  /** Conversation du participant ; absente tant qu'elle n'est pas créée. */
  childId?: string
  state: RoundtableSeatState
  error?: RoundtableSeatError
  stopped?: RoundtableStopReason
  /** Raison en clair venue de l'agent (erreur ACP), bornée à `SEAT_DETAIL_CHARS`. */
  detail?: string
  readOnly?: RoundtableReadOnly
  /** Le dossier a changé pendant un de ses tours (`ReadOnlyWatch`) : sa ligne le dit. */
  changedFolder?: true
  /** Sa conversation a été supprimée : son avis reste lisible s'il était là, « Ouvrir » disparaît. */
  removed?: true
  startedAt?: number
  endedAt?: number
  /**
   * Heure d'envoi de la question dans la conversation du participant (ajout du lot main) : le
   * compte rendu dont `askedAt` est égal porte son avis, quels que soient les tours d'avant
   * (relance, erreur) ou d'après (réplique, messages de l'utilisateur).
   */
  askedAt?: number
  rebuttal?: RoundtableRebuttal
}

/** Raison d'un participant, bornée. */
export const SEAT_DETAIL_CHARS = 300

/**
 * Phase du tour :
 * - `collecting` : recueil des avis ;
 * - `synthesizing` : synthèse demandée (en attente du repos de l'agent, partie, ou retenue) ;
 * - `synthesized` : synthèse rendue ; la réplique est possible ;
 * - `rebutting` : réplique en cours ;
 * - `deciding` : décision demandée ;
 * - `decided` : décision rendue ;
 * - `insufficient` : tous ont fini avec moins de deux avis, pas de synthèse ;
 * - `stopped` : « Arrêter le tour de table » ;
 * - `interrupted` : à reprendre après un redémarrage (rien ne repart seul).
 */
export type RoundtablePhase =
  | 'collecting'
  | 'synthesizing'
  | 'synthesized'
  | 'rebutting'
  | 'deciding'
  | 'decided'
  | 'insufficient'
  | 'stopped'
  | 'interrupted'

/** Une demande à l'agent de la conversation : la synthèse, ou la décision après la réplique. */
export type RoundtableStepKind = 'synthesis' | 'verdict'

/**
 * - `waiting` : prête, l'agent répond encore (elle part à son premier repos) ;
 * - `sent` : partie ; `held` : retenue par le plafond de la conversation (« Continuer » l'envoie) ;
 * - `answered` : réponse rendue ; `failed` : erreur du tour ; `stopped` : tour arrêté ou redémarrage.
 */
export type RoundtableStepState = 'waiting' | 'sent' | 'held' | 'answered' | 'failed' | 'stopped'

export interface RoundtableStep {
  state: RoundtableStepState
  /** Avis (ou répliques) joints à la demande. */
  count: number
  /** « Synthétiser sans attendre », ou geste après un redémarrage. */
  early?: true
  requestedAt: number
  sentAt?: number
  answeredAt?: number
  /** Ce qu'a consommé ce tour de l'agent, tel qu'il l'a communiqué. */
  usage?: UsageDigest
  detail?: string
}

/** L'élément `roundtable` du fil de la conversation en cours, remplacé sur place. */
export interface Roundtable {
  roundtableId: string
  /** La question, telle que tapée. */
  question: string
  /** Noms des pièces jointes parties avec la question (jamais leur contenu). */
  attachments?: string[]
  /** Le dernier échange de la conversation est parti avec la question (décision D2). */
  withLastExchange?: true
  /** Qui synthétise : l'agent et le modèle de la conversation au lancement (décision 1). */
  synthesizer: { profileId: string; label: string; model?: string }
  seats: RoundtableSeat[]
  phase: RoundtablePhase
  /** Phase en cours au redémarrage (`interrupted`). */
  interruptedFrom?: RoundtablePhase
  synthesis?: RoundtableStep
  verdict?: RoundtableStep
  at: number
}

/** L'élément tel que le fil le range. */
export type RoundtableItem = Extract<TranscriptItem, { kind: 'roundtable' }>

/** Évènements qui font évoluer un tour ; le main les applique et pose l'élément obtenu. */
export type RoundtableEvent =
  | {
      type: 'seat-launched'
      letter: RoundtableLetter
      childId: string
      readOnly: RoundtableReadOnly
      at: number
    }
  /** Modèle vérifié, question partie ; `askedAt` : heure d'envoi de la question. */
  | { type: 'seat-working'; letter: RoundtableLetter; at: number; askedAt?: number }
  | { type: 'seat-answered'; letter: RoundtableLetter; at: number }
  | {
      type: 'seat-failed'
      letter: RoundtableLetter
      error: RoundtableSeatError
      detail?: string
      at: number
    }
  | { type: 'seat-stopped'; letter: RoundtableLetter; reason: RoundtableStopReason; at: number }
  | { type: 'seat-changed-folder'; letter: RoundtableLetter; at: number }
  | { type: 'seat-removed'; letter: RoundtableLetter; at: number }
  /** « Relancer » : un participant sans avis repart (tant que la synthèse n'est pas demandée). */
  | { type: 'seat-relaunched'; letter: RoundtableLetter; at: number }
  /** « Synthétiser sans attendre », ou « Synthétiser avec N avis » après un redémarrage. */
  | { type: 'synthesize'; at: number }
  /** Décision demandée de nouveau après un redémarrage pendant la réplique. */
  | { type: 'decide'; at: number }
  | { type: 'step-sent'; step: RoundtableStepKind; at: number }
  | { type: 'step-held'; step: RoundtableStepKind }
  | { type: 'step-answered'; step: RoundtableStepKind; usage?: UsageDigest; at: number }
  | { type: 'step-failed'; step: RoundtableStepKind; detail?: string }
  /** Coût communiqué après coup (Bob) : remplace la consommation du tour de l'agent. */
  | { type: 'step-usage'; step: RoundtableStepKind; usage: UsageDigest }
  /** « Faire réagir les participants » : une seule fois par tour. */
  | { type: 'rebuttal'; at: number }
  | {
      type: 'rebuttal-seat'
      letter: RoundtableLetter
      state: RoundtableSeatState
      stance?: RoundtableStance
      error?: RoundtableSeatError
      stopped?: RoundtableStopReason
      held?: true
      detail?: string
      /** Heure d'envoi de la réplique, redite à chaque évènement de la réplique. */
      askedAt?: number
      at: number
    }
  /** « Arrêter le tour de table » : tout s'arrête, sans synthèse. */
  | { type: 'stop'; at: number }

const FINISHED: ReadonlySet<RoundtableSeatState> = new Set(['answered', 'stopped', 'error'])

/** Un participant (ou sa réplique) a fini : répondu, arrêté ou en erreur. */
export const seatFinished = (state: RoundtableSeatState): boolean => FINISHED.has(state)

/** Avis exploitables : participants qui ont répondu, conversation non supprimée. */
export const usableSeats = (rt: Pick<Roundtable, 'seats'>): RoundtableSeat[] =>
  rt.seats.filter((s) => s.state === 'answered' && !s.removed)

/** Assez d'avis pour une synthèse (décision : au moins deux). */
export const hasQuorum = (count: number): boolean => count >= ROUNDTABLE_QUORUM

/** Répliques rendues, pour la décision. */
export const answeredRebuttals = (rt: Pick<Roundtable, 'seats'>): RoundtableSeat[] =>
  rt.seats.filter((s) => s.rebuttal?.state === 'answered' && !s.removed)

/** Phases où quelque chose est en cours : un redémarrage les rend « à reprendre ». */
const RUNNING_PHASES: ReadonlySet<RoundtablePhase> = new Set([
  'collecting',
  'synthesizing',
  'rebutting',
  'deciding'
])

/** Le tour est-il encore en cours (un second `/roundtable` est alors refusé) ? */
export const roundtableRunning = (rt: Pick<Roundtable, 'phase'>): boolean =>
  RUNNING_PHASES.has(rt.phase) || rt.phase === 'interrupted'

/** « Synthétiser sans attendre » (ou « avec N avis » après un redémarrage) est-il permis ? */
export function canSynthesize(rt: Roundtable): boolean {
  const resumable =
    rt.phase === 'collecting' ||
    (rt.phase === 'interrupted' &&
      (rt.interruptedFrom === 'collecting' || rt.interruptedFrom === 'synthesizing'))
  return resumable && hasQuorum(usableSeats(rt).length)
}

/** La réplique est-elle permise ? Une seule, après la synthèse, avec au moins un avis. */
export const canRebut = (rt: Roundtable): boolean =>
  rt.phase === 'synthesized' && rt.verdict === undefined && usableSeats(rt).some((s) => !!s.childId)

/** « Relancer » un participant sans avis : pendant le recueil, ou s'il manque des avis. */
export function canRelaunch(rt: Roundtable, letter: RoundtableLetter): boolean {
  const seat = rt.seats.find((s) => s.letter === letter)
  if (!seat || seat.removed || (seat.state !== 'error' && seat.state !== 'stopped')) return false
  const from = rt.phase === 'interrupted' ? rt.interruptedFrom : rt.phase
  return from === 'collecting' || rt.phase === 'insufficient'
}

/** Nombre de tours d'agent d'un tour de table : N avis et la synthèse (décision 9). */
export const tokenMultiplier = (participants: number): number => participants + 1

/** Nombre de tours de la réplique : une réplique par avis rendu, et la décision. */
export const rebuttalMultiplier = (rt: Pick<Roundtable, 'seats'>): number =>
  tokenMultiplier(usableSeats(rt).length)

const withSeat = (
  rt: Roundtable,
  letter: RoundtableLetter,
  change: (seat: RoundtableSeat) => RoundtableSeat
): Roundtable => {
  const index = rt.seats.findIndex((s) => s.letter === letter)
  const seat = rt.seats[index]
  if (!seat) return rt
  const seats = rt.seats.slice()
  seats[index] = change(seat)
  return { ...rt, seats }
}

const bounded = (detail: string | undefined): { detail?: string } => {
  const text = detail?.trim()
  return text
    ? {
        detail: text.length > SEAT_DETAIL_CHARS ? `${text.slice(0, SEAT_DETAIL_CHARS - 1)}…` : text
      }
    : {}
}

/**
 * Dossier changé pendant un tour d'un participant, dit après la fin de ce tour (empreinte relue) :
 * sur l'avis pendant le recueil, ou tant que la synthèse n'est pas partie ; sur la réplique pendant
 * la réplique, ou tant que la décision n'est pas partie. Ailleurs, rien ne change.
 */
function changedFolder(rt: Roundtable, letter: RoundtableLetter): Roundtable {
  const pending = (step: RoundtableStep | undefined) =>
    step?.state === 'waiting' || step?.state === 'held'
  if (rt.phase === 'collecting' || (rt.phase === 'synthesizing' && pending(rt.synthesis))) {
    return withSeat(rt, letter, (s) => ({ ...s, changedFolder: true }))
  }
  if (rt.phase === 'rebutting' || (rt.phase === 'deciding' && pending(rt.verdict))) {
    return withSeat(rt, letter, (s) =>
      s.rebuttal ? { ...s, rebuttal: { ...s.rebuttal, changedFolder: true } } : s
    )
  }
  return rt
}

/** Participant arrêté s'il n'a pas fini. */
const stopIfRunning =
  (reason: RoundtableStopReason, at: number) =>
  (seat: RoundtableSeat): RoundtableSeat =>
    seatFinished(seat.state) ? seat : { ...seat, state: 'stopped', stopped: reason, endedAt: at }

const stopRebuttalIfRunning =
  (reason: RoundtableStopReason) =>
  (seat: RoundtableSeat): RoundtableSeat =>
    seat.rebuttal && !seatFinished(seat.rebuttal.state)
      ? { ...seat, rebuttal: { ...seat.rebuttal, state: 'stopped', stopped: reason } }
      : seat

const STEP_RUNNING: ReadonlySet<RoundtableStepState> = new Set(['waiting', 'sent', 'held'])

const stepStopped = (step: RoundtableStep | undefined): RoundtableStep | undefined =>
  step && STEP_RUNNING.has(step.state) ? { ...step, state: 'stopped' } : step

const withStep = (rt: Roundtable, kind: RoundtableStepKind, step: RoundtableStep): Roundtable =>
  kind === 'synthesis' ? { ...rt, synthesis: step } : { ...rt, verdict: step }

/** Synthèse demandée avec les avis présents (les participants encore au travail sont arrêtés). */
function requestSynthesis(rt: Roundtable, at: number, early: boolean): Roundtable {
  const seats = early ? rt.seats.map(stopIfRunning('early-synthesis', at)) : rt.seats
  const count = usableSeats({ seats }).length
  const { interruptedFrom: _from, ...rest } = rt
  return {
    ...rest,
    seats,
    phase: 'synthesizing',
    synthesis: {
      state: 'waiting',
      count,
      requestedAt: at,
      ...(early ? { early: true as const } : {})
    }
  }
}

function requestVerdict(rt: Roundtable, at: number, early: boolean): Roundtable {
  const seats = early ? rt.seats.map(stopRebuttalIfRunning('restart')) : rt.seats
  const count = answeredRebuttals({ seats }).length
  const { interruptedFrom: _from, ...rest } = rt
  return {
    ...rest,
    seats,
    phase: 'deciding',
    verdict: {
      state: 'waiting',
      count,
      requestedAt: at,
      ...(early ? { early: true as const } : {})
    }
  }
}

/**
 * Passages d'une phase à l'autre qui suivent l'état des participants : tous finis pendant le
 * recueil, synthèse automatique (décision D3) ou « pas de synthèse » ; toutes les répliques
 * finies, décision demandée.
 */
function advance(rt: Roundtable, at: number): Roundtable {
  if (rt.phase === 'collecting' && rt.seats.every((s) => seatFinished(s.state))) {
    return hasQuorum(usableSeats(rt).length)
      ? requestSynthesis(rt, at, false)
      : { ...rt, phase: 'insufficient' }
  }
  if (
    rt.phase === 'rebutting' &&
    rt.seats.every((s) => !s.rebuttal || seatFinished(s.rebuttal.state))
  ) {
    return requestVerdict(rt, at, false)
  }
  return rt
}

/** Réplique demandée à chaque participant qui a répondu (et dont la conversation existe). */
function startRebuttal(rt: Roundtable): Roundtable {
  return {
    ...rt,
    phase: 'rebutting',
    seats: rt.seats.map((seat) =>
      seat.state === 'answered' && !seat.removed && seat.childId
        ? { ...seat, rebuttal: { state: 'waiting' } }
        : seat
    )
  }
}

function reduceStep(
  rt: Roundtable,
  event: Extract<RoundtableEvent, { step: RoundtableStepKind }>
): Roundtable {
  const key = event.step
  const step = rt[key]
  if (!step) return rt
  const running = STEP_RUNNING.has(step.state)
  switch (event.type) {
    case 'step-sent':
      return running ? withStep(rt, key, { ...step, state: 'sent', sentAt: event.at }) : rt
    case 'step-held':
      return running ? withStep(rt, key, { ...step, state: 'held' }) : rt
    case 'step-usage':
      return withStep(rt, key, { ...step, usage: event.usage })
    case 'step-failed':
      if (!running) return rt
      return {
        ...withStep(rt, key, { ...step, state: 'failed', ...bounded(event.detail) }),
        phase: 'interrupted',
        interruptedFrom: key === 'synthesis' ? 'synthesizing' : 'deciding'
      }
    case 'step-answered': {
      if (!running) return rt
      const answered: RoundtableStep = {
        ...step,
        state: 'answered',
        answeredAt: event.at,
        ...(event.usage ? { usage: event.usage } : {})
      }
      return {
        ...withStep(rt, key, answered),
        phase: key === 'synthesis' ? 'synthesized' : 'decided'
      }
    }
  }
}

function reduceSeat(
  rt: Roundtable,
  event: Extract<RoundtableEvent, { letter: RoundtableLetter }>
): Roundtable {
  const collecting = rt.phase === 'collecting'
  switch (event.type) {
    case 'seat-launched':
      return withSeat(rt, event.letter, (s) => ({
        ...s,
        childId: event.childId,
        readOnly: event.readOnly,
        startedAt: event.at
      }))
    case 'seat-working':
      return collecting
        ? withSeat(rt, event.letter, (s) =>
            s.state === 'waiting'
              ? {
                  ...s,
                  state: 'working',
                  ...(event.askedAt !== undefined ? { askedAt: event.askedAt } : {})
                }
              : s
          )
        : rt
    case 'seat-answered':
      return collecting
        ? withSeat(rt, event.letter, (s) =>
            seatFinished(s.state) ? s : { ...s, state: 'answered', endedAt: event.at }
          )
        : rt
    case 'seat-failed':
      return collecting
        ? withSeat(rt, event.letter, (s) =>
            seatFinished(s.state)
              ? s
              : {
                  ...s,
                  state: 'error',
                  error: event.error,
                  endedAt: event.at,
                  ...bounded(event.detail)
                }
          )
        : rt
    case 'seat-stopped':
      return collecting ? withSeat(rt, event.letter, stopIfRunning(event.reason, event.at)) : rt
    case 'seat-changed-folder':
      return changedFolder(rt, event.letter)
    case 'seat-removed':
      return withSeat(rt, event.letter, (s) => ({
        ...stopRebuttalIfRunning('removed')(stopIfRunning('removed', event.at)(s)),
        removed: true
      }))
    case 'seat-relaunched': {
      if (!canRelaunch(rt, event.letter)) return rt
      const { interruptedFrom: _from, ...rest } = rt
      return withSeat({ ...rest, phase: 'collecting' }, event.letter, (s) => {
        const { error: _e, stopped: _s, detail: _d, endedAt: _end, askedAt: _a, ...seat } = s
        return { ...seat, state: 'waiting' }
      })
    }
    case 'rebuttal-seat':
      if (rt.phase !== 'rebutting') return rt
      return withSeat(rt, event.letter, (s) => {
        if (!s.rebuttal || seatFinished(s.rebuttal.state)) return s
        const { type: _type, letter: _letter, at: _at, detail, ...rebuttal } = event
        return { ...s, rebuttal: { ...rebuttal, ...bounded(detail) } }
      })
  }
}

/**
 * Applique un évènement au tour. Un évènement hors de sa phase (seconde réplique, synthèse sans
 * quorum, avis arrivé après « Synthétiser sans attendre ») ne change rien : le main compare la
 * référence rendue pour refuser le geste.
 */
export function reduceRoundtable(rt: Roundtable, event: RoundtableEvent): Roundtable {
  switch (event.type) {
    case 'synthesize':
      if (!canSynthesize(rt)) return rt
      return requestSynthesis(rt, event.at, true)
    case 'decide': {
      const from = rt.phase === 'interrupted' ? rt.interruptedFrom : undefined
      return from === 'rebutting' || from === 'deciding' ? requestVerdict(rt, event.at, true) : rt
    }
    case 'rebuttal':
      return canRebut(rt) ? startRebuttal(rt) : rt
    case 'stop': {
      if (!RUNNING_PHASES.has(rt.phase) && rt.phase !== 'interrupted') return rt
      const { interruptedFrom: _from, ...rest } = rt
      const synthesis = stepStopped(rt.synthesis)
      const verdict = stepStopped(rt.verdict)
      return {
        ...rest,
        phase: 'stopped',
        seats: rt.seats
          .map(stopIfRunning('roundtable-stopped', event.at))
          .map(stopRebuttalIfRunning('roundtable-stopped')),
        ...(synthesis ? { synthesis } : {}),
        ...(verdict ? { verdict } : {})
      }
    }
    case 'step-sent':
    case 'step-held':
    case 'step-answered':
    case 'step-failed':
    case 'step-usage':
      return reduceStep(rt, event)
    default: {
      const next = reduceSeat(rt, event)
      return next === rt ? rt : advance(next, event.at)
    }
  }
}

/**
 * Reprise après un redémarrage de l'app (fiche, « Cas limites ») : l'état se relit du fil, les
 * agents sont arrêtés. Tout ce qui n'est pas terminal devient « à reprendre » : participants et
 * répliques en cours arrêtés (`restart`), demande à l'agent arrêtée, phase `interrupted`. Rien ne
 * repart seul. Rend le même objet si rien ne change.
 */
export function settleRoundtable(rt: Roundtable, at: number): Roundtable {
  if (!RUNNING_PHASES.has(rt.phase)) return rt
  const synthesis = stepStopped(rt.synthesis)
  const verdict = stepStopped(rt.verdict)
  return {
    ...rt,
    phase: 'interrupted',
    interruptedFrom: rt.phase,
    seats: rt.seats.map(stopIfRunning('restart', at)).map(stopRebuttalIfRunning('restart')),
    ...(synthesis ? { synthesis } : {}),
    ...(verdict ? { verdict } : {})
  }
}

/** Élément d'un tour dans le fil : un seul par `roundtableId`, remplacé à chaque changement. */
export function reduceRoundtableItem(state: TranscriptState, rt: Roundtable): TranscriptState {
  const index = state.items.findLastIndex(
    (i) => i.kind === 'roundtable' && i.roundtableId === rt.roundtableId
  )
  const current = state.items[index]
  if (!current) {
    const item: TranscriptItem = { kind: 'roundtable', id: state.nextId, ...rt }
    return { ...state, items: [...state.items, item], nextId: state.nextId + 1 }
  }
  const items = state.items.slice()
  items[index] = { ...rt, kind: 'roundtable', id: current.id }
  return { ...state, items }
}

/** Dernier tour de table du fil, s'il y en a un. */
export function lastRoundtable(items: readonly TranscriptItem[]): RoundtableItem | undefined {
  const item = items.findLast((i) => i.kind === 'roundtable')
  return item?.kind === 'roundtable' ? item : undefined
}

/** Tour d'après son identifiant. */
export function findRoundtable(
  items: readonly TranscriptItem[],
  roundtableId: string
): RoundtableItem | undefined {
  const item = items.findLast((i) => i.kind === 'roundtable' && i.roundtableId === roundtableId)
  return item?.kind === 'roundtable' ? item : undefined
}

/**
 * Conversations des participants de tous les tours du fil : un seul point pour les exclure des
 * nouvelles des travaux (`childContext`), des outils de l'agent et du réveil groupé (ADR-0072).
 */
export function participantIds(items: readonly TranscriptItem[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'roundtable') continue
    for (const seat of item.seats) if (seat.childId) ids.add(seat.childId)
  }
  return ids
}

// ---------------------------------------------------------------------------------------------
// Sélection des participants

/** Clé d'un participant : son agent et son modèle (deux fois le même couple est refusé). */
export const choiceKey = (choice: RoundtableChoice): string =>
  `${choice.profileId}\u0000${choice.model?.value ?? ''}`

/** Ce que la sélection a besoin de savoir d'un agent. */
export interface RoundtableAgentFacts {
  id: string
  available: boolean
  /** Le modèle se choisit (`childModelChoice`) ; sinon une seule place, sans modèle. */
  modelChoice: boolean
}

export type RoundtableSelectionProblem =
  | 'too-few'
  | 'too-many'
  | 'duplicate'
  | 'single-seat'
  | 'model-not-allowed'
  | 'unknown-agent'
  | 'unavailable'

/**
 * Vérifie une sélection : 2 à 5 participants, aucun doublon d'agent et de modèle, une seule place
 * pour un agent sans choix de modèle (et sans modèle), agents connus et disponibles. Rend le
 * premier problème (et la place concernée), ou `undefined`.
 */
export function selectionProblem(
  choices: readonly RoundtableChoice[],
  agents: readonly RoundtableAgentFacts[]
): { problem: RoundtableSelectionProblem; index?: number } | undefined {
  const seen = new Set<string>()
  const single = new Set<string>()
  for (const [index, choice] of choices.entries()) {
    const agent = agents.find((a) => a.id === choice.profileId)
    if (!agent) return { problem: 'unknown-agent', index }
    if (!agent.available) return { problem: 'unavailable', index }
    if (!agent.modelChoice) {
      if (choice.model) return { problem: 'model-not-allowed', index }
      if (single.has(agent.id)) return { problem: 'single-seat', index }
      single.add(agent.id)
    }
    const key = choiceKey(choice)
    if (seen.has(key)) return { problem: 'duplicate', index }
    seen.add(key)
  }
  if (choices.length < ROUNDTABLE_MIN_SEATS) return { problem: 'too-few' }
  if (choices.length > ROUNDTABLE_MAX_SEATS) return { problem: 'too-many' }
  return undefined
}

/**
 * Case cochée ou décochée dans le menu des participants : retire le couple s'il y est, sinon
 * l'ajoute, sauf au-delà de 5 (la liste reste telle quelle). Un agent sans choix de modèle ne
 * prend jamais de modèle.
 */
export function toggleChoice(
  choices: readonly RoundtableChoice[],
  choice: RoundtableChoice,
  modelChoice: boolean
): RoundtableChoice[] {
  const wanted: RoundtableChoice = modelChoice ? choice : { profileId: choice.profileId }
  const key = choiceKey(wanted)
  if (choices.some((c) => choiceKey(c) === key)) return choices.filter((c) => choiceKey(c) !== key)
  if (choices.length >= ROUNDTABLE_MAX_SEATS) return choices.slice()
  return [...choices, wanted]
}

/** Places de travaux qui manquent pour lancer `count` participants (0 : assez). */
export const missingSlots = (count: number, free: number): number => Math.max(0, count - free)

/**
 * Lettres des participants, dans un ordre mélangé à chaque tour (décision D1) : la lettre de la
 * place `i` est `letters[i]`. L'aléa est injecté (`Math.random` en vrai) pour les essais.
 */
export function shuffledLetters(count: number, random: () => number): RoundtableLetter[] {
  const letters: RoundtableLetter[] = ROUNDTABLE_LETTERS.slice(
    0,
    Math.max(0, Math.min(count, ROUNDTABLE_MAX_SEATS))
  )
  for (let i = letters.length - 1; i > 0; i--) {
    const r = random()
    const j = Math.min(i, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * (i + 1))))
    const a = letters[i] as RoundtableLetter
    letters[i] = letters[j] as RoundtableLetter
    letters[j] = a
  }
  return letters
}

/** Places d'un nouveau tour : un participant par choix, lettres tirées, en attente. */
export function newSeats(
  participants: readonly RoundtableParticipant[],
  random: () => number
): RoundtableSeat[] {
  const letters = shuffledLetters(participants.length, random)
  return participants.map((participant, index) => ({
    ...participant,
    letter: letters[index] as RoundtableLetter,
    state: 'waiting'
  }))
}

// ---------------------------------------------------------------------------------------------
// Total consommé (pied de la carte)

/** Total d'un tour, par unité, sans conversion : seulement ce que les agents ont communiqué. */
export interface RoundtableTotal {
  /** Jetons communiqués, tous tours confondus ; absent si aucun agent n'en donne. */
  tokens?: number
  /** Un montant par unité (« USD », « bobcoin »…), dans l'ordre d'apparition. */
  costs: { amount: number; currency: string }[]
  /** Participants qui n'ont rien communiqué (« 1 participant sans chiffre »). */
  silent: number
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

const digestTokens = (d: UsageDigest): number | undefined =>
  d.total ??
  (d.input !== undefined || d.output !== undefined ? (d.input ?? 0) + (d.output ?? 0) : undefined)

/**
 * Total du pied de la carte : les conversations des participants (avis et répliques) et les tours
 * de l'agent de la conversation marqués « tour de table » (synthèse, décision). Jamais
 * d'addition entre unités (`digestsTotal` de la fiche 266 suit la même règle).
 */
export function roundtableTotal(
  participants: readonly (UsageDigest | undefined)[],
  steps: readonly (UsageDigest | undefined)[] = []
): RoundtableTotal {
  let tokens: number | undefined
  const costs: { amount: number; currency: string }[] = []
  let silent = 0
  const add = (digest: UsageDigest | undefined, participant: boolean) => {
    const used = digest ? digestTokens(digest) : undefined
    const cost = digest?.cost
    if (participant && used === undefined && !cost) silent++
    if (used !== undefined) tokens = (tokens ?? 0) + used
    if (!cost) return
    const same = costs.find((c) => c.currency === cost.currency)
    if (same) same.amount = round6(same.amount + cost.amount)
    else costs.push({ amount: round6(cost.amount), currency: cost.currency })
  }
  for (const digest of participants) add(digest, true)
  for (const digest of steps) add(digest, false)
  return { ...(tokens !== undefined ? { tokens } : {}), costs, silent }
}
