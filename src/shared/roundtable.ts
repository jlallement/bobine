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
import { processedTokens, type UsageDigest } from './usage'

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
  /**
   * Question retenue par le plafond de sa conversation (fiche 157) : la place attend « Continuer »
   * dans cette conversation (ou l'arrêt) ; elle n'est ni finie ni en erreur.
   */
  held?: true
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
  /** Agent et modèle de la conversation au moment où la demande est partie (étiquette). */
  by?: { profileId: string; label: string; model?: string }
  /**
   * Ce qu'a consommé l'étape, tel que l'agent l'a communiqué : **toutes** ses tentatives, celles
   * en erreur ou arrêtées comprises (contre-recette N3).
   */
  usage?: UsageDigest
  /**
   * Tentatives de l'étape (interne au réducteur, `usage` en est la somme) : chacune désignée par
   * l'heure de son départ (`at`), avec le coût cumulé de la conversation à son départ et le
   * dernier relevé qui lui revient. Un coût communiqué en retard va à sa tentative, quel que soit
   * l'ordre d'arrivée (passe sur la course du coût tardif).
   */
  attempts?: StepAttempt[]
  detail?: string
  /**
   * Le dossier a changé pendant le tour de l'étape (agent qui écrit sans demander, fiche 285, S1) :
   * la synthèse ou la décision devait se faire en lecture seule.
   */
  changedFolder?: true
  /** Quelques fichiers touchés, lus dans `git status` (au plus `STEP_CHANGED_FILES`). */
  changedFiles?: string[]
  /**
   * L'agent a lancé une commande pendant le tour de l'étape (outil `execute` parti, pas refusé) :
   * la lecture seule n'était que demandée (recette de la 1.2.0-beta.1, G-B2).
   */
  ranCommand?: true
}

/** Une tentative d'une étape : ses jetons, et son coût en relevés cumulés de la conversation. */
export interface StepAttempt {
  at: number
  /** Jetons et tours communiqués (le coût est relevé à part, `costStart` / `costEnd`). */
  usage?: UsageDigest
  costStart?: number
  /**
   * Départ inconnu : le coût tardif du tour d'avant n'était pas relu à temps (fiche 285, fix16).
   * Son coût n'est pas compté : un total peut être un peu bas, jamais gonflé.
   */
  startUnknown?: true
  costEnd?: { amount: number; currency: string }
}

/** Fichiers touchés gardés sur une étape qui a changé le dossier, au plus. */
export const STEP_CHANGED_FILES = 8
const STEP_FILE_CHARS = 200

/** Quelques fichiers touchés, bornés en nombre et en longueur. */
export const boundedFiles = (files: readonly string[]): string[] =>
  files
    .slice(0, STEP_CHANGED_FILES)
    .map((f) => (f.length > STEP_FILE_CHARS ? `${f.slice(0, STEP_FILE_CHARS - 1)}…` : f))

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
  /** « Arrêter le tour de table » demandé : les participants s'arrêtent, puis `stopped`. */
  stopping?: true
  /**
   * Le dossier a changé pendant le recueil, ou pendant la réplique (fiche 285, S1 de la passe de
   * contrôle) : un fait du tour, avec quelques fichiers lus dans `git status` (au plus
   * `STEP_CHANGED_FILES`, liste vide si `git status` ne les montre pas). Seule une place à qui
   * l'écart est attribuable porte `changedFolder`.
   */
  folderChanged?: { collecting?: string[]; rebuttal?: string[] }
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
  | {
      type: 'seat-working'
      letter: RoundtableLetter
      at: number
      askedAt?: number
      /** Nom du modèle tel que la session du participant l'annonce : remplace le libellé. */
      label?: string
    }
  /** Question retenue par le plafond de la conversation du participant. */
  | { type: 'seat-held'; letter: RoundtableLetter; at: number }
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
  | {
      type: 'step-sent'
      step: RoundtableStepKind
      at: number
      /** Coût cumulé de la conversation au départ de la tentative. */
      costStart?: number
      /** Coût cumulé au départ inconnu (relecture du tour d'avant pas arrivée à temps). */
      startUnknown?: true
      /** Agent et modèle réellement utilisés pour cette demande. */
      by?: RoundtableStep['by']
    }
  | { type: 'step-held'; step: RoundtableStepKind }
  /**
   * La demande est repartie sur un autre modèle (refusé, puis un autre choisi : `resent`) : le
   * modèle qui rédige vraiment, pour l'étiquette (testeur de la fiche 292).
   */
  | { type: 'step-model'; step: RoundtableStepKind; model: string }
  | {
      type: 'step-answered'
      step: RoundtableStepKind
      usage?: UsageDigest
      /** Coût cumulé de la conversation à la fin de la tentative. */
      costEnd?: { amount: number; currency: string }
      at: number
    }
  | {
      type: 'step-failed'
      step: RoundtableStepKind
      detail?: string
      usage?: UsageDigest
      costEnd?: { amount: number; currency: string }
    }
  /** Coût communiqué après coup (Bob) : remplace la consommation du tour de l'agent. */
  | {
      type: 'step-usage'
      step: RoundtableStepKind
      /** Tentative visée (`at` de son départ) ; absente : la dernière. */
      attempt?: number
      /** Coût cumulé de la conversation relevé après coup. */
      costEnd?: { amount: number; currency: string }
      usage?: UsageDigest
    }
  /** Le dossier a changé pendant le tour de l'étape (constaté après sa réponse). */
  | { type: 'step-changed-folder'; step: RoundtableStepKind; files: string[] }
  /** L'agent a lancé une commande pendant le tour de l'étape. */
  | { type: 'step-ran-command'; step: RoundtableStepKind }
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
  /** Le dossier a changé pendant le recueil ou la réplique (constaté à sa fin). */
  | { type: 'folder-changed'; stage: 'collecting' | 'rebuttal'; files: string[] }
  /** Arrêt demandé, en cours (les participants s'arrêtent d'abord). */
  | { type: 'stopping'; at: number }

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

