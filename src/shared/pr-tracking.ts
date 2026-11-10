/**
 * Suivi de la PR et de la CI d'une conversation en worktree (fiche 176) : ce que le renderer
 * montre, lu du JSON de `gh pr view`, et la consigne envoyée à l'agent pour corriger les contrôles
 * en échec (anglais, ADR-0014). Fonctions pures, testées sans `gh`.
 */
import { stripAnsi } from './worktree-setup'

export type CheckState = 'pending' | 'passed' | 'failed' | 'skipped'

/** Un contrôle de la CI (`CheckRun` d'une action, ou `StatusContext` d'un service externe). */
export interface PrCheck {
  name: string
  state: CheckState
  url?: string
  /** Job d'une action GitHub (`…/actions/runs/<run>/job/<job>`) : de quoi lire son journal. */
  jobId?: string
}

export type ChecksSummary = 'none' | 'pending' | 'passed' | 'failed'

export interface PrView {
  number: number
  url: string
  title: string
  state: 'open' | 'merged' | 'closed'
  draft: boolean
  /** Commit en tête de la PR : une correction d'office part une fois par commit. */
  head: string
  /** Ceux en échec d'abord, puis en cours, puis réussis. */
  checks: PrCheck[]
  summary: ChecksSummary
  /** Commentaires du fil de la PR et relectures avec un texte ou un avis. */
  comments: number
  review?: 'approved' | 'changes-requested' | 'review-required'
  mergeable: 'mergeable' | 'conflicting' | 'unknown'
  /** Branche de base de la PR (`baseRefName`) : où lire les contrôles requis. */
  base: string
  /**
   * Ce que GitHub dit de la fusion (`mergeStateStatus`) : `blocked` (règles de la branche :
   * contrôle ou relecture requis), `behind` (base à reprendre), `dirty` (conflit), `unstable`
   * (contrôles non requis en échec), `clean`, `unknown` (en calcul).
   */
  mergeState: MergeState
}

export type MergeState = 'clean' | 'blocked' | 'behind' | 'dirty' | 'unstable' | 'unknown'

/** Choix de l'utilisateur sur la carte, décochés par défaut, gardés en mémoire par le main. */
export interface PrOptions {
  autoFix: boolean
  autoMerge: boolean
}

/** Ce que l'app a fait d'elle-même, ou sur un clic, dit sur la carte. */
export type PrEvent =
  | { kind: 'fix-sent'; auto: boolean; count: number }
  /** La consigne n'a pas pu partir (agent arrêté, refus…). */
  | { kind: 'fix-failed'; message: string }
  /** `noCi` : « Fusionner maintenant » sans CI détectée (rien n'était vert, 0.9.1, D23). */
  | { kind: 'merged'; method: MergeMethod; noCi?: true }
  | { kind: 'merge-failed'; message: string }

/** Méthode de fusion de GitHub, choisie parmi celles que le dépôt permet. */
export type MergeMethod = 'merge' | 'squash' | 'rebase'

/**
 * Méthode permise par le dépôt (`gh repo view --json mergeCommitAllowed,squashMergeAllowed,
 * rebaseMergeAllowed`) : commit de fusion d'abord (ADR-0022), puis squash, puis rebase ;
 * `undefined` si le JSON est illisible ou si rien n'est permis.
 */
export function pickMergeMethod(json: string): MergeMethod | undefined {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(json) as Record<string, unknown>
  } catch {
    return undefined
  }
  if (raw['mergeCommitAllowed'] === true) return 'merge'
  if (raw['squashMergeAllowed'] === true) return 'squash'
  if (raw['rebaseMergeAllowed'] === true) return 'rebase'
  return undefined
}

/**
 * Sans aucun contrôle sur la PR (0.9.1, D16/D20) : `none`, aucune CI détectée (ni workflow dans
 * la branche, ni contrôle requis par les règles de la base, rien de bloqué par GitHub) ;
 * `awaited`, une CI est attendue et GitHub n'a encore rien signalé pour ce commit ; `silent`,
 * toujours rien {@link CHECKS_GRACE_MS} après. Dans le doute, une CI est supposée.
 */
export type CiState = 'none' | 'awaited' | 'silent'

/** Pourquoi « Fusionner quand tout est vert » n'a pas (encore) fusionné, du plus bloquant au moins. */
export type MergeWait =
  | 'draft'
  | 'conflicting'
  | 'changes-requested'
  | 'review-required'
  | 'failed'
  | 'pending'
  | 'behind'
  | 'blocked'
  | 'awaited'
  | 'silent'
  | 'no-ci'
  | 'mergeability'

