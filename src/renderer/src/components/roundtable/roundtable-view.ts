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
  isArbiter,
  lastRoundtable,
  roundtableRunning,
  missingSlots,
  ROUNDTABLE_MAX_SEATS,
  ROUNDTABLE_MIN_SEATS,
  tokenMultiplier,
  type RoundtableArbiter,
  type RoundtableChoice,
  type RoundtableSeat,
  type RoundtableTotal
} from '@shared/roundtable'
import type { RoundtableAgentOption, RoundtableOptions } from '@shared/roundtable-ipc'
import { QUESTION_CHARS } from '@shared/roundtable-prompts'
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
  /** Question plus longue que ce que reçoivent les participants : à raccourcir avant l'envoi. */
  | { kind: 'question'; max: number }
  | { kind: 'choose' }
  | { kind: 'unavailable'; agent: string }
  /** Un participant retenu est l'arbitre (le modèle de la conversation a changé) : Entrée ouvre le menu. */
  | { kind: 'arbiter'; name: string }
  | { kind: 'slots'; missing: number; count: number }
  | { kind: 'ready'; count: number; multiplier: number }

/** Nom d'un agent d'après les options ; inconnu (agent retiré), un libellé générique. */
const agentName = (options: RoundtableOptions | undefined, profileId: string): string =>
  options?.agents.find((a) => a.profileId === profileId)?.label ??
  i18next.t('roundtable.line.unknownAgent')

/**
 * Pourquoi un participant retenu ne peut plus partir : agent retiré (`gone`), indisponible, ou
 * modèle qui n'est plus au catalogue de l'agent ou qu'il ne laisse pas choisir (`model`). Les
 * modèles d'un agent jamais lancé ne sont pas connus : rien n'est dit d'eux.
 */
export function choiceTrouble(
  choice: RoundtableChoice,
  options: RoundtableOptions
): 'gone' | 'arbiter' | 'unavailable' | 'model' | undefined {
  const agent = options.agents.find((a) => a.profileId === choice.profileId)
  if (!agent) return 'gone'
  // L'arbitre ne participe pas (décision du 2026-11-25) : il jugerait son propre avis.
  if (isArbiter(choice, options.arbiter, agent.modelChoice)) return 'arbiter'
  if (!agent.available) return 'unavailable'
  if (!choice.model) return undefined
  if (!agent.modelChoice) return 'model'
  const known = [...agent.recent, ...agent.others]
  return known.length > 0 && !known.some((m) => m.value === choice.model?.value)
    ? 'model'
    : undefined
}

/**
 * Forme de la ligne pour les participants retenus. Sans options (pas encore lues) : seule la
 * quantité compte, le main vérifiera le reste à l'envoi.
 */
