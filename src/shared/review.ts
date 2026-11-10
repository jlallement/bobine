/**
 * Relecture avant fusion (fiche 177) : une conversation fille relit le travail d'une autre (sa sœur,
 * ou sa mère) et rend ses remarques par l'outil `report_findings` du serveur MCP de l'app. Ici, ce
 * que partagent main et renderer : la consigne du relecteur (en anglais, ADR-0014), la validation
 * des arguments de l'outil, l'élément du fil de l'auteur et les remarques de diff qu'on en tire.
 */
import { clip } from './children'
import type { DiffNote } from './diff-notes'
import type { TranscriptItem, TranscriptState } from './transcript'
import type { UsageDigest } from './usage'

export const REVIEW_SEVERITIES = ['high', 'medium', 'low'] as const
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number]
export const REVIEW_CATEGORIES = ['correctness', 'simplification'] as const
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]

/** Bornes des arguments de `report_findings` : une remarque reste une remarque. */
export const MAX_FINDINGS = 40
export const FINDING_TITLE_CHARS = 160
export const FINDING_WHY_CHARS = 1_200
export const REVIEW_SUMMARY_CHARS = 600
/** Réponse du relecteur gardée sur la carte quand il n'a pas appelé l'outil (au plus). */
export const REVIEW_REPLY_CHARS = 4_000
/** Lignes de code citées au plus par remarque (lues dans le fichier par le main). */
export const FINDING_CODE_LINES = 12
/** Fichiers cités au plus dans la consigne. */
export const BRIEF_FILES = 40

/** Une remarque du relecteur, vérifiée par l'app. */
export interface ReviewFinding {
  /** `<relecteur>:<rang>` : la remarque de diff qu'on en tire garde cet identifiant. */
  id: string
  /** Chemin relatif au dossier de la conversation relue. */
  file: string
  line: number
  endLine?: number
  severity: ReviewSeverity
  category: ReviewCategory
  title: string
  why: string
  /** Code cité, lu dans le fichier au moment du rapport ; vide si illisible. */
  code: string
}

/**
 * - `running` : le relecteur travaille ;
 * - `reported` : il a rendu ses remarques (au moins un `report_findings`, peut-être vide) ;
 * - `silent` : un tour fini sans `report_findings` (sa réponse est dans son fil) ;
 * - `failed` : la consigne n'a pas pu partir.
 */
export type ReviewStatus = 'running' | 'reported' | 'silent' | 'failed'

/** Ce qui est relu (décision 7 de la fiche). */
export type ReviewScope = 'branch' | 'uncommitted'

/** Carte « Relecture » du fil de l'auteur : un seul élément par relecture, remplacé à chaque étape. */
export interface Review {
  /** Conversation du relecteur. */
  reviewId: string
  /** Titre du relecteur, agent choisi. */
  title: string
  profileLabel: string
  scope: ReviewScope
  /** Point de comparaison (commit abrégé) et branche de base, pour une branche. */
  base?: string
  baseBranch?: string
  /** Fichiers à relire au départ. */
  files: number
  status: ReviewStatus
  findings: ReviewFinding[]
  /** Avis d'ensemble du relecteur. */
  summary?: string
  /**
   * Fin de tour sans `report_findings` (`silent`, `failed`) : la réponse du relecteur à ce tour,
   * bornée, pour qu'une relecture rendue en texte libre ne soit pas perdue.
   */
  reply?: string
  /** Le dossier a changé pendant la relecture (empreinte, décision 2). */
  changed?: true
  error?: string
  /** Ce qu'a coûté le relecteur jusque-là (fiche 109), tel que son fil le sait. */
  usage?: UsageDigest
  at: number
}

/** Ce que la consigne cite du travail relu. */
export interface ReviewTarget {
  scope: ReviewScope
  /** Commit complet du point de comparaison (branche). */
  base?: string
  baseBranch?: string
  /** Fichiers modifiés (`git diff --name-only`, nouveaux compris). */
  files: string[]
  /** Titre de la conversation relue. */
  authorTitle: string
}

/** Début de la consigne : l'agent factice reconnaît une relecture à ces mots (fiche 177). */
export const REVIEW_BRIEF_LEAD = 'Code review request from Bobine.'

/**
 * Consigne fixe du relecteur : correction d'abord, simplification ensuite ; ne rien modifier ;
 * rendre les remarques par `report_findings`. `focus` : ce que l'utilisateur veut qu'on regarde.
 */
