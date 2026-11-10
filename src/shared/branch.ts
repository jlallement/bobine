/**
 * Modifier un message et repartir de là (fiche 023). ACP ne sait pas couper une session à un
 * message : on ouvre une **branche**, une nouvelle session qui reçoit l'échange antérieur en
 * contexte. Ce module calcule ce qui est repris, ce qui est envoyé à l'agent, et les fichiers que
 * l'agent a modifiés depuis ce point (pour les remettre dans leur état d'alors).
 */
import { APP_CONTEXT_OPENINGS } from './app-context'
import type { TranscriptItem, TranscriptState } from './transcript'
import { settleTranscript, withSubagentWork } from './transcript'

/** Taille maximale du contexte envoyé à l'agent : au-delà, le début de l'échange est omis. */
export const MAX_CONTEXT_CHARS = 60_000
/** Taille maximale d'un message repris dans le contexte. */
const MAX_MESSAGE_CHARS = 8_000

type UserItem = Extract<TranscriptItem, { kind: 'user' }>

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Titre d'une branche sans sa marque « · branche » (ou « · branche 2 », ou celle d'une autre
 * langue) : la barre latérale l'affiche à part, en repère qui ne se coupe pas (fiche 125).
 * `suffix` : la marque dans la langue du moment ; « branche » d'avant la fiche 074 aussi.
 */
export function branchBase(title: string, suffix: string): string {
  return title.replace(new RegExp(` · (branche|${escapeRegExp(suffix)})( \\d+)?$`), '')
}

/** Message de l'utilisateur d'où repartir, et sa position dans le fil. */
export function branchPoint(
  items: readonly TranscriptItem[],
  itemId: number
): { index: number; message: UserItem } | undefined {
  const index = items.findIndex((i) => i.id === itemId)
  const message = items[index]
  return message?.kind === 'user' ? { index, message } : undefined
}

/**
 * Échange repris dans la branche : tout ce qui précède le message modifié, rien en attente. Une
 * bascule vers un autre agent juste avant (fiche 108) n'est pas reprise : le contexte de la branche
 * porte déjà tout l'échange, il ne doit pas partir deux fois.
 */
export function inheritedTranscript(state: TranscriptState, index: number): TranscriptState {
  let end = index
  while (end > 0 && state.items[end - 1]?.kind === 'handover') end--
  return settleTranscript({
    items: state.items.slice(0, end),
    nextId: state.nextId,
    ...(state.terminals ? { terminals: state.terminals } : {})
  })
}

/**
 * Échange rendu en texte pour un agent (messages, outils résumés, pièces jointes nommées), borné à
 * `MAX_CONTEXT_CHARS` : au-delà, le début est omis. Partagé par la branche (fiche 023) et la
 * bascule vers un autre agent (fiche 108).
 */
export function conversationText(items: readonly TranscriptItem[]): string {
  const body = items.flatMap(contextLines).join('\n')
  return body.length > MAX_CONTEXT_CHARS
    ? `[… earlier part of the conversation omitted …]\n${body.slice(-MAX_CONTEXT_CHARS)}`
    : body
}

/**
 * Contexte joint au nouveau message, après lui (fiche 125) : l'échange repris, sous forme de texte
 * (messages, outils résumés, pièces jointes nommées). Les consignes sont en anglais, comme les
 * autres consignes de l'app à l'agent ; l'échange reste dans sa langue.
 */
export function branchContext(
  items: readonly TranscriptItem[],
  options: { filesRestored?: boolean; filesChanged?: boolean } = {}
): string {
  const body = conversationText(items)
  const files = options.filesRestored
    ? 'Files the assistant changed after this point have been restored to their state at that time.'
    : options.filesChanged
      ? 'Files the assistant changed after this point were NOT restored: they keep their current content.'
      : ''
  return [
    `${APP_CONTEXT_OPENINGS.branch}, from a point where I changed my message: my new message is`,
    'above. Here is the earlier exchange up to that point, for context only: do not redo or repeat',
    'it.',
    ...(files ? [files] : []),
    '',
    '<earlier_conversation>',
    body || '(no earlier messages)',
    '</earlier_conversation>'
  ].join('\n')
}

