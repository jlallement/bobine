/**
 * Conversations filles (fiche 097, ADR-0019) : ce qui se calcule sans processus. L'état d'une
 * fille pour la liste et la carte « Sous-tâches », son compte rendu de fin de tour, et ce qui part
 * à l'agent de la mère avec le prochain message de l'utilisateur.
 */
import type { ElicitationSchema, StopReason } from './acp-sdk.mts'
import type { ConversationSummary } from './agent'
import { APP_CONTEXT_OPENINGS, type SessionMoment } from './app-context'
import type { AttentionKind, AttentionState } from './attention'
import { conversationChanges, relativeTo } from './changes'
import { roleLines, rolesParagraph, type RoleBadge, type RoleDefinition } from './roles'
import type { TranscriptItem } from './transcript'
import type { UsageDigest } from './usage'

/** Fille lancée depuis une conversation : posé dans le fil de la mère. */
export interface ChildStart {
  childId: string
  title: string
  /** Branche du worktree de la fille. */
  branch?: string
  /** Consigne donnée à la fille (son premier message). */
  prompt: string
  /** Lancée par l'agent de la mère (`start_child`, étape 2) ; absent : par l'utilisateur. */
  by?: 'agent'
  /** Rôle de la fille (fiche 223), pour son icône et sa couleur. */
  role?: RoleBadge
  at: number
}

/** « Lancer en parallèle… » (canal `conversation:startChild`) : ce que le renderer demande. */
export interface ChildStartRequest {
  text: string
  /** Titre de la fille (proposition expirée relancée, fiche 112) ; absent : le début de la consigne. */
  title?: string
  profileId?: string
  model?: { controlId: string; value: string }
  /** Rôle de la fille, par son nom (fiche 223, `@rôle`). */
  role?: string
}

/** Consigne acceptée pour une fille existante, conservée dans le fil de sa mère (fiche 150). */
export interface ChildInstruction {
  childId: string
  title: string
  prompt: string
  at: number
}

/**
 * Recommandation de fusion d'une fille par l'agent de sa mère (`recommend_merge`, fiche 160) :
 * prête à fusionner, ou ce qui manque. La fusion reste un geste de l'utilisateur.
 */
export interface ChildRecommendation {
  childId: string
  title: string
  ready: boolean
  /** Note courte de la mère (ce qu'elle a vérifié, ou ce qui manque). */
  note: string
  at: number
}

/** Note d'une recommandation gardée : au-delà, coupée. */
export const RECOMMENDATION_NOTE_CHARS = 300

/** Issue d'un tour de fille : fini, arrêté par l'utilisateur, ou en erreur. */
export type ChildOutcome = 'done' | 'stopped' | 'error'

/** Un fichier modifié par une fille, relatif à son dossier. */
export interface ChildFile {
  path: string
  added: number
  removed: number
}

/** Compte rendu d'une fille à la fin d'un de ses tours, posé dans le fil de la mère. */
export interface ChildReport {
  childId: string
  title: string
  outcome: ChildOutcome
  branch?: string
  /** Fichiers modifiés depuis le début de la fille (les premiers seulement) et les totaux. */
  files: ChildFile[]
  fileCount: number
  added: number
  removed: number
  /** Début de sa dernière réponse (son récapitulatif), ou l'erreur du tour (fiche 160). */
  excerpt: string
  at: number
  /**
   * Consommation de la fille à ce moment-là (fiche 117) : coût, jetons, échanges. Absente des
   * comptes rendus d'avant, ou si l'agent ne rapporte rien.
   */
  usage?: UsageDigest
}

/** Fichiers gardés dans un compte rendu : au-delà, seuls les totaux comptent. */
const MAX_FILES = 20
/**
 * Début de réponse gardé (fiche 160, comme les sessions de Claude Desktop) : le récapitulatif
 * qu'une fille écrit en fin de tour commence par l'essentiel.
 */