export function reviewBrief(target: ReviewTarget, focus?: string): string {
  const what =
    target.scope === 'branch' && target.base
      ? `everything changed since commit ${target.base}${target.baseBranch ? ` (where this branch left ${target.baseBranch})` : ''}: ` +
        `the commits of this branch and the uncommitted changes. Read it with \`git diff ${target.base}\`, ` +
        'and `git status` for new files.'
      : 'the uncommitted changes of this folder. Read them with `git diff HEAD`, and `git status` ' +
        'for new files.'
  const shown = target.files.slice(0, BRIEF_FILES)
  const more = target.files.length - shown.length
  const files = [
    ...shown.map((file) => `- ${file}`),
    ...(more > 0 ? [`- … and ${more} more`] : [])
  ].join('\n')
  const extra = focus?.trim()
    ? `\n\nThe user asks you to look in particular at:\n${focus.trim()}`
    : ''
  return (
    `${REVIEW_BRIEF_LEAD} Review the work of the conversation "${target.authorTitle}" before ` +
    `the user keeps or merges it.\n\n` +
    `What to review: ${what}\n\nFiles changed:\n${files}${extra}\n\n` +
    'How:\n' +
    '1. Correctness first: bugs, wrong logic, missed cases, broken error handling, security, ' +
    'races, tests that do not test what they claim. Then simplification: duplicated code, needless ' +
    'complexity, existing helpers that should be reused. Skip style nits and anything a linter ' +
    'catches.\n' +
    '2. Read the surrounding code and run read-only commands (git, tests, type checks) as needed. ' +
    'Do NOT modify, create, delete, stage or commit any file, and do not switch branches: this ' +
    'folder is the author’s working copy. The app checks that nothing changed.\n' +
    '3. Report with the `report_findings` tool of the bobine server, once, with every finding: ' +
    'file (relative to this folder), line (and endLine) in the current version of the file, ' +
    'severity (high: must fix before merging; medium: should fix; low: worth considering), ' +
    'category (correctness or simplification), a short title, and why (the concrete failure or ' +
    'cost, and the fix). Only report what you are confident about; an empty list is a valid ' +
    'answer. Your findings become comments on the diff that the user may send to the author.\n' +
    '4. Then end your turn with one or two sentences: your overall verdict.'
  )
}

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1

const text = (value: unknown, key: string, max: number, index: number): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`findings[${index}].${key}: a non-empty string is expected`)
  return clip(value.trim(), max)
}

/** Remarque telle que l'agent l'envoie, vérifiée, sans le code (lu ensuite dans le fichier). */
export type ParsedFinding = Omit<ReviewFinding, 'id' | 'code'>

/**
 * Arguments de `report_findings`, vérifiés : une erreur claire pour l'agent plutôt qu'une remarque
 * à moitié comprise. Les chemins sont vérifiés ensuite par le main (dans le dossier).
 */
export function parseFindings(args: Record<string, unknown>): {
  findings: ParsedFinding[]
  summary?: string
} {
  const raw = args['findings']
  if (!Array.isArray(raw)) throw new Error('`findings`: an array is expected (it may be empty)')
  if (raw.length > MAX_FINDINGS)
    throw new Error(`\`findings\`: ${MAX_FINDINGS} at most; keep the most important ones`)
  const findings = raw.map((item: unknown, index): ParsedFinding => {
    if (typeof item !== 'object' || item === null)
      throw new Error(`findings[${index}]: an object is expected`)
    const f = item as Record<string, unknown>
    const file = text(f['file'], 'file', 500, index)
    if (!isInt(f['line'])) throw new Error(`findings[${index}].line: a line number (1 or more)`)
    const line = f['line']
    const endLine = f['endLine']
    if (endLine !== undefined && (!isInt(endLine) || endLine < line))
      throw new Error(`findings[${index}].endLine: a line number not before \`line\``)
    const severity = f['severity']
    if (!REVIEW_SEVERITIES.includes(severity as ReviewSeverity))
      throw new Error(`findings[${index}].severity: one of ${REVIEW_SEVERITIES.join(', ')}`)
    const category = f['category'] ?? 'correctness'
    if (!REVIEW_CATEGORIES.includes(category as ReviewCategory))
      throw new Error(`findings[${index}].category: one of ${REVIEW_CATEGORIES.join(', ')}`)
    return {
      file,
      line,
      ...(endLine !== undefined && endLine !== line ? { endLine } : {}),
      severity: severity as ReviewSeverity,
      category: category as ReviewCategory,
      title: text(f['title'], 'title', FINDING_TITLE_CHARS, index),
      why: text(f['why'], 'why', FINDING_WHY_CHARS, index)
    }
  })
  const summary = args['summary']
  if (summary !== undefined && typeof summary !== 'string')
    throw new Error('`summary`: a string is expected')
  return {
    findings,
    ...(typeof summary === 'string' && summary.trim()
      ? { summary: clip(summary.trim(), REVIEW_SUMMARY_CHARS) }
      : {})
  }
}

/** Remarques de gravité haute d'une relecture (carte, compte). */
export const severeCount = (review: Pick<Review, 'findings'>): number =>
  review.findings.filter((f) => f.severity === 'high').length

/** Remarque de diff (fiche 085) tirée d'une remarque de relecture : vue Git, sur ses lignes. */
export function findingNote(finding: ReviewFinding): DiffNote {
  return {
    id: finding.id,
    view: 'git',
    file: finding.file,
    path: finding.file,
    side: 'new',
    from: finding.line,
    to: finding.endLine ?? finding.line,
    code: finding.code,
    comment: `${finding.title}\n${finding.why}`,
    review: { severity: finding.severity, category: finding.category }
  }
}

/** Remarques de toutes les relectures d'un fil, dans l'ordre. */
export function reviewFindings(
  items: readonly { kind: string; findings?: ReviewFinding[] }[]
): ReviewFinding[] {
  return items.flatMap((item) => (item.kind === 'review' ? (item.findings ?? []) : []))
}

/** Carte d'une relecture dans le fil : un seul élément par `reviewId`, remplacé à chaque étape. */
export function reduceReview(state: TranscriptState, review: Review): TranscriptState {
  const index = state.items.findLastIndex(
    (i) => i.kind === 'review' && i.reviewId === review.reviewId
  )
  const current = state.items[index]
  if (!current) {
    const item: TranscriptItem = { kind: 'review', id: state.nextId, ...review }
    return { ...state, items: [...state.items, item], nextId: state.nextId + 1 }
  }
  const items = state.items.slice()
  items[index] = { ...review, kind: 'review', id: current.id }
  return { ...state, items }
}