function contextLines(item: TranscriptItem): string[] {
  switch (item.kind) {
    case 'user': {
      const attached = (item.attachments ?? []).map((a) => a.name)
      return [
        `User: ${clip(item.text)}${attached.length ? ` [attached: ${attached.join(', ')}]` : ''}`
      ]
    }
    case 'agent':
      return [`Assistant: ${clip(item.text)}`]
    case 'tool': {
      const diffs = item.content.flatMap((c) => (c.type === 'diff' ? [c.path] : []))
      const files = diffs.length ? ` — files: ${diffs.join(', ')}` : ''
      return [`  (assistant used a tool: ${item.title} — ${item.status}${files})`]
    }
    case 'elicitation': {
      const answer =
        item.state === 'accept' && item.content ? ` — answer: ${JSON.stringify(item.content)}` : ''
      return [`  (assistant asked: ${clip(item.prompt.message)}${answer})`]
    }
    case 'compaction':
      return item.summary ? [`  (summary of the earlier conversation: ${clip(item.summary)})`] : []
    case 'handover':
      return item.reason
        ? ['  (conversation continued in a new session of the same assistant)']
        : [`  (conversation continued with another assistant: ${item.to.label})`]
    default:
      return []
  }
}

function clip(text: string): string {
  const clean = text.trim()
  return clean.length > MAX_MESSAGE_CHARS ? `${clean.slice(0, MAX_MESSAGE_CHARS)} […]` : clean
}

/** Modification d'un fichier par l'agent, telle que le diff ACP la décrit. */
export interface FileEdit {
  /**
   * Texte remplacé : le fichier entier (Bob) ou un extrait (OpenCode) ; `null` ou vide : fichier
   * créé (Bob 2.0.6 envoie `""`, fiche 021).
   */
  oldText: string | null
  /** Texte qui l'a remplacé : fichier entier ou extrait. */
  newText: string
}

/** Fichier modifié par l'agent depuis le point de départ, avec ses modifications dans l'ordre. */
export interface FileChange {
  path: string
  edits: FileEdit[]
}

/** Fichiers modifiés par les outils terminés depuis `index` (le message modifié compris). */
export function fileChangesSince(items: readonly TranscriptItem[], index: number): FileChange[] {
  const changes = new Map<string, FileChange>()
  for (const item of withSubagentWork(items.slice(index))) {
    if (item.kind !== 'tool' || item.status !== 'completed') continue
    for (const content of item.content) {
      if (content.type !== 'diff') continue
      const change = changes.get(content.path) ?? { path: content.path, edits: [] }
      change.edits.push({ oldText: content.oldText ?? null, newText: content.newText })
      changes.set(content.path, change)
    }
  }
  return [...changes.values()]
}

/**
 * Contenu du fichier avant ces modifications, en les défaisant de la dernière à la première à
 * partir du contenu actuel : `{ deleted: true }` s'il avait été créé, `undefined` si on ne peut pas
 * le savoir sans risque (quelqu'un l'a modifié depuis).
 *
 * Une modification se défait si le fichier entier est son texte d'arrivée (diff complet), ou si ce
 * texte apparaît une seule fois dans le fichier (diff par extrait).
 */
export function undoEdits(
  current: string | null,
  edits: readonly FileEdit[]
): { content: string } | { deleted: true } | undefined {
  let content = current
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i]
    if (!edit || content === null) return undefined
    const created = !edit.oldText
    if (content === edit.newText) {
      if (created) {
        // Le fichier n'existait pas avant cette modification (la toute première).
        if (i === 0) return { deleted: true }
        return undefined
      }
      content = edit.oldText ?? ''
      continue
    }
    if (created || !edit.newText || occurrences(content, edit.newText) !== 1) return undefined
    content = content.replace(edit.newText, () => edit.oldText ?? '')
  }
  return content === null ? undefined : { content }
}

function occurrences(text: string, part: string): number {
  let count = 0
  for (let at = text.indexOf(part); at !== -1; at = text.indexOf(part, at + part.length)) count++
  return count
}

/** Commandes lancées par l'agent depuis le point de départ : elles ne s'annulent pas. */
export function commandsSince(items: readonly TranscriptItem[], index: number): number {
  return items
    .slice(index)
    .filter((i) => i.kind === 'tool' && i.toolKind === 'execute' && i.status === 'completed').length
}
