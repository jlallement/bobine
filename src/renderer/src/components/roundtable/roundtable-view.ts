/**
 * Tour de table (fiche 285) : ce que l'interface dit, sans rendu. La ligne de la saisie (forme,
 * infobulle), les cases du menu des participants, le pied « Consommé », les lettres de la synthèse
 * et les tours de l'agent de la conversation marqués « tour de table ». Pur : essayé à part.
 *
 * Le main fait autorité (sélection, places, phase) ; ici, on ne fait que montrer ce qu'il dira, pour
 * que l'utilisateur le sache avant d'appuyer sur Entrée.
 */
import i18next from 'i18next'
import { currentLocale } from '@shared/i18n/format'
import { shortModelName } from '@shared/models'
import {
  choiceKey,
  missingSlots,
  ROUNDTABLE_MAX_SEATS,
  ROUNDTABLE_MIN_SEATS,
  selectionProblem,
  tokenMultiplier,
  type RoundtableChoice,
  type RoundtableSeat,
  type RoundtableTotal
} from '@shared/roundtable'
import type { RoundtableAgentOption, RoundtableOptions } from '@shared/roundtable-ipc'
import type { DataDestination, HandoverModel } from '@shared/handover'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { formatEstimate, formatTokens } from '@shared/usage'

type Report = Extract<TranscriptItem, { kind: 'child-report' }>

// ---------------------------------------------------------------------------------------------
// Ligne du tour de table, dans la saisie

/**
 * Forme de la ligne :
 * - `refused` : le tour ne peut pas partir d'ici (travail, archivée, discussion, tour en cours) ;
 * - `choose` : moins de deux participants retenus (premier usage) : Entrée ouvre le menu ;
 * - `unavailable` : un participant retenu n'est plus disponible : Entrée ouvre le menu ;
 * - `slots` : places de travaux manquantes : rien ne part ;
 * - `ready` : Entrée envoie.
 */
export type LineState =
  | { kind: 'refused'; refused: NonNullable<RoundtableOptions['refused']> }
  | { kind: 'choose' }
  | { kind: 'unavailable'; agent: string }
  | { kind: 'slots'; missing: number; count: number }
  | { kind: 'ready'; count: number; multiplier: number }

/** Nom d'un agent d'après les options, sinon son identifiant. */
const agentName = (options: RoundtableOptions | undefined, profileId: string): string =>
  options?.agents.find((a) => a.profileId === profileId)?.label ?? profileId

/**
 * Forme de la ligne pour les participants retenus. Sans options (pas encore lues) : seule la
 * quantité compte, le main vérifiera le reste à l'envoi.
 */
export function lineState(
  choices: readonly RoundtableChoice[],
  options: RoundtableOptions | undefined
): LineState {
  if (options?.refused) return { kind: 'refused', refused: options.refused }
  if (options) {
    const facts = options.agents.map((a) => ({
      id: a.profileId,
      available: a.available,
      modelChoice: a.modelChoice
    }))
    const problem = selectionProblem(choices, facts)
    if (
      problem?.index !== undefined &&
      (problem.problem === 'unavailable' || problem.problem === 'unknown-agent')
    ) {
      const choice = choices[problem.index]
      return { kind: 'unavailable', agent: choice ? agentName(options, choice.profileId) : '' }
    }
  }
  if (choices.length < ROUNDTABLE_MIN_SEATS) return { kind: 'choose' }
  const count = Math.min(choices.length, ROUNDTABLE_MAX_SEATS)
  const missing = options ? missingSlots(count, options.freeSlots) : 0
  if (missing > 0) return { kind: 'slots', missing, count }
  return { kind: 'ready', count, multiplier: tokenMultiplier(count) }
}

/** Entrée dans la ligne : envoyer, ouvrir le menu, ou rien (la ligne dit déjà pourquoi). */
export function enterAction(state: LineState): 'send' | 'menu' | 'none' {
  if (state.kind === 'ready') return 'send'
  if (state.kind === 'choose' || state.kind === 'unavailable') return 'menu'
  return 'none'
}