export type PrTrack =
  /** `gh` absent, non connecté, ou pas de dépôt distant : pas de carte (la fiche 110 le dit). */
  | { status: 'unavailable' }
  /** Pas (encore) de PR pour la branche. */
  | { status: 'none'; checkedAt: number }
  | { status: 'error'; message: string; checkedAt: number; options: PrOptions }
  | {
      status: 'found'
      pr: PrView
      checkedAt: number
      options: PrOptions
      event?: PrEvent
      /** Méthode de fusion permise par le dépôt, lue quand « Fusionner quand tout est vert » est coché. */
      mergeMethod?: MergeMethod
      /** Aucun contrôle sur la PR : pourquoi (pas de CI, pas encore signalés, toujours rien). */
      ci?: CiState
      /** Règles de la base illisibles (`gh api` raté) : une CI est supposée, et c'est dit. */
      rulesUnreadable?: true
      /** GitHub dit `UNKNOWN` depuis 10 min : pas de fusion d'office, et la carte dit pourquoi. */
      mergeabilityUnreported?: true
    }

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const upper = (value: unknown): string => asString(value).toUpperCase()

/** Un élément de `statusCheckRollup` ramené à un `PrCheck`. */
export function parseCheck(raw: unknown): PrCheck | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const item = raw as Record<string, unknown>
  const name = asString(item['name']) || asString(item['context'])
  if (!name) return undefined
  let state: CheckState
  if (item['__typename'] === 'StatusContext' || 'context' in item) {
    const s = upper(item['state'])
    state = s === 'SUCCESS' ? 'passed' : s === 'FAILURE' || s === 'ERROR' ? 'failed' : 'pending'
  } else if (upper(item['status']) !== 'COMPLETED') {
    state = 'pending'
  } else {
    const c = upper(item['conclusion'])
    state =
      c === 'SUCCESS'
        ? 'passed'
        : c === 'SKIPPED' || c === 'NEUTRAL' || c === 'STALE'
          ? 'skipped'
          : 'failed'
  }
  const url = asString(item['detailsUrl']) || asString(item['targetUrl'])
  const jobId = /\/actions\/runs\/\d+\/job\/(\d+)/.exec(url)?.[1]
  const workflow = asString(item['workflowName'])
  return {
    name: workflow && workflow !== name ? `${workflow} / ${name}` : name,
    state,
    ...(url ? { url } : {}),
    ...(jobId ? { jobId } : {})
  }
}

const ORDER: Record<CheckState, number> = { failed: 0, pending: 1, passed: 2, skipped: 3 }

export function checksSummary(checks: readonly PrCheck[]): ChecksSummary {
  if (checks.length === 0) return 'none'
  if (checks.some((c) => c.state === 'failed')) return 'failed'
  if (checks.some((c) => c.state === 'pending')) return 'pending'
  return 'passed'
}

/** JSON de `gh pr view --json …` ; lève s'il n'a pas la forme attendue. */
export function parsePrView(json: string): PrView {
  const raw = JSON.parse(json) as Record<string, unknown>
  const number = raw['number']
  const url = asString(raw['url'])
  if (typeof number !== 'number' || !url) throw new Error('unexpected gh pr view output')
  const rollup = Array.isArray(raw['statusCheckRollup']) ? raw['statusCheckRollup'] : []
  // Un contrôle relancé apparaît une fois par essai : le dernier compte (même nom).
  const byName = new Map<string, PrCheck>()
  for (const item of rollup) {
    const check = parseCheck(item)
    if (check) byName.set(check.name, check)
  }
  const checks = [...byName.values()].sort(
    (a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name)
  )
  const state = upper(raw['state'])
  const reviews = Array.isArray(raw['reviews']) ? raw['reviews'] : []
  const comments =
    (Array.isArray(raw['comments']) ? raw['comments'].length : 0) +
    reviews.filter((r) => {
      const review = (r ?? {}) as Record<string, unknown>
      return asString(review['body']).trim() !== '' || upper(review['state']) !== 'COMMENTED'
    }).length
  const decision = upper(raw['reviewDecision'])
  const mergeable = upper(raw['mergeable'])
  const mergeState = upper(raw['mergeStateStatus'])
  return {
    number,
    url,
    title: asString(raw['title']),
    state: state === 'MERGED' ? 'merged' : state === 'CLOSED' ? 'closed' : 'open',
    draft: raw['isDraft'] === true,
    head: asString(raw['headRefOid']),
    checks,
    summary: checksSummary(checks),
    comments,
    ...(decision === 'APPROVED'
      ? { review: 'approved' as const }
      : decision === 'CHANGES_REQUESTED'
        ? { review: 'changes-requested' as const }
        : decision === 'REVIEW_REQUIRED'
          ? { review: 'review-required' as const }
          : {}),
    mergeable:
      mergeable === 'MERGEABLE'
        ? 'mergeable'
        : mergeable === 'CONFLICTING'
          ? 'conflicting'
          : 'unknown',
    base: asString(raw['baseRefName']),
    mergeState: MERGE_STATES[mergeState] ?? 'unknown'
  }
}