export const RECAP_CHARS = 400
/** Fichiers cités par compte rendu dans ce qui part à l'agent de la mère ; les autres comptés. */
const CONTEXT_FILES = 8
/** Titre d'une fille cité à l'agent : au-delà, coupé. */
const TITLE_CHARS = 80
/**
 * Plafond d'un compte rendu dans ce qui part à l'agent de la mère (fiche 160) : la mère suit
 * plusieurs filles sur plusieurs tours sans que leurs comptes rendus remplissent son contexte.
 */
export const REPORT_CHARS = 1200

/** Texte coupé à `max` caractères, sur un blanc si possible, avec « … ». */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.search(/\s\S*$/)
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Longueur au plus de la première phrase d'un compte rendu replié (fiche 171). */
export const LEAD_CHARS = 160

/**
 * Première phrase d'un compte rendu, en texte brut, pour sa ligne repliée (fiche 171) : première
 * ligne de texte (blocs de code sautés), marques Markdown retirées, coupée à la fin de la première
 * phrase et à `LEAD_CHARS`. Vide si l'extrait n'a pas de texte.
 */
export function recapLead(excerpt: string): string {
  let fenced = false
  for (const raw of excerpt.split('\n')) {
    const line = raw.trim()
    if (/^(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced || !line || /^\|?[\s:|-]+\|?$/.test(line)) continue
    const text = line
      .replace(/^(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)+/, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
      .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/^\||\|$/g, '')
      .replace(/\s*\|\s*/g, ' · ')
      .trim()
    if (!text) continue
    const sentence = /^(.+?[.!?…])(?=\s|$)/.exec(text)?.[1] ?? text
    return clip(sentence, LEAD_CHARS)
  }
  return ''
}

/** Début d'une réponse, pour un compte rendu : lignes vides retirées, `RECAP_CHARS` au plus. */
export function replyRecap(text: string): string {
  const lines = text
    .trim()
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
  return clip(lines.join('\n'), RECAP_CHARS)
}

/** Travail d'une fille : fichiers modifiés depuis son début (comme le compteur de l'en-tête). */
export type ChildWork = Pick<ChildReport, 'files' | 'fileCount' | 'added' | 'removed'>

export function childWork(
  child: Pick<ConversationSummary, 'workspace'>,
  items: readonly TranscriptItem[]
): ChildWork {
  const files = conversationChanges(items).map((f) => ({
    path: relativeTo(child.workspace, f.path),
    added: f.added,
    removed: f.removed
  }))
  return {
    files: files.slice(0, MAX_FILES),
    fileCount: files.length,
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0)
  }
}

/**
 * Compte rendu d'une fille à la fin d'un tour (`turn-end`, ou `turn-error` avec son message) :
 * fichiers modifiés depuis son début (`childWork`), début de sa réponse (fiche 160).
 */
export function childReport(
  child: Pick<ConversationSummary, 'id' | 'title' | 'branch' | 'workspace'>,
  items: readonly TranscriptItem[],
  end: { stopReason: StopReason } | { error: string },
  at = Date.now()
): ChildReport {
  const outcome: ChildOutcome =
    'error' in end ? 'error' : end.stopReason === 'cancelled' ? 'stopped' : 'done'
  return {
    childId: child.id,
    title: child.title,
    outcome,
    ...(child.branch ? { branch: child.branch } : {}),
    ...childWork(child, items),
    excerpt: 'error' in end ? replyRecap(end.error) : replyRecap(lastReply(items)),
    at
  }
}

/** Texte de la dernière réponse du dernier tour (vide si l'agent n'a rien écrit). */
export function lastReply(items: readonly TranscriptItem[]): string {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item?.kind === 'user') return ''
    if (item?.kind === 'agent' && item.text.trim()) return item.text
  }
  return ''
}

export type ChildNews = Extract<TranscriptItem, { kind: 'child-started' | 'child-report' }>