export function lineState(
  choices: readonly RoundtableChoice[],
  options: RoundtableOptions | undefined,
  /** Longueur de la question tapée (sans les blancs autour). */
  questionChars = 0
): LineState {
  if (options?.refused) return { kind: 'refused', refused: options.refused }
  if (questionChars > QUESTION_CHARS) return { kind: 'question', max: QUESTION_CHARS }
  const broken = options ? choices.find((c) => choiceTrouble(c, options)) : undefined
  if (options && broken) {
    // Le modèle retiré se nomme lui-même ; sinon l'agent (ou un libellé générique s'il n'est plus).
    const agent = agentName(options, broken.profileId)
    if (choiceTrouble(broken, options) === 'arbiter')
      return { kind: 'arbiter', name: choiceLabel(broken, agent) }
    return {
      kind: 'unavailable',
      agent: choiceTrouble(broken, options) === 'model' ? choiceLabel(broken, agent) : agent
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
  if (state.kind === 'choose' || state.kind === 'unavailable' || state.kind === 'arbiter')
    return 'menu'
  return 'none'
}

/** Ce qu'une destination dit en peu de mots (fiche 108) : le fournisseur, ou le service. */
export function destinationName(destination: DataDestination): string | undefined {
  if (destination.kind === 'provider') return destination.name
  // Un préfixe de modèle (`fx/…`) n'est qu'un identifiant : jamais montré, l'agent suffit.
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
export const choiceLabel = (
  choice: RoundtableChoice,
  agent: string,
  /** L'agent se choisit un modèle, mais aucun n'est retenu : « <agent> · modèle par défaut ». */
  modelChoice = false
): string =>
  choice.model
    ? shortModelName(choice.model.name)
    : modelChoice
      ? i18next.t('roundtable.menu.defaultModel', { agent })
      : agent

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
    // Jamais un identifiant brut : le nom de l'agent, sinon le libellé générique.
    const name = agent?.label ?? i18next.t('roundtable.line.unknownAgent')
    let group = groups.find((g) => g.agent === name)
    if (!group) {
      group = { agent: name, models: [], destinations: [] }
      groups.push(group)
    }
    group.models.push(choiceLabel(choice, name, !!agent?.modelChoice))
    const destination = choiceDestination(choice, agent)
    if (destination && !group.destinations.includes(destination))
      group.destinations.push(destination)
  }
  return groups
}

/** Un agent sans choix de modèle : son nom seul, jamais « X · par X ». */
export const agentOnly = (group: ParticipantGroup): boolean =>
  group.models.length === 1 &&
  (group.models[0] === group.agent ||
    group.models[0] === i18next.t('roundtable.menu.defaultModel', { agent: group.agent }))

/**
 * Participants dans l'ordre du menu (B16) : la carte garde l'ordre des cases, pas celui des clics.
 * Un retenu absent du menu (agent retiré) garde sa place relative, à la fin.
 */
export function inMenuOrder(
  choices: readonly RoundtableChoice[],
  options: RoundtableOptions | undefined
): RoundtableChoice[] {
  const { main, others } = menuEntries(options, choices)
  const order = new Map([...main, ...others].map((e, i) => [e.key, i]))
  return [...choices].sort(
    (a, b) =>
      (order.get(choiceKey(a)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(choiceKey(b)) ?? Number.MAX_SAFE_INTEGER)
  )
}

/**
 * L'avis déplié sans sa rubrique « Réponse courte », quand elle a déjà servi au résumé de la ligne
 * (B9). Seule la première rubrique de ce nom part, jusqu'au titre suivant.
 */
export function withoutShortAnswer(text: string): string {
  const lines = text.split('\n')
  const heading = (l: string) => /^\s*(#{1,6}\s|\*\*|\d+[.)]\s)/.test(l)
  const start = lines.findIndex((l) => heading(l) && /(réponse courte|short answer)/iu.test(l))
  if (start === -1) return text
  let end = start + 1
  while (end < lines.length && !heading(lines[end] ?? '')) end++
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim()
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
  disabled?: 'full' | 'unavailable' | 'arbiter' | 'loading'
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
  full: boolean,
  arbiter?: RoundtableArbiter
): MenuEntry {
  const key = choiceKey(choice)
  const checked = chosen.has(key)
  // Le modèle de la conversation fait la synthèse : désactivé (coché, il reste décochable).
  if (isArbiter(choice, arbiter, agent.modelChoice)) {
    return {
      key,
      choice,
      label: choiceLabel(choice, agent.label, agent.modelChoice),
      agentLabel: agent.label,
      modelChoice: !!choice.model,
      checked,
      ...(checked ? {} : { disabled: 'arbiter' as const }),
      reason: i18next.t('roundtable.menu.arbiter')
    }
  }
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
    label: choiceLabel(choice, agent.label, agent.modelChoice),
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
  const listed = listedEntries(options, chosen, full)
  const keys = new Set([...listed.main, ...listed.others].map((e) => e.key))
  // Retenus mais plus proposés (agent retiré, modèle sorti du catalogue) : en tête, cochés,
  // décochables, avec leur raison ; jamais un fantôme qui part sans qu'on le voie.
  const orphans = options
    ? choices.filter((c) => !keys.has(choiceKey(c))).map((c) => orphanEntry(c, options))
    : []
  return { main: [...orphans, ...listed.main], others: listed.others }
}

function orphanEntry(choice: RoundtableChoice, options: RoundtableOptions): MenuEntry {
  const agent = agentName(options, choice.profileId)
  const trouble = choiceTrouble(choice, options)
  return {
    key: choiceKey(choice),
    choice,
    label: choiceLabel(choice, agent),
    agentLabel: agent,
    // Décocher retire le couple tel qu'il est retenu (modèle compris).
    modelChoice: !!choice.model,
    checked: true,
    reason:
      trouble === 'unavailable'
        ? (options.agents.find((a) => a.profileId === choice.profileId)?.reason ??
          i18next.t('roundtable.menu.gone'))
        : i18next.t(trouble === 'gone' ? 'roundtable.menu.gone' : 'roundtable.menu.modelGone')
  }
}

function listedEntries(
  options: RoundtableOptions | undefined,
  chosen: ReadonlySet<string>,
  full: boolean
): { main: MenuEntry[]; others: MenuEntry[] } {
  const main: MenuEntry[] = []
  const others: MenuEntry[] = []
  const arbiter = options?.arbiter
  for (const agent of options?.agents ?? []) {
    // Agent absent de cette machine (non installé) : pas proposé du tout, on ne propose pas ce
    // qu'on ne peut pas choisir. Déjà retenu, il reste en tête comme « orphelin », avec sa raison.
    // L'agent sans choix de modèle qui arbitre est indisponible pour le main, mais montré désactivé
    // avec sa raison : on comprend pourquoi il manque.
    const arbitrating = !agent.modelChoice && arbiter?.profileId === agent.profileId
    if (!agent.available && !arbitrating) continue
    // Modèles pas encore connus (agent jamais lancé, contre-recette N2) : une ligne « chargement »,
    // non cochable, que les modèles remplacent à leur arrivée, à la même place.
    if (agent.modelChoice && !choosesModel(agent) && agent.modelsState === 'loading') {
      main.push({
        key: `loading:${agent.profileId}`,
        choice: { profileId: agent.profileId },
        label: i18next.t('roundtable.menu.loadingModels', { agent: agent.label }),
        agentLabel: agent.label,
        modelChoice: false,
        checked: false,
        disabled: 'loading'
      })
      continue
    }
    if (!choosesModel(agent)) {
      main.push(entryOf(agent, { profileId: agent.profileId }, chosen, full, arbiter))
      continue
    }
    const shown = new Set<string>()
    for (const model of agent.recent) {
      const entry = entryOf(agent, modelChoiceOf(agent, model), chosen, full, arbiter)
      shown.add(entry.key)
      main.push(entry)
    }
    for (const model of agent.others) {
      const entry = entryOf(agent, modelChoiceOf(agent, model), chosen, full, arbiter)
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
    ? `${seatLabel(seat)} · ${seat.agentLabel}`
    : seatLabel(seat)

/**
 * Nom court d'un participant, comme dans le menu : le modèle sans son fournisseur (« Fx/Alpha »
 * → « Alpha ») ; un agent sans modèle garde son nom.
 */
export const seatLabel = (seat: Pick<RoundtableSeat, 'label' | 'agentLabel'>): string =>
  seat.label === seat.agentLabel ? seat.label : shortModelName(seat.label)

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
      : reports.findLast((r) => r.askedAt === askedAt && r.outcome === 'done')
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
  /**
   * `rebuttal` : la réplique demandée, dans la conversation du participant (ligne de l'app, sans
   * cadre ni étiquette sur la réponse).
   */
  step: 'synthesis' | 'verdict' | 'rebuttal'
  /** Le message de l'app (provenance `roundtable`). */
  request: number
  /** Réponses de l'agent jusqu'au message suivant, dans l'ordre. */
  answers: number[]
}

/**
 * Tours de l'agent ouverts par une demande du tour de table : la réponse qui suit porte l'étiquette
 * « Synthèse du tour de table » (ou « Décision… ») et ses lettres montrent les vrais noms.
 */
export function roundtableTurns(
  items: readonly TranscriptItem[],
  /** Fin rendue de chaque demande (`step.answeredAt`), par tour et par étape. */
  answeredAt: (roundtableId: string, step: 'synthesis' | 'verdict') => number | undefined = () =>
    undefined
): {
  byRequest: ReadonlyMap<number, RoundtableTurn>
  byAnswer: ReadonlyMap<number, RoundtableTurn>
} {
  const byRequest = new Map<number, RoundtableTurn>()
  const byAnswer = new Map<number, RoundtableTurn>()
  let open: RoundtableTurn | undefined
  let end: number | undefined
  for (const item of items) {
    if (item.kind === 'user') {
      open =
        item.from?.kind === 'roundtable'
          ? { roundtableId: item.from.id, step: item.from.step, request: item.id, answers: [] }
          : undefined
      if (open) byRequest.set(item.id, open)
      // La réplique n'encadre rien : la réponse du participant reste une réponse ordinaire.
      if (open?.step === 'rebuttal') open = undefined
      end = open ? answeredAt(open.roundtableId, open.step as 'synthesis' | 'verdict') : undefined
    } else if (TURN_BREAKS.has(item.kind)) {
      // Un compte rendu n'est posé qu'au repos de l'agent : le tour de la demande est fini.
      open = undefined
    } else if (item.kind === 'agent' && open) {
      // Réponse d'après la fin rendue de la demande : un autre tour, sans rapport.
      if (end !== undefined && item.at !== undefined && item.at > end) {
        open = undefined
        continue
      }
      open.answers.push(item.id)
      byAnswer.set(item.id, open)
    }
  }
  return { byRequest, byAnswer }
}

/** Éléments qui ne s'insèrent jamais dans un tour de l'agent en cours. */
const TURN_BREAKS: ReadonlySet<TranscriptItem['kind']> = new Set([
  'child-report',
  'role-request',
  'handover'
])

/** Un tour de table de ce fil est-il en cours (un second est alors refusé, B11) ? */
export function roundtableInProgress(items: readonly TranscriptItem[]): boolean {
  const last = lastRoundtable(items)
  return !!last && roundtableRunning(last)
}

/**
 * Où est la conversation d'un participant (S1, S2) : le moteur n'écrit plus rien dans l'élément,
 * l'interface lit son existence. `here` : dans la liste ; `trash` : à la corbeille (son avis reste
 * lisible, sans « Ouvrir ») ; `gone` : ni l'une ni l'autre ; `unknown` : corbeille pas encore lue.
 */
export type SeatPresence = 'here' | 'trash' | 'gone' | 'unknown'

export function seatPresence(
  seat: Pick<RoundtableSeat, 'childId'>,
  exists: ((id: string) => boolean) | undefined,
  trashed: ReadonlySet<string> | undefined
): SeatPresence {
  if (!seat.childId || !exists || exists(seat.childId)) return 'here'
  if (!trashed) return 'unknown'
  return trashed.has(seat.childId) ? 'trash' : 'gone'
}
