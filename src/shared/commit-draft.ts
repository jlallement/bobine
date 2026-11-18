/**
 * Message de commit rédigé par l'agent (fiche 246, ADR-0056) : la demande envoyée à une session
 * jetable du même agent, la lecture de sa réponse, et le repli déduit des fichiers seuls. Générique :
 * aucun agent n'est nommé ici. Ce qui va à l'agent est en anglais (ADR-0014).
 */
import { APP_CONTEXT_OPENINGS } from './app-context'
import type { MemoryEntry } from './memory'
import { filesSubject, type CommitFile } from './worktree-cycle'

/** Délai maximal de la rédaction, lancement de l'agent compris ; au-delà, le repli. */
export const DRAFT_TIMEOUT_MS = 45_000
/** Bornes de ce qui part chez l'agent. */
export const DRAFT_LIMITS = {
  /** Diff d'un fichier ; au-delà, le fichier est cité sans son diff. */
  fileDiffChars: 4_000,
  /** Diff de tous les fichiers. */
  totalDiffChars: 24_000,
  /** Souvenirs approuvés (« Vous » et projet). */
  memoryChars: 4_000,
  /** Premier message de la conversation. */
  firstMessageChars: 1_000,
  /** Réponse plus longue : ce n'est pas un message de commit, repli. */
  replyChars: 5_000
} as const

/** Fichiers listés dans le corps du repli, au plus. */
const FALLBACK_BODY_FILES = 20

/** Ce qu'un fichier envoie à l'agent : son diff, ou la raison de ne pas l'envoyer. */
export interface CommitDraftFile extends CommitFile {
  /** Diff (ou contenu d'un fichier non suivi), déjà borné et sans secret. */
  diff?: string
  /** Contenu retenu : fichier « secret ? », binaire, ou diff trop long. */
  withheld?: 'secret' | 'binary' | 'too-long'
  /** Lignes ajoutées et retirées, quand le diff n'est pas envoyé en entier. */
  added?: number
  removed?: number
}

/** Tout ce que la demande contient. */
export interface CommitDraftInput {
  title: string
  /** Premier message de l'utilisateur dans la conversation (borné, sans secret). */
  firstMessage?: string
  /** Souvenirs approuvés ; vide si la mémoire est désactivée. */
  memories: readonly Pick<MemoryEntry, 'name' | 'description' | 'body'>[]
  files: readonly CommitDraftFile[]
}

/** Où se fait le commit : dossier de la conversation (ou son worktree), ou racine du dépôt. */
export type CommitDraftPlace = 'conversation' | 'root'

/** Demande du renderer (IPC `commit:draft`). */
export interface CommitDraftRequest {
  files: CommitFile[]
  place: CommitDraftPlace
}

/** Pourquoi le message vient du repli. */
export type CommitDraftReason =
  'disabled' | 'timeout' | 'stopped' | 'refused' | 'failed' | 'needs-action' | 'empty' | 'too-long'

/** Issue d'une rédaction (IPC `commit:draft`). */
export type CommitDraftResult =
  | {
      source: 'agent'
      message: string
      agentLabel: string
      ms: number
      /** Des souvenirs sont partis avec la demande. */
      withMemory: boolean
    }
  | {
      source: 'fallback'
      message: string
      reason: CommitDraftReason
      agentLabel?: string
      /** Erreur de l'agent, telle quelle (`failed`). */
      detail?: string
      /** Délai dépassé (`timeout`), en millisecondes. */
      timeoutMs?: number
    }

const statusWord = (file: CommitFile): string =>
  file.status === 'untracked' ? 'new' : file.status === 'added' ? 'new' : file.status

/** Texte borné à `max` caractères, coupé à la dernière fin de ligne. */
export function boundedText(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const line = cut.lastIndexOf('\n')
  return `${line > max / 2 ? cut.slice(0, line) : cut}\n[… truncated …]`
}

/** Souvenirs en texte, bornés : les premiers entiers, puis le compte de ceux qui ne tiennent pas. */
function memoryText(memories: CommitDraftInput['memories']): string {
  const lines: string[] = []
  let used = 0
  let omitted = 0
  for (const m of memories) {
    const line = `- ${m.name}: ${m.description}\n${m.body.trim().replace(/^/gm, '  ')}`
    if (used + line.length > DRAFT_LIMITS.memoryChars) {
      omitted++
      continue
    }
    lines.push(line)
    used += line.length + 1
  }
  if (omitted > 0) lines.push(`- (${omitted} more notes omitted)`)
  return lines.join('\n')
}