/**
 * Nouvelles des filles pas encore transmises à l'agent de la mère : celles posées après le dernier
 * message de l'utilisateur. Le message parti, elles sont derrière lui : rien d'autre à retenir.
 */
export function childNews(items: readonly TranscriptItem[]): ChildNews[] {
  const news: ChildNews[] = []
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item || item.kind === 'user') break
    if (item.kind === 'child-started' || item.kind === 'child-report') news.unshift(item)
  }
  return news
}

const OUTCOME_TEXT: Record<ChildOutcome, string> = {
  done: 'finished its turn',
  stopped: 'was stopped by the user',
  error: 'ended its turn with an error'
}

const quoted = (text: string) =>
  text
    .split('\n')
    .map((line) => `  > ${line}`)
    .join('\n')

/**
 * Contexte joint au prochain message de l'utilisateur dans la mère (fiche 097) : lancements et
 * comptes rendus de ses filles, en anglais comme tout ce qui va à l'agent (ADR-0014). `undefined`
 * s'il n'y a rien de neuf.
 */
export function childContext(news: readonly ChildNews[]): string | undefined {
  if (news.length === 0) return undefined
  const lines = news.map((item) => {
    const branch = item.branch ? ` on branch ${item.branch}` : ''
    if (item.kind === 'child-started') {
      const who = item.by === 'agent' ? 'You started (start_child)' : 'I started'
      return `- ${who} the child conversation "${item.title}"${branch}, with this instruction:\n${quoted(item.prompt)}`
    }
    return reportLine(item)
  })
  const reports = news.some((item) => item.kind === 'child-report')
  return [
    APP_CONTEXT_OPENINGS.childNews,
    'For context, news from child conversations started from this conversation since my last',
    'message. Each one works in its own git worktree, on its own branch, which is not merged.',
    ...(reports ? REPORT_IS_NOT_PROOF : []),
    '',
    ...lines,
    '</child_conversations>'
  ].join('\n')
}

/**
 * Le compte rendu n'est pas une preuve (fiche 160) : la mère vérifie elle-même avant de
 * recommander une fusion, et c'est l'utilisateur qui fusionne.
 */
const REPORT_IS_NOT_PROOF = [
  'A report is a short note, not proof (it never holds the diff): before recommending a merge,',
  'check the work yourself (git log / git diff on the branch, the risky files, the project',
  'checks) or have one of your sub-agents review it, send fixes with message_child, then use',
  'recommend_merge. Never merge a branch yourself: the user merges.'
]

/**
 * Un compte rendu tel qu'il part à l'agent de la mère (fiche 160) : état, branche, fichiers avec
 * +/− (les premiers), début du récapitulatif ; jamais de diff, `REPORT_CHARS` au plus.
 */
export function reportLine(item: ChildReport): string {
  const branch = item.branch ? ` on branch ${clip(item.branch, TITLE_CHARS)}` : ''
  const cited = item.files.slice(0, CONTEXT_FILES)
  const files =
    item.fileCount === 0
      ? 'No files changed so far.'
      : `${item.fileCount} file(s) changed so far (+${item.added} −${item.removed}): ${cited
          .map((f) => `${clip(f.path, TITLE_CHARS)} (+${f.added} −${f.removed})`)
          .join(
            ', '
          )}${item.fileCount > cited.length ? `, and ${item.fileCount - cited.length} more` : ''}.`
  const recap = clip(item.excerpt, RECAP_CHARS)
  const excerpt = recap
    ? `\n  ${item.outcome === 'error' ? 'Error' : 'Start of its last reply'}:\n${quoted(recap)}`
    : ''
  const line = `- The child conversation "${clip(item.title, TITLE_CHARS)}" (id: ${item.childId})${branch} ${OUTCOME_TEXT[item.outcome]}. ${files}${excerpt}`
  return clip(line, REPORT_CHARS)
}