/** Ce qu'une destination dit en peu de mots (fiche 108) : le fournisseur, ou le service. */
export function destinationName(destination: DataDestination): string | undefined {
  if (destination.kind === 'provider') return destination.name
  if (destination.kind === 'prefix') return destination.provider
  if (destination.kind === 'agent') return destination.text
  return undefined
}

/** Une ligne de l'infobulle : les modèles d'un même agent, l'agent, et où vont les données. */
export interface ParticipantGroup {
  agent: string
  models: string[]
  /** Fournisseurs ou service connus, sans doublon. */
  destinations: string[]
}

/** Nom affiché d'un participant retenu : son modèle (nom court), sinon son agent. */
export const choiceLabel = (choice: RoundtableChoice, agent: string): string =>
  choice.model ? shortModelName(choice.model.name) : agent

/** Destination d'un participant retenu, d'après ce que le main sait de son agent et de ses modèles. */
function choiceDestination(
  choice: RoundtableChoice,
  agent: RoundtableAgentOption | undefined
): string | undefined {
  if (!agent) return undefined
  const model = choice.model
    ? [...agent.recent, ...agent.others].find((m) => m.value === choice.model?.value)
    : undefined
  return destinationName(model?.destination ?? agent.destination)
}

/** Infobulle de « N participants » : un agent par ligne, dans l'ordre des participants. */
export function participantGroups(
  choices: readonly RoundtableChoice[],
  options: RoundtableOptions | undefined
): ParticipantGroup[] {
  const groups: ParticipantGroup[] = []
  for (const choice of choices) {
    const agent = options?.agents.find((a) => a.profileId === choice.profileId)
    const name = agent?.label ?? choice.profileId
    let group = groups.find((g) => g.agent === name)
    if (!group) {
      group = { agent: name, models: [], destinations: [] }
      groups.push(group)
    }
    group.models.push(choiceLabel(choice, name))
    const destination = choiceDestination(choice, agent)
    if (destination && !group.destinations.includes(destination))
      group.destinations.push(destination)
  }
  return groups
}

/** « A et B », « A, B et C » dans la langue de l'interface. */
export const listText = (parts: readonly string[]): string =>
  new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(parts)

/** Ce qui part avec la question (fin de l'infobulle) : la clé de la phrase. */
export function sendsKey(
  files: boolean,
  lastExchange: boolean
):
  | 'roundtable.line.sendsAll'
  | 'roundtable.line.sendsFiles'
  | 'roundtable.line.sendsExchange'
  | 'roundtable.line.sendsQuestion' {
  if (files && lastExchange) return 'roundtable.line.sendsAll'
  if (files) return 'roundtable.line.sendsFiles'
  if (lastExchange) return 'roundtable.line.sendsExchange'
  return 'roundtable.line.sendsQuestion'
}

// ---------------------------------------------------------------------------------------------
// Menu des participants

/** Une case du menu : un couple agent et modèle, ou un agent sans choix de modèle (une ligne). */
export interface MenuEntry {
  key: string
  choice: RoundtableChoice
  label: string
  agentLabel: string
  modelChoice: boolean
  checked: boolean
  /** Case désactivée : 5 déjà cochées, ou agent indisponible ; la raison est dite. */
  disabled?: 'full' | 'unavailable'
  reason?: string
}

const modelChoiceOf = (agent: RoundtableAgentOption, model: HandoverModel): RoundtableChoice =>
  agent.controlId
    ? {
        profileId: agent.profileId,
        model: { controlId: agent.controlId, value: model.value, name: model.name }
      }
    : { profileId: agent.profileId }

/** L'agent permet-il de choisir des modèles ici ? (`childModelChoice` et un réglage connu). */
const choosesModel = (agent: RoundtableAgentOption): boolean =>
  agent.modelChoice && !!agent.controlId && agent.recent.length + agent.others.length > 0

