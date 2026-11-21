import type { FileLinkCheck } from '@shared/file-links'
import type { TranscriptItem } from '@shared/transcript'

type ToolKind = Extract<TranscriptItem, { kind: 'tool' }>['toolKind']

/**
 * Existence des fichiers cités en code dans le fil d'une conversation (fiche 272, recette de la
 * rc.3), retenue par conversation : un fil remonté (A → B → A) montre ses liens d'emblée, sans
 * clignoter ni redemander. Les demandes de tous les messages d'un même instant partent en un seul
 * appel (200 chemins au plus par appel).
 *
 * Un « non » n'est jamais définitif : il est oublié quand le fil dit que des fichiers ont pu
 * changer (`sync` : fin d'un tour, outil d'écriture ou de commande terminé), et redemandé par les
 * messages qui le citent. Un chemin resté sans réponse (délai dépassé, appel en échec) n'est ni oui
 * ni non : il reste du code, redemandé au même signal.
 */

/** Demande au main : `files:existing` de la conversation. */
export type AskFiles = (hrefs: string[], base?: string) => Promise<FileLinkCheck>

/** Chemins par appel (même borne que le main). */
const MAX_ASKED = 200
/** Réponses retenues par conversation ; au-delà, on repart de zéro. */
const MAX_KNOWN = 2000
/** Conversations retenues ; la plus ancienne est oubliée. */
const MAX_CONVERSATIONS = 30

const keyOf = (base: string | undefined, href: string) => `${base ?? ''}\0${href}`

export class FileChecks {
  private readonly known = new Map<string, boolean>()
  /** Demandés, pas encore répondus. */
  private readonly inFlight = new Set<string>()
  /** Sans réponse (délai, échec) : pas redemandés avant le prochain signal. */
  private readonly held = new Set<string>()
  private queue = new Map<string | undefined, Set<string>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly listeners = new Set<() => void>()
  /** Change à chaque oubli des « non » : une réponse d'avant ne dit plus « non ». */
  private epoch = 0
  private revision: number | undefined

  private readonly ask: AskFiles

  constructor(ask: AskFiles) {
    this.ask = ask
  }

  /** Numéro du dernier signal : un chemin sans réponse se redemande quand il change. */
  get round(): number {
    return this.epoch
  }

  /** Vrai : existe ; faux : n'existe pas ; `undefined` : pas (encore) su. */
  status(base: string | undefined, href: string): boolean | undefined {
    return this.known.get(keyOf(base, href))
  }

  /** Demande ceux qu'on ne connaît pas ; un seul appel pour tout ce qui arrive au même instant. */
  request(base: string | undefined, hrefs: readonly string[]): void {
    let added = false
    for (const href of hrefs) {
      const key = keyOf(base, href)
      if (this.known.has(key) || this.inFlight.has(key) || this.held.has(key)) continue
      this.inFlight.add(key)
      const set = this.queue.get(base) ?? new Set<string>()
      set.add(href)
      this.queue.set(base, set)
      added = true
    }
    if (added && this.timer === undefined) this.timer = setTimeout(() => this.flush(), 0)
  }

  /** Signal du fil (nombre qui grandit quand des fichiers ont pu changer) : oublie les « non ». */
  sync(revision: number): void {
    const changed = this.revision !== undefined && revision !== this.revision
    this.revision = revision
    if (!changed) return
    this.epoch += 1
    this.held.clear()
    for (const [key, exists] of this.known) if (!exists) this.known.delete(key)
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }

  private flush(): void {
    this.timer = undefined
    const queue = this.queue
    this.queue = new Map()
    for (const [base, set] of queue) {
      const hrefs = [...set]
      for (let i = 0; i < hrefs.length; i += MAX_ASKED)
        this.send(base, hrefs.slice(i, i + MAX_ASKED))
    }
  }

  private send(base: string | undefined, hrefs: string[]): void {
    const epoch = this.epoch
    const settle = (answer: FileLinkCheck | null) => {
      const yes = new Set(answer?.existing ?? [])
      const unknown = new Set(answer ? answer.unknown : hrefs)
      if (this.known.size + hrefs.length > MAX_KNOWN) this.known.clear()
      for (const href of hrefs) {
        const key = keyOf(base, href)
        this.inFlight.delete(key)
        if (yes.has(href)) this.known.set(key, true)
        else if (unknown.has(href)) {
          if (epoch === this.epoch) this.held.add(key)
        }
        // Un « non » d'avant le dernier signal n'est plus sûr : redemandé.
        else if (epoch === this.epoch) this.known.set(key, false)
      }
      this.notify()
    }
    this.ask(hrefs, base).then(settle, () => settle(null))
  }
}

const checks = new Map<string, FileChecks>()

/** Existence des fichiers d'une conversation, retenue tant qu'elle est parmi les plus récentes. */
export function fileChecksFor(conversationId: string): FileChecks {
  let found = checks.get(conversationId)
  if (found) {
    checks.delete(conversationId)
  } else {
    found = new FileChecks((hrefs, base) =>
      window.api.fileLinks.existing(conversationId, hrefs, base)
    )
  }
  checks.set(conversationId, found)
  if (checks.size > MAX_CONVERSATIONS) checks.delete(checks.keys().next().value as string)
  return found
}

/** Pour les essais : oublie tout. */
export function resetFileChecks(): void {
  checks.clear()
}

/** Genres d'outils qui peuvent créer ou supprimer des fichiers. */
const WRITERS = new Set<ToolKind | undefined>(['edit', 'delete', 'move', 'execute', 'other'])

/**
 * Signal « des fichiers ont pu changer » d'un fil : outils d'écriture ou de commande terminés,
 * réponses finies (une réponse est datée à la fin de son tour).
 */
export function filesRevision(items: readonly TranscriptItem[]): number {
  let revision = 0
  for (const item of items) {
    if (item.kind === 'agent' && item.at !== undefined) revision += 1
    else if (item.kind === 'tool' && item.status !== 'pending' && item.status !== 'in_progress') {
      if (WRITERS.has(item.toolKind)) revision += 1
    }
  }
  return revision
}