/** Question partie : au travail, la question retenue n'attend plus, le nom lu dans la session. */
function working(
  seat: RoundtableSeat,
  event: Extract<RoundtableEvent, { type: 'seat-working' }>
): RoundtableSeat {
  const { held: _held, ...rest } = seat
  const label = event.label?.trim()
  return {
    ...rest,
    state: 'working',
    ...(event.askedAt !== undefined ? { askedAt: event.askedAt } : {}),
    ...(label && rest.model ? { label, model: { ...rest.model, name: label } } : {})
  }
}

const withoutHeld = ({ held: _held, ...seat }: RoundtableSeat): RoundtableSeat => seat

/** Participant arrêté s'il n'a pas fini. */
const stopIfRunning =
  (reason: RoundtableStopReason, at: number) =>
  (seat: RoundtableSeat): RoundtableSeat =>
    seatFinished(seat.state)
      ? seat
      : { ...withoutHeld(seat), state: 'stopped', stopped: reason, endedAt: at }

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

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

const plus = (a: number | undefined, b: number | undefined) =>
  a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0)

/** Somme de deux consommations (jetons ; coût s'il est dans la même unité, sinon le premier). */
export function addDigests(a: UsageDigest | undefined, b: UsageDigest | undefined) {
  if (!a || !b) return a ?? b
  const sum: UsageDigest = {}
  for (const key of ['input', 'output', 'total', 'turns'] as const) {
    const value = plus(a[key], b[key])
    if (value !== undefined) sum[key] = value
  }
  const cost =
    a.cost && b.cost && a.cost.currency === b.cost.currency
      ? { amount: round6(a.cost.amount + b.cost.amount), currency: a.cost.currency }
      : (a.cost ?? b.cost)
  return { ...sum, ...(cost ? { cost } : {}) }
}

/**
 * Total des tentatives. Jetons : additionnés. Coût : chaque tentative compte l'écart entre son
 * dernier relevé et son départ, sans jamais recouvrir l'intervalle d'une autre (un relevé tardif
 * qui comprend déjà le coût d'une tentative suivante n'est pas compté deux fois). Sans relevé, le
 * coût du tour tel que communiqué.
 */
export function attemptsTotal(
  attempts: readonly StepAttempt[],
  /** Coût déjà compté par une étape d'avant (la synthèse, pour la décision). */
  floor?: number
): UsageDigest | undefined {
  const sorted = [...attempts].sort((a, b) => a.at - b.at)
  let total: UsageDigest | undefined
  let covered: number | undefined = floor
  let cost: { amount: number; currency: string } | undefined
  for (const attempt of sorted) {
    const { cost: turnCost, ...tokens } = attempt.usage ?? {}
    if (Object.keys(tokens).length) total = addDigests(total, tokens)
    const end = attempt.costEnd
    // Départ inconnu : l'écart pourrait comprendre le tour d'avant, il n'est pas compté (le
    // relevé borne quand même les tentatives suivantes).
    if (attempt.startUnknown) {
      if (end) covered = Math.max(covered ?? -Infinity, end.amount)
      continue
    }
    if (!end) {
      if (turnCost) cost = addDigests(cost ? { cost } : undefined, { cost: turnCost })?.cost
      continue
    }
    const start = Math.max(attempt.costStart ?? covered ?? 0, covered ?? -Infinity)
    const amount = round6(Math.max(0, end.amount - start))
    cost = addDigests(cost ? { cost } : undefined, {
      cost: { amount, currency: end.currency }
    })?.cost
    covered = Math.max(covered ?? -Infinity, end.amount)
  }
  // Modèles gratuits (fiche 266) : un coût nul y est « gratuit », pas « coût inconnu » (G-B1).
  const used = sorted.flatMap((a) => (a.usage ? [a.usage] : []))
  const free = used.length > 0 && used.every((u) => u.free === true)
  const result = cost ? { ...total, cost } : total
  return result && free ? { ...result, free: true } : result
}