/** État d'une fille, pour la liste et la carte « Sous-tâches ». */
export type ChildState = 'running' | 'waiting' | 'unread' | 'error' | 'done'

/** Préparation d'une fille acceptée, avant la publication de sa vraie conversation (fiche 149). */
export interface ChildLaunch {
  id: string
  motherId: string
  title: string
  /** Rattachement à la vraie ligne, avant son arrivée dans la liste des conversations. */
  conversationId?: string
}

/** État transitoire révisé : une lecture initiale tardive ne doit pas écraser un évènement. */
export interface ChildLaunchState {
  revision: number
  entries: ChildLaunch[]
}

export function childState(
  child: Pick<ConversationSummary, 'status'>,
  attention?: AttentionKind
): ChildState {
  if (attention === 'request' || child.status === 'needs-action') return 'waiting'
  if (child.status === 'busy' || child.status === 'starting') return 'running'
  if (attention === 'error' || child.status === 'error' || child.status === 'exited') return 'error'
  return attention === 'done' ? 'unread' : 'done'
}

/**
 * Filles en cours d'une mère (ADR-0020) : leur agent travaille, ou attend un accord ou une
 * réponse. Ce compte borne « Lancer en parallèle… » et `start_child`.
 */
export function activeChildren(
  motherId: string,
  conversations: readonly Pick<ConversationSummary, 'id' | 'status' | 'startedFrom'>[],
  attention: AttentionState
): number {
  return conversations.filter((c) => {
    if (c.startedFrom?.id !== motherId) return false
    const state = childState(c, attention[c.id])
    return state === 'running' || state === 'waiting'
  }).length
}

/** Ce que « Lancer en parallèle… » doit savoir d'une conversation (fiche 097). */
export interface ChildCapacity {
  /** Dossier dans un dépôt git : une fille y aura son worktree. */
  inRepo: boolean
  /** Filles en cours (`activeChildren`). */
  active: number
  /** Plafond réglé (Réglages › Conversation). */
  max: number
}

/**
 * Provenance d'un message qui ne vient pas de l'utilisateur (fiche 097, étape 2) : de la mère
 * (`message_child`), d'une fille (`message_parent`), ou le réveil groupé de la mère.
 */
export type MessageOrigin =
  | { kind: 'parent'; id: string; title: string }
  | { kind: 'child'; id: string; title: string }
  | { kind: 'wake' }

/** Les provenances sont-elles les mêmes (messages de la file envoyés ensemble) ? */
export function sameOrigin(a?: MessageOrigin, b?: MessageOrigin): boolean {
  if (!a || !b) return !a && !b
  return a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '')
}

/**
 * Message de réveil de la mère, quand toutes les filles lancées par son agent ont fini leur tour.
 * Leurs comptes rendus partent avec lui (`childContext`). En anglais, comme tout ce qui va à
 * l'agent (ADR-0014) ; l'interface affiche sa propre ligne.
 */
export const WAKE_TEXT =
  'All the child conversations you started or messaged have finished their turn: their reports ' +
  'are above. A report is not proof: check the work on each branch yourself (or with a ' +
  'sub-agent), send fixes with message_child, then give your verdict with recommend_merge. ' +
  'Never merge yourself: tell the user which branches you recommend, the user merges them.'

/**
 * Contexte joint après un message venu d'une autre conversation (fiche 125) : l'agent sait qu'il ne vient pas
 * de l'utilisateur, et par quel outil répondre. `undefined` pour le réveil (son texte suffit).
 */
export function originContext(from: MessageOrigin): string | undefined {
  switch (from.kind) {
    case 'parent':
      return (
        `${APP_CONTEXT_OPENINGS.origin} parent conversation "${from.title}" (the conversation ` +
        'that started you), not from the user. To answer it, use the message_parent tool: your ' +
        'reply here only reaches it at the end of your turn, in your report.'
      )
    case 'child':
      return (
        `${APP_CONTEXT_OPENINGS.origin} child conversation "${from.title}" (id: ${from.id}), ` +
        'sent with message_parent, not from the user. To answer it, use the message_child tool.'
      )
    case 'wake':
      return undefined
  }
}