/** `HAS_HOOKS` (crochets de pré-réception) vaut `clean` pour l'app. */
const MERGE_STATES: Record<string, MergeState> = {
  CLEAN: 'clean',
  HAS_HOOKS: 'clean',
  BLOCKED: 'blocked',
  BEHIND: 'behind',
  DIRTY: 'dirty',
  UNSTABLE: 'unstable'
}

/** Champs demandés à `gh pr view` : une seule requête à GitHub par relève. */
export const PR_VIEW_FIELDS = [
  'number',
  'url',
  'title',
  'state',
  'isDraft',
  'headRefOid',
  'mergeable',
  'reviewDecision',
  'mergeStateStatus',
  'baseRefName',
  'statusCheckRollup',
  'comments',
  'reviews'
].join(',')

/** « Fusionner quand tout est vert » : rien ne bloque la fusion. */
export function readyToMerge(pr: PrView): boolean {
  return (
    pr.state === 'open' &&
    !pr.draft &&
    pr.mergeable === 'mergeable' &&
    pr.summary === 'passed' &&
    pr.review !== 'changes-requested' &&
    pr.review !== 'review-required' &&
    MERGEABLE_STATES.includes(pr.mergeState)
  )
}

/**
 * États de fusion où GitHub accepte `gh pr merge` : `unstable` (un contrôle non requis en échec ;
 * `summary` doit de toute façon être `passed`) et `clean`. Ailleurs (`blocked`, `behind`,
 * `dirty`, ou `unknown` tant que GitHub calcule), l'app n'essaie pas et la carte dit pourquoi.
 */
const MERGEABLE_STATES: readonly MergeState[] = ['clean', 'unstable']

/**
 * Ce qui retient la fusion d'office d'une PR ouverte, la raison la plus bloquante d'abord ;
 * `undefined` si rien (`readyToMerge`) ou si la PR n'est plus ouverte.
 */
export function mergeWait(pr: PrView, ci?: CiState): MergeWait | undefined {
  if (pr.state !== 'open' || readyToMerge(pr)) return undefined
  if (pr.draft) return 'draft'
  if (pr.mergeable === 'conflicting' || pr.mergeState === 'dirty') return 'conflicting'
  if (pr.review === 'changes-requested') return 'changes-requested'
  if (pr.review === 'review-required') return 'review-required'
  if (pr.summary === 'failed') return 'failed'
  if (pr.summary === 'pending') return 'pending'
  if (pr.summary === 'none' && ci !== 'none') return ci === 'silent' ? 'silent' : 'awaited'
  if (pr.mergeState === 'behind') return 'behind'
  if (pr.mergeState === 'blocked') return 'blocked'
  if (pr.summary === 'none') return 'no-ci'
  return 'mergeability'
}

/**
 * « Fusionner maintenant » (0.9.1, D20) : seulement sans CI détectée, et si GitHub n'y met aucun
 * autre obstacle (brouillon, conflit, règles de la branche, base à reprendre). Avec une CI, la
 * fusion attend toujours le vert (`readyToMerge`). Un clic ne contourne jamais les règles : rendu
 * `undefined` si la fusion est possible, sinon la raison.
 */
export function mergeNowBlocker(pr: PrView, ci?: CiState): MergeWait | undefined {
  if (pr.state !== 'open') return 'mergeability'
  if (ci !== 'none' || pr.checks.length > 0) return mergeWait(pr, ci) ?? 'awaited'
  const wait = mergeWait(pr, ci)
  if (wait && wait !== 'no-ci') return wait
  if (pr.mergeable !== 'mergeable' || !MERGEABLE_STATES.includes(pr.mergeState)) {
    return 'mergeability'
  }
  return undefined
}