/** Résultat de la tentative visée (la dernière par défaut) : le total est recalculé. */
function withAttempt(
  step: RoundtableStep,
  change: { usage?: UsageDigest | undefined; costEnd?: StepAttempt['costEnd'] },
  at = step.attempts?.at(-1)?.at
): RoundtableStep {
  const attempts = step.attempts ?? []
  const index = attempts.findIndex((a) => a.at === at)
  if (index === -1) return step
  const current = attempts[index] as StepAttempt
  const next: StepAttempt = {
    ...current,
    ...(change.usage ? { usage: change.usage } : {}),
    ...(change.costEnd ? { costEnd: change.costEnd } : {})
  }
  const all = attempts.map((a, i) => (i === index ? next : a))
  const usage = attemptsTotal(all)
  return { ...step, attempts: all, ...(usage ? { usage } : {}) }
}

/** Dernier relevé de coût des tentatives d'une étape. */
const lastCost = (step: RoundtableStep | undefined): number | undefined => {
  const ends = (step?.attempts ?? []).flatMap((a) => (a.costEnd ? [a.costEnd.amount] : []))
  return ends.length ? Math.max(...ends) : undefined
}

/**
 * La décision ne recouvre pas la synthèse : un relevé tardif de la synthèse, arrivé pendant la
 * décision, reste à la synthèse (machine lente, CI du 2026-11-25). Recalculé à chaque évènement.
 */
function recount(rt: Roundtable): Roundtable {
  const verdict = rt.verdict
  if (!verdict?.attempts) return rt
  const usage = attemptsTotal(verdict.attempts, lastCost(rt.synthesis))
  return usage ? { ...rt, verdict: { ...verdict, usage } } : rt
}