/**
 * Proposition de conversation fille par l'agent (`start_child`, fiche 112) : portée par une
 * élicitation, affichée sur la carte « Tâches proposées » avec les autres propositions du tour.
 */
export interface ChildProposal {
  title: string
  prompt: string
  /** Agent proposé par la mère (fiche 160), validé par le main ; absent : celui de la mère. */
  profileId?: string
  /** Modèle proposé (réglage `model` de l'agent de la mère), validé par le main. */
  model?: { controlId: string; value: string }
  /** Pourquoi cet agent ou ce modèle, en quelques mots, montré sur la carte. */
  why?: string
  /** Rôle demandé (fiche 223), montré sur la carte. */
  role?: RoleBadge
}

/** Ce que l'utilisateur décide d'une proposition : la fille, le travail ici, ou rien. */
export type ChildDecisionAction = 'start' | 'here' | 'refuse'
export const CHILD_DECISIONS: readonly ChildDecisionAction[] = ['start', 'here', 'refuse']

export interface ChildDecision {
  action: ChildDecisionAction
  /** Agent de la fille s'il diffère de celui de la mère (« Lancer » seulement). */
  profileId?: string
  /** Modèle choisi pour la fille (réglage de catégorie `model`). */
  model?: { controlId: string; value: string }
}

/**
 * Schéma de l'élicitation d'une proposition : des chaînes seulement, pour que la validation du
 * main (`validateElicitationContent`) et un client générique s'y retrouvent.
 */
export function childProposalSchema(): ElicitationSchema {
  return {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: [...CHILD_DECISIONS] },
      profileId: { type: 'string' },
      modelControl: { type: 'string' },
      modelValue: { type: 'string' }
    },
    required: ['decision']
  } as unknown as ElicitationSchema
}

/** Contenu de la réponse à l'élicitation pour une décision. */
export function childDecisionContent(decision: ChildDecision): Record<string, string> {
  return {
    decision: decision.action,
    ...(decision.profileId ? { profileId: decision.profileId } : {}),
    ...(decision.model
      ? { modelControl: decision.model.controlId, modelValue: decision.model.value }
      : {})
  }
}

/** Élicitation qui porte une proposition de fille : une ligne de la carte « Tâches proposées ». */
export type ChildProposalItem = Extract<TranscriptItem, { kind: 'elicitation' }> & {
  prompt: { mode: 'form'; child: ChildProposal }
}

export function isChildProposal(item: TranscriptItem): item is ChildProposalItem {
  return item.kind === 'elicitation' && item.prompt.mode === 'form' && !!item.prompt.child
}

/** Les propositions du fil, groupées par tour (entre deux messages de l'utilisateur). */
export interface ChildProposalGroups {
  /** Les propositions d'un tour, par identifiant de la première (où la carte s'affiche). */
  groups: Map<number, ChildProposalItem[]>
  /** Les autres propositions des groupes : pas affichées à leur place. */
  hidden: Set<number>
  /** Appels `start_child` reliés à une proposition : cachés derrière la carte. */
  toolCallIds: Set<string>
}

export function childProposalGroups(items: readonly TranscriptItem[]): ChildProposalGroups {
  const groups = new Map<number, ChildProposalItem[]>()
  const hidden = new Set<number>()
  const toolCallIds = new Set<string>()
  let current: ChildProposalItem[] | undefined
  for (const item of items) {
    if (item.kind === 'user') {
      current = undefined
      continue
    }
    if (!isChildProposal(item)) continue
    if (item.prompt.toolCallId) toolCallIds.add(item.prompt.toolCallId)
    if (current) {
      current.push(item)
      hidden.add(item.id)
    } else {
      current = [item]
      groups.set(item.id, current)
    }
  }
  return { groups, hidden, toolCallIds }
}