export const canMergeNow = (pr: PrView, ci?: CiState): boolean => !mergeNowBlocker(pr, ci)

/**
 * Contrôles requis par la protection classique de la base (`gh api repos/{owner}/{repo}/
 * branches/<base>`) ; `undefined` si la réponse est illisible.
 */
export function branchRequiredChecks(json: string): string[] | undefined {
  try {
    const raw = JSON.parse(json) as { protection?: { required_status_checks?: unknown } }
    const rsc = raw.protection?.required_status_checks as
      { contexts?: unknown; checks?: unknown } | undefined
    if (raw.protection === undefined) return []
    const contexts = Array.isArray(rsc?.contexts) ? rsc.contexts.map(asString) : []
    const checks = Array.isArray(rsc?.checks)
      ? rsc.checks.map((c) => asString((c as { context?: unknown } | null)?.context))
      : []
    return [...new Set([...contexts, ...checks].filter(Boolean))]
  } catch {
    return undefined
  }
}

/**
 * Contrôles requis par les rulesets de la base (`gh api repos/{owner}/{repo}/rules/branches/
 * <base>`) ; `undefined` si la réponse est illisible.
 */
export function rulesRequiredChecks(json: string): string[] | undefined {
  try {
    const rules = JSON.parse(json) as unknown
    if (!Array.isArray(rules)) return undefined
    const names: string[] = []
    for (const rule of rules as { type?: unknown; parameters?: unknown }[]) {
      if (rule?.type !== 'required_status_checks') continue
      const params = rule.parameters as { required_status_checks?: unknown } | undefined
      const list = Array.isArray(params?.required_status_checks)
        ? params.required_status_checks
        : []
      // Une règle sans contexte lisible compte quand même : un contrôle est requis.
      names.push(
        ...(list.length ? list.map((c) => asString((c as { context?: unknown })?.context)) : ['?'])
      )
    }
    return [...new Set(names.filter(Boolean))]
  } catch {
    return undefined
  }
}

/** Rulesets indisponibles (dépôt privé d'un compte gratuit) : il n'y en a donc aucun. */
export const RULES_UNAVAILABLE = /Upgrade to GitHub Pro/i

/**
 * Aucune CI détectée ? Seulement si rien ne dit le contraire : pas de workflow dans la branche
 * (indice local), contrôles requis lus et vides, et GitHub ne bloque pas la PR pour une raison
 * que la relecture n'explique pas. Dans le doute (lecture ratée), une CI est supposée.
 */
export function noCiDetected(
  pr: PrView,
  hints: { workflows: boolean; required: readonly string[] | undefined }
): boolean {
  if (hints.workflows || hints.required === undefined || hints.required.length > 0) return false
  const reviewBlocks = pr.review === 'review-required' || pr.review === 'changes-requested'
  return !(pr.mergeState === 'blocked' && !reviewBlocks && !pr.draft)
}

const EXCERPT_LINES = 60
const EXCERPT_CHARS = 4000

/** Ligne qui dit un échec : `##[error]` des actions, `FAIL`, `Error:`, `panic:`, assertion… */
const FAILURE_LINE =
  /##\[error\]|\bFAIL(ED)?\b|\b(Error|ERROR|error)\b:?|AssertionError|panic:|Traceback|✗|✖/

/**
 * Séquence de couleur écrite en notation caret : `^[` puis `[36;1m`, `[0m`… Chiffres et `;`
 * seulement, puis une lettre : `^[[:space:]]` (une classe de `grep`) n'est pas touché. L'octet
 * ESC, lui, n'apparaît jamais dans du texte ordinaire : `stripAnsi` peut ôter toute séquence.
 */