/** Nouvelle tentative d'une étape : ses tentatives passées et leur total restent. */
const carried = (step: RoundtableStep | undefined) => ({
  ...(step?.usage ? { usage: step.usage } : {}),
  ...(step?.attempts ? { attempts: step.attempts } : {})
})

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
      ...carried(rt.synthesis),
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
      ...carried(rt.verdict),
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
      return running
        ? withStep(rt, key, {
            ...step,
            state: 'sent',
            sentAt: event.at,
            ...(event.by ? { by: event.by } : {}),
            attempts: [
              // Étape d'une version d'avant le suivi par tentative : son total reste.
              ...(step.attempts ?? (step.usage ? [{ at: -1, usage: step.usage }] : [])),
              {
                at: event.at,
                ...(event.costStart !== undefined ? { costStart: event.costStart } : {}),
                ...(event.startUnknown ? { startUnknown: true as const } : {})
              }
            ]
          })
        : rt
    case 'step-held':
      return running ? withStep(rt, key, { ...step, state: 'held' }) : rt
    case 'step-model':
      return step.state === 'sent' && step.by
        ? withStep(rt, key, { ...step, by: { ...step.by, model: event.model } })
        : rt
    case 'step-usage':
      // Coût communiqué après coup : à la tentative qu'il vise, même si une autre est en route.
      return withStep(rt, key, withAttempt(step, event, event.attempt))
    case 'step-ran-command':
      return step.state === 'waiting' || step.ranCommand
        ? rt
        : withStep(rt, key, { ...step, ranCommand: true })
    case 'step-changed-folder': {
      // Constaté à la fin du tour : l'étape a répondu (ou échoué) entre-temps.
      if (step.state === 'waiting') return rt
      const files = boundedFiles(event.files)
      return withStep(rt, key, {
        ...step,
        changedFolder: true,
        ...(files.length ? { changedFiles: files } : {})
      })
    }
    case 'step-failed':
      // Tour arrêté entre-temps : sa consommation compte encore.
      if (!running) return withStep(rt, key, withAttempt(step, event))
      return {
        ...withStep(rt, key, {
          ...withAttempt(step, event),
          state: 'failed',
          ...bounded(event.detail)
        }),
        phase: 'interrupted',
        interruptedFrom: key === 'synthesis' ? 'synthesizing' : 'deciding'
      }
    case 'step-answered': {
      if (!running) return rt
      const answered: RoundtableStep = {
        ...withAttempt(step, event),
        state: 'answered',
        answeredAt: event.at
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
        ? withSeat(rt, event.letter, (s) => (s.state === 'waiting' ? working(s, event) : s))
        : rt
    case 'seat-held':
      return collecting
        ? withSeat(rt, event.letter, (s) => (seatFinished(s.state) ? s : { ...s, held: true }))
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
                  ...withoutHeld(s),
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
        // La durée repart de cette tentative.
        return { ...seat, state: 'waiting', startedAt: event.at }
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
    case 'folder-changed':
      return {
        ...rt,
        folderChanged: { ...rt.folderChanged, [event.stage]: boundedFiles(event.files) }
      }
    case 'stopping':
      if (!RUNNING_PHASES.has(rt.phase) && rt.phase !== 'interrupted') return rt
      return rt.stopping ? rt : { ...rt, stopping: true }
    case 'stop': {
      if (!RUNNING_PHASES.has(rt.phase) && rt.phase !== 'interrupted') return rt
      const { interruptedFrom: _from, stopping: _stopping, ...rest } = rt
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
    case 'step-model':
    case 'step-answered':
    case 'step-failed':
    case 'step-usage':
    case 'step-changed-folder':
    case 'step-ran-command':
      return recount(reduceStep(rt, event))
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
  /** L'arbitre (agent et modèle de la conversation) ne peut pas être aussi participant. */
  | 'arbiter'

/**
 * Arbitre d'un tour (décision du tech lead, recette du 2026-11-25) : l'agent de la conversation et
 * son modèle ; pour un agent sans choix de modèle, l'agent seul. Il ne peut pas être participant :
 * il jugerait son propre avis.
 */
export interface RoundtableArbiter {
  profileId: string
  /** Valeur du modèle de la session ; absente : inconnue, ou agent sans choix de modèle. */
  model?: string
}

/** Ce participant est l'arbitre (même agent ; même modèle si l'agent se choisit un modèle). */
export function isArbiter(
  choice: RoundtableChoice,
  arbiter: RoundtableArbiter | undefined,
  modelChoice: boolean
): boolean {
  if (!arbiter || choice.profileId !== arbiter.profileId) return false
  if (!modelChoice) return true
  return arbiter.model !== undefined && choice.model?.value === arbiter.model
}

/**
 * Vérifie une sélection : 2 à 5 participants, aucun doublon d'agent et de modèle, une seule place
 * pour un agent sans choix de modèle (et sans modèle), agents connus et disponibles. Rend le
 * premier problème (et la place concernée), ou `undefined`.
 */
export function selectionProblem(
  choices: readonly RoundtableChoice[],
  agents: readonly RoundtableAgentFacts[],
  arbiter?: RoundtableArbiter
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
    if (isArbiter(choice, arbiter, agent.modelChoice)) return { problem: 'arbiter', index }
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
  /**
   * Jetons traités (entrée + sortie, `processedTokens`), tous tours confondus : le nombre de Mon
   * activité et du compteur de la conversation, cache et réflexion à part (fiches 245, 292) ;
   * absent si aucun agent n'en donne.
   */
  tokens?: number
  /**
   * Un montant par unité (« USD », « bobcoin »…), dans l'ordre d'apparition. `free` : tout ce qui
   * compte dans cette unité vient de modèles gratuits (un total nul s'y lit « gratuit »).
   */
  costs: { amount: number; currency: string; free?: true }[]
}

/**
 * Total du pied de la carte (fiche 292, « un seul total juste ») : les conversations des
 * participants (avis et répliques), puis les tours de l'agent de la conversation lancés par le tour
 * (synthèse, décision). « Demander de l'appliquer », message ordinaire, n'en est pas. Jamais
 * d'addition entre unités (`digestsTotal` de la fiche 266 suit la même règle).
 */
export function roundtableTotal(digests: readonly (UsageDigest | undefined)[]): RoundtableTotal {
  let tokens: number | undefined
  const costs: { amount: number; currency: string; free?: true }[] = []
  const paid = new Set<string>()
  for (const digest of digests) {
    if (!digest) continue
    if (digest.input !== undefined || digest.output !== undefined)
      tokens = (tokens ?? 0) + processedTokens(digest)
    const cost = digest.cost
    if (!cost) continue
    if (digest.free !== true) paid.add(cost.currency)
    const same = costs.find((c) => c.currency === cost.currency)
    if (same) same.amount = round6(same.amount + cost.amount)
    else costs.push({ amount: round6(cost.amount), currency: cost.currency })
  }
  const marked = costs.map((c) => (paid.has(c.currency) ? c : { ...c, free: true as const }))
  return { ...(tokens !== undefined ? { tokens } : {}), costs: marked }
}