/** Décision lue dans la réponse (passée ou illisible : `undefined`, qui vaut refus). */
export function parseChildDecision(content: unknown): ChildDecision | undefined {
  if (typeof content !== 'object' || content === null) return undefined
  const { decision, profileId, modelControl, modelValue } = content as Record<string, unknown>
  if (!CHILD_DECISIONS.includes(decision as ChildDecisionAction)) return undefined
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)
  const control = text(modelControl)
  const value = text(modelValue)
  const profile = text(profileId)
  return {
    action: decision as ChildDecisionAction,
    ...(profile ? { profileId: profile } : {}),
    ...(control && value ? { model: { controlId: control, value } } : {})
  }
}

/**
 * Réglage « Proposer des conversations filles » (fiche 118) : jamais (pas de contexte de
 * session), quand ça s'y prête (défaut), ou toujours avant un travail en plusieurs parties.
 */
export type ChildProposals = 'never' | 'whenFitting' | 'always'
export const CHILD_PROPOSALS: readonly ChildProposals[] = ['never', 'whenFitting', 'always']

/**
 * Contexte de session d'une mère possible (fiche 118), joint au premier message d'une session
 * neuve de son agent : ce que l'app lui offre et quand s'en servir. Sans lui, l'agent ne connaît
 * `start_child` que par sa description, et ses propres sous-agents, mis en avant par son system
 * prompt, gagnent toujours. Écrit en positif (fiche 223) : quand déléguer d'abord, les exclusions
 * ensuite. Générique (rien de propre à un agent), en anglais (ADR-0014). `undefined` si le
 * réglage dit « Jamais ».
 */
export function capabilitiesContext(
  proposals: ChildProposals,
  roles: readonly RoleDefinition[] = []
): string | undefined {
  if (proposals === 'never') return undefined
  const when =
    proposals === 'always'
      ? [
          'The user wants you to always propose child conversations before work that has several',
          'parts (one start_child call per part, even small ones) and for any review or audit.',
          'Do the work yourself only for a single piece of work, a question, or reading code.'
        ]
      : [
          'Propose child conversations (one start_child call per piece of work) when:',
          '- the user asks for several independent tasks: one child each, working in parallel;',
          '- a task is long and the user will want to follow it separately;',
          '- the work calls for a review or an audit by a fresh pair of eyes (security,',
          '  performance, a second opinion on a module).',
          'Do the rest yourself: questions, reading or searching code, small fixes, and tasks that',
          'depend on one another or change the same files.'
        ]
  return [
    APP_CONTEXT_OPENINGS.capabilities,
    'For context, about the app the user talks to you through (Bobine). This is not a task.',
    '',
    'Your start_child tool (from the bobine tool server) opens a child conversation: another agent',
    'that works in parallel, in its own git worktree and branch, on an instruction you write. The',
    'user sees it under this conversation and can open it, talk to it and stop it. Proposing one',
    'costs nothing: nothing starts until the user decides, on a card (Start, Do it here, Refuse).',
    '',
    ...when,
    'For a separate piece of work, start_child is the tool, not your own sub-agents.',
    '',
    'You are the tech lead of your child conversations. You may suggest their agent, and the model',
    'when your profile allows it (start_child `agent`, `model`, `why`): the user confirms. After',
    'proposing, end your turn with a short summary: you are told what the user decided, and woken',
    'up when the children have finished, with a short report each (never the diff: not proof).',
    'Check their work yourself (git on the branch, the risky files, the project checks) or with a',
    'sub-agent, send fixes with message_child, then give your verdict with recommend_merge.',
    'Never merge a branch yourself: the user merges.',
    ...(roles.length ? ['', ...rolesParagraph(roles)] : []),
    '</bobine_capabilities>'
  ].join('\n')
}