function fileLine(file: CommitDraftFile): string {
  const counts =
    file.added !== undefined || file.removed !== undefined
      ? ` +${file.added ?? 0} -${file.removed ?? 0}`
      : ''
  const why =
    file.withheld === 'secret'
      ? ', content withheld: may contain secrets'
      : file.withheld === 'binary'
        ? ', binary'
        : file.withheld === 'too-long'
          ? ', diff omitted: too long'
          : ''
  return `- ${file.path} (${statusWord(file)}${why})${counts}`
}

/** La demande, en un seul message : consigne, notes de l'utilisateur, intention, fichiers, diff. */
export function commitDraftPrompt(input: CommitDraftInput): string {
  const lines = [
    APP_CONTEXT_OPENINGS.commitMessage,
    'Write the git commit message for the change below. Reply with the commit message only: no',
    'preamble, no explanation, no code fence. Do not use any tool and do not change anything:',
    'everything you need is below, and this short-lived session is read only.',
    'Unless the user’s notes below say otherwise, use Conventional Commits in English: a subject',
    'line under 72 characters, then a blank line and a short body when it helps.'
  ]
  if (input.memories.length > 0) {
    lines.push(
      '',
      'Notes the user saved about how they work (follow them for this message):',
      '<user_notes>',
      memoryText(input.memories),
      '</user_notes>'
    )
  }
  lines.push('', `Conversation title: ${input.title.replace(/\s+/g, ' ').trim() || '(none)'}`)
  if (input.firstMessage?.trim()) {
    lines.push(
      'First request of the conversation (the intent):',
      '<first_request>',
      input.firstMessage.trim(),
      '</first_request>'
    )
  }
  lines.push('', `Files to commit (${input.files.length}):`, ...input.files.map(fileLine))
  const diffs = input.files.filter((f) => f.diff)
  if (diffs.length > 0) {
    lines.push('', '<diff>', ...diffs.map((f) => f.diff ?? ''), '</diff>')
  }
  lines.push('</bobine_commit_message>')
  return lines.join('\n')
}

/**
 * Réponse de l'agent : le texte sans le bloc de code qui l'entoure. Un tour fini autrement que
 * `end_turn`, une réponse vide ou démesurée donnent la raison du repli ; rien d'autre n'est réécrit.
 */
export function draftFromReply(
  text: string,
  stopReason: string
): { message: string } | { reason: CommitDraftReason } {
  if (stopReason === 'refusal') return { reason: 'refused' }
  if (stopReason === 'cancelled') return { reason: 'stopped' }
  if (stopReason !== 'end_turn') return { reason: 'failed' }
  let message = text.trim()
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(message)
  if (fenced) message = (fenced[1] ?? '').trim()
  if (!message) return { reason: 'empty' }
  if (message.length > DRAFT_LIMITS.replyChars) return { reason: 'too-long' }
  return { message }
}

const DOC_FILE = /(^|\/)(docs?|doc)\/|\.(md|mdx|markdown|txt|rst|adoc)$/i
const TEST_FILE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$/i

/**
 * Repli (ADR-0056, § 5) : Conventional Commits en anglais, déduit des fichiers seuls. Type `docs` ou
 * `test` si tous les fichiers le sont, sinon `chore` (Bobine ne connaît pas l'intention) ; sujet
 * qui change de forme au lieu de couper un mot ; corps : la liste des fichiers.
 */
export function fallbackCommitMessage(files: readonly CommitFile[]): string {
  if (files.length === 0) return 'chore: update files'
  const type = files.every((f) => DOC_FILE.test(f.path))
    ? 'docs'
    : files.every((f) => TEST_FILE.test(f.path))
      ? 'test'
      : 'chore'
  const subject = `${type}: ${filesSubject(files)}`
  const note = (f: CommitFile) =>
    f.status === 'added' || f.status === 'untracked'
      ? ' (new)'
      : f.status === 'deleted'
        ? ' (deleted)'
        : f.status === 'renamed'
          ? ' (renamed)'
          : ''
  const body = files.slice(0, FALLBACK_BODY_FILES).map((f) => `- ${f.path}${note(f)}`)
  if (files.length > FALLBACK_BODY_FILES) {
    body.push(`- … and ${files.length - FALLBACK_BODY_FILES} more`)
  }
  return `${subject}\n\n${body.join('\n')}`
}