function entryOf(
  agent: RoundtableAgentOption,
  choice: RoundtableChoice,
  chosen: ReadonlySet<string>,
  full: boolean
): MenuEntry {
  const key = choiceKey(choice)
  const checked = chosen.has(key)
  const disabled = !checked
    ? !agent.available
      ? ('unavailable' as const)
      : full
        ? ('full' as const)
        : undefined
    : undefined
  const reason =
    disabled === 'unavailable'
      ? agent.reason
      : disabled === 'full'
        ? i18next.t('roundtable.menu.full')
        : undefined
  return {
    key,
    choice,
    label: choiceLabel(choice, agent.label),
    agentLabel: agent.label,
    modelChoice: choosesModel(agent),
    checked,
    ...(disabled ? { disabled } : {}),
    ...(reason ? { reason } : {})
  }
}

/**
 * Cases du menu, dans un ordre stable (l'ordre des agents, puis de leurs modèles) : les modèles
 * récents de chaque agent (et ceux déjà cochés), une ligne pour un agent sans choix de modèle ;
 * puis, derrière « Autres modèles… », les autres modèles connus. Aucun modèle mis à part.
 */
export function menuEntries(
  options: RoundtableOptions | undefined,
  choices: readonly RoundtableChoice[]
): { main: MenuEntry[]; others: MenuEntry[] } {
  const chosen = new Set(choices.map(choiceKey))
  const full = choices.length >= ROUNDTABLE_MAX_SEATS
  const main: MenuEntry[] = []
  const others: MenuEntry[] = []
  for (const agent of options?.agents ?? []) {
    if (!choosesModel(agent)) {
      main.push(entryOf(agent, { profileId: agent.profileId }, chosen, full))
      continue
    }
    const shown = new Set<string>()
    for (const model of agent.recent) {
      const entry = entryOf(agent, modelChoiceOf(agent, model), chosen, full)
      shown.add(entry.key)
      main.push(entry)
    }
    for (const model of agent.others) {
      const entry = entryOf(agent, modelChoiceOf(agent, model), chosen, full)
      if (shown.has(entry.key)) continue
      shown.add(entry.key)
      // Coché parmi les autres : montré avec les récents, pour qu'on voie ce qui part.
      ;(entry.checked ? main : others).push(entry)
    }
  }
  return { main, others }
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Recherche dans « Autres modèles… », sans casse ni accents, sur le modèle et l'agent. */
export function searchEntries(entries: readonly MenuEntry[], query: string): MenuEntry[] {
  const wanted = fold(query.trim())
  if (!wanted) return entries.slice()
  return entries.filter((e) =>
    fold(`${e.label} ${e.agentLabel} ${e.choice.model?.value ?? ''}`).includes(wanted)
  )
}

// ---------------------------------------------------------------------------------------------
// Carte : total, lettres, réponses

/** « 47,5k jetons · ≈ 0,06 $US + 0,42 Bobcoin · 1 participant sans chiffre » ; rien : `undefined`. */
export function totalText(total: RoundtableTotal): string | undefined {
  const parts: string[] = []
  if (total.tokens !== undefined)
    parts.push(i18next.t('roundtable.card.tokens', { tokens: formatTokens(total.tokens, true) }))
  if (total.costs.length) parts.push(total.costs.map((c) => formatEstimate(c)).join(' + '))
  if (total.silent > 0) parts.push(i18next.t('roundtable.card.silent', { count: total.silent }))
  // Seulement des participants muets : rien d'utile à dire en pied.
  if (total.tokens === undefined && total.costs.length === 0) return undefined
  return parts.join(' · ')
}

/** Nom montré au survol d'une lettre : « DeepSeek V4.1 Flash · OpenCode », « IBM Bob ». */
export const seatName = (seat: Pick<RoundtableSeat, 'label' | 'agentLabel'>): string =>
  seat.agentLabel && seat.agentLabel !== seat.label
    ? `${seat.label} · ${seat.agentLabel}`
    : seat.label

/** Table des lettres, côté interface seulement (décision D1). */
export function letterNames(seats: readonly RoundtableSeat[]): Readonly<Record<string, string>> {
  return Object.fromEntries(seats.map((s) => [s.letter, seatName(s)]))
}

/**
 * Réponses d'un participant : son avis et sa réplique, désignés par l'heure d'envoi de la question
 * (de la réplique) que le main garde sur la place (`askedAt`) et que porte le compte rendu qui y
 * répond. Rien n'est deviné de l'ordre des comptes rendus : sans heure connue, pas de réponse.
 */
export function seatReports(
  work: Pick<WorkCardData, 'steps'> | undefined,
  seat: Pick<RoundtableSeat, 'askedAt' | 'rebuttal'>
): { opinion?: Report; rebuttal?: Report } {
  const reports = (work?.steps ?? []).flatMap((s) => (s.kind === 'report' ? [s.item] : []))
  const answering = (askedAt: number | undefined) =>
    askedAt === undefined
      ? undefined
      : reports.findLast((r) => r.askedAt === askedAt && r.outcome !== 'error')
  const opinion = answering(seat.askedAt)
  const rebuttal = answering(seat.rebuttal?.askedAt)
  return { ...(opinion ? { opinion } : {}), ...(rebuttal ? { rebuttal } : {}) }
}

/** Le texte d'une réponse de participant : entière si gardée, sinon son extrait. */
export const reportText = (report: Report): string => report.reply ?? report.excerpt

/** Ce qu'une réplique dit en une ligne, après sa position : sa première phrase utile. */
export function rebuttalSummary(text: string, max = 240): string | undefined {
  const line = text
    .split('\n')
    .map((l) =>
      l
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[-•–]\s*/, '')
        .trim()
    )
    .find((l) => l && !/^position\b/iu.test(l))
  if (!line) return undefined
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** Durée d'un participant : en cours, depuis son départ ; fini, de son départ à sa fin. */
export function seatElapsed(
  seat: Pick<RoundtableSeat, 'startedAt' | 'endedAt' | 'state'>,
  now: number
): number | undefined {
  if (seat.startedAt === undefined) return undefined
  if (seat.endedAt !== undefined) return Math.max(0, seat.endedAt - seat.startedAt)
  return seat.state === 'working' || seat.state === 'waiting'
    ? Math.max(0, now - seat.startedAt)
    : undefined
}

// ---------------------------------------------------------------------------------------------
// Tours de l'agent de la conversation : synthèse et décision

/** Une demande de synthèse ou de décision, et les réponses de l'agent qui la suivent. */
export interface RoundtableTurn {
  roundtableId: string
  step: 'synthesis' | 'verdict'
  /** Le message de l'app (provenance `roundtable`). */
  request: number
  /** Réponses de l'agent jusqu'au message suivant, dans l'ordre. */
  answers: number[]
}

/**
 * Tours de l'agent ouverts par une demande du tour de table : la réponse qui suit porte l'étiquette
 * « Synthèse du tour de table » (ou « Décision… ») et ses lettres montrent les vrais noms.
 */
export function roundtableTurns(items: readonly TranscriptItem[]): {
  byRequest: ReadonlyMap<number, RoundtableTurn>
  byAnswer: ReadonlyMap<number, RoundtableTurn>
} {
  const byRequest = new Map<number, RoundtableTurn>()
  const byAnswer = new Map<number, RoundtableTurn>()
  let open: RoundtableTurn | undefined
  for (const item of items) {
    if (item.kind === 'user') {
      open =
        item.from?.kind === 'roundtable'
          ? { roundtableId: item.from.id, step: item.from.step, request: item.id, answers: [] }
          : undefined
      if (open) byRequest.set(item.id, open)
    } else if (item.kind === 'agent' && open) {
      open.answers.push(item.id)
      byAnswer.set(item.id, open)
    }
  }
  return { byRequest, byAnswer }
}