/**
 * Rappel court du contexte de session (fiche 223), à la place du contexte complet quand
 * l'historique de l'agent l'a déjà reçu (session rouverte) ou l'a résumé (après une compaction) :
 * quelques lignes, pas à chaque message (coût en contexte). Même balise que le contexte complet.
 * `undefined` si le réglage dit « Jamais ».
 */
export function capabilitiesReminder(
  proposals: ChildProposals,
  roles: readonly RoleDefinition[] = []
): string | undefined {
  if (proposals === 'never') return undefined
  const when =
    proposals === 'always'
      ? [
          'The user wants one per part before any work with several parts, and for any review or audit.',
          'Do a single piece of work, a question or reading code yourself.'
        ]
      : [
          'Propose one per piece of work for several independent tasks, long work the user will',
          'want to follow, or a review or audit by a fresh pair of eyes. Do questions, small fixes',
          'and tasks on the same files yourself.'
        ]
  return [
    APP_CONTEXT_OPENINGS.capabilities,
    'Reminder, not a task: start_child proposes a child conversation, an agent working in',
    'parallel in its own git worktree; nothing starts until the user approves it on a card.',
    ...when,
    ...(roles.length
      ? [
          'Roles (start_child `role`): hand the work to the matching specialist.',
          ...roleLines(roles)
        ]
      : []),
    '</bobine_capabilities>'
  ].join('\n')
}

/**
 * Ce que reçoit une mère possible selon le moment (fiche 223) : le contexte complet à une session
 * neuve, le rappel à une session rouverte ou après une compaction.
 */
export function childrenSessionContext(
  proposals: ChildProposals,
  moment: SessionMoment,
  roles: readonly RoleDefinition[] = []
): string | undefined {
  return moment === 'opened'
    ? capabilitiesContext(proposals, roles)
    : capabilitiesReminder(proposals, roles)
}

/**
 * Demande de `/split` (fiche 118), jointe juste après le message de l'utilisateur (fiche 125) :
 * découper sa demande en conversations filles. En anglais, comme tout ce qui va à l'agent
 * (ADR-0014).
 */
export const CHILDREN_REQUEST = [
  APP_CONTEXT_OPENINGS.childrenRequest,
  'The user asks you to split the message above into child conversations: call start_child once',
  'per independent piece of work, each one working in its own git worktree, with a complete,',
  'self-contained instruction (a child does not see this conversation). Do not do the work',
  'yourself, and do not hand it to your own sub-agents. If the message is a single piece of',
  'work, propose a single child conversation. Then end your turn with a short summary of what',
  'you proposed.',
  '</child_conversations_request>'
].join('\n')

/** Recommandation en vigueur pour une fille ; `stale` : la fille a refait un tour depuis. */
export type ChildVerdict = ChildRecommendation & { stale: boolean }

/**
 * Dernière recommandation de la mère pour chaque fille (fiche 160). Un compte rendu posé après
 * elle la rend caduque : la fille a retravaillé, la mère doit revoir.
 */
export function childRecommendations(items: readonly TranscriptItem[]): Map<string, ChildVerdict> {
  const verdicts = new Map<string, ChildVerdict>()
  for (const item of items) {
    if (item.kind === 'child-recommendation') {
      const { id: _id, kind: _kind, ...recommendation } = item
      verdicts.set(item.childId, { ...recommendation, stale: false })
    } else if (item.kind === 'child-report') {
      const verdict = verdicts.get(item.childId)
      if (verdict) verdict.stale = true
    }
  }
  return verdicts
}

/** Filles à fusionner d'abord (fiche 160) : recommandées, recommandation à jour. */
export function recommendedIds(verdicts: ReadonlyMap<string, ChildVerdict>): Set<string> {
  return new Set([...verdicts.values()].filter((v) => v.ready && !v.stale).map((v) => v.childId))
}