const CARET_CSI = /\^\[\[[0-9;]*[A-Za-z]/g

/**
 * Extrait du journal d'un job en échec (`gh run view --log-failed`), sans la colonne « job /
 * étape » ni l'horodatage que `gh` met devant chaque ligne. Relevé sur un vrai journal (fiche 176) :
 * la fin est le nettoyage du job (identifiants git, processus orphelins), l'échec est bien avant.
 * L'extrait prend donc les lignes d'échec avec quelques lignes autour, les premières d'abord ;
 * sans ligne d'échec reconnue, les dernières lignes.
 */
export function logExcerpt(log: string): string {
  const cleaned = log
    .split('\n')
    .map((line) =>
      // Couleurs du terminal : du bruit pour l'agent (0.9.1, D18). `gh run view --log-failed` les
      // écrit en notation caret, les deux caractères `^[` et non l'octet ESC (relevé sur un vrai
      // journal, `fixtures/gh/run-log-failed-caret.txt`) ; les deux formes sont ôtées.
      stripAnsi(line)
        .replace(CARET_CSI, '')
        .replace(/^[^\t]*\t[^\t]*\t/, '')
        .replace(/^﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '')
        .trimEnd()
    )
    .filter((line) => line.trim() !== '')
  const keep = new Set<number>()
  for (const [index, line] of cleaned.entries()) {
    if (!FAILURE_LINE.test(line)) continue
    for (let i = Math.max(0, index - 4); i <= Math.min(cleaned.length - 1, index + 3); i++) {
      keep.add(i)
    }
    if (keep.size >= EXCERPT_LINES) break
  }
  let text: string
  if (keep.size === 0) text = cleaned.slice(-EXCERPT_LINES).join('\n')
  else {
    const parts: string[] = []
    let previous = -1
    for (const index of [...keep].sort((x, y) => x - y).slice(0, EXCERPT_LINES)) {
      if (previous >= 0 && index > previous + 1) parts.push('…')
      parts.push(cleaned[index] ?? '')
      previous = index
    }
    text = parts.join('\n')
  }
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS)}…` : text
}

/** Consigne envoyée à l'agent (ADR-0014 : anglais, pas traduite). */
export function fixChecksPrompt(
  pr: Pick<PrView, 'number' | 'url'>,
  branch: string,
  failed: readonly (PrCheck & { log?: string })[]
): string {
  const parts = [
    `The CI checks of pull request #${pr.number} (${pr.url}) on branch \`${branch}\` failed:`,
    ''
  ]
  for (const check of failed) {
    parts.push(`### ${check.name}${check.url ? ` — ${check.url}` : ''}`)
    if (check.log) parts.push('', '```', check.log, '```')
    else parts.push('', '(no log available: open the link for details)')
    parts.push('')
  }
  parts.push(
    'Find the cause of each failure, fix it, run the relevant checks locally, then commit and ' +
      'push to the same branch so the pull request is updated.'
  )
  return parts.join('\n')
}

/* ----- Cadence de la relève ----- */

/** Juste après un push (ou un nouveau commit en tête) : GitHub inscrit les contrôles en secondes. */
export const POLL_FAST_MS = 10_000
/** Durée de la relève rapprochée après un push : 12 appels par minute, loin des quotas de GitHub. */
export const FAST_WINDOW_MS = 2 * 60_000
/** CI présente mais aucun contrôle signalé : « en attente » pendant ce délai, puis « rien ». */
export const CHECKS_GRACE_MS = 5 * 60_000
export const POLL_PENDING_MS = 30_000
export const POLL_MIN_MS = 60_000
export const POLL_MAX_MS = 10 * 60_000
/** Sans fenêtre au premier plan : relève au plus toutes les 10 min, plus rien après 30 min. */
export const BACKGROUND_MS = 10 * 60_000
export const BACKGROUND_STOP_MS = 30 * 60_000

/**
 * Délai avant la prochaine relève : 10 s dans les deux minutes qui suivent un push (`fast`) ;
 * 30 s tant qu'un contrôle tourne (ou est attendu) ou dès que quelque chose a changé ; sinon le
 * délai précédent doublé (1 min, 2, 4, 8, puis 10 min au plus).
 */
export function nextDelay(
  previous: number | undefined,
  pending: boolean,
  changed: boolean,
  fast = false
): number {
  if (fast) return POLL_FAST_MS
  if (pending || changed) return POLL_PENDING_MS
  if (previous === undefined) return POLL_MIN_MS
  return Math.min(Math.max(previous * 2, POLL_MIN_MS), POLL_MAX_MS)
}

/** Ce qui compte pour dire « quelque chose a changé » (relève remise à 30 s). */
export function prFingerprint(pr: PrView): string {
  return JSON.stringify([
    pr.state,
    pr.draft,
    pr.head,
    pr.comments,
    pr.review,
    pr.mergeable,
    pr.checks.map((c) => [c.name, c.state])
  ])
}

/**
 * Ce qu'une note de la carte (correction envoyée, fusion ratée) concerne : le commit en tête et
 * l'état des contrôles. Quand il change, la note n'a plus lieu d'être (0.9.1, D17).
 */
export function checksKey(pr: PrView): string {
  return JSON.stringify([pr.head, pr.checks.map((c) => [c.name, c.state])])
}
