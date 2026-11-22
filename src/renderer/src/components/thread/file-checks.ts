import type { FileLinkCheck } from '@shared/file-links'
import type { TranscriptItem } from '@shared/transcript'

type ToolKind = Extract<TranscriptItem, { kind: 'tool' }>['toolKind']

/**
 * Existence des fichiers cités en code dans le fil d'une conversation (fiche 272, recette de la
 * rc.3), retenue par conversation : un fil remonté (A → B → A) montre ses liens d'emblée, sans
 * clignoter ni redemander. Les demandes de tous les messages d'un même instant partent en un seul
 * appel (200 chemins au plus par appel).
 *
 * Un « non » n'est jamais définitif : quand le fil dit que des fichiers ont pu changer (`sync` :
 * fin d'un tour, outil d'écriture ou de commande terminé), la mémoire revérifie elle-même ses
 * « non » et ses chemins restés sans réponse (délai dépassé, appel en échec), en gardant leur
 * affichage (du code) : les messages ne refont leur rendu que si un lien apparaît ou disparaît.
 */

/** Demande au main : `files:existing` de la conversation. */
export type AskFiles = (hrefs: string[], base?: string) => Promise<FileLinkCheck>

/** Chemins par appel (même borne que le main). */
const MAX_ASKED = 200
/** Réponses retenues par conversation ; au-delà, les plus anciennes sont oubliées une à une. */
export const MAX_KNOWN = 2000
/** Conversations retenues ; la plus ancienne est oubliée. */
const MAX_CONVERSATIONS = 30

const keyOf = (base: string | undefined, href: string) => `${base ?? ''}\0${href}`

interface Entry {
  base: string | undefined
  href: string
  /** `new` : jamais répondu ; `unknown` : sans réponse (délai, échec). */
  state: 'yes' | 'no' | 'unknown' | 'new'
  /** En file ou en cours de demande. */
  pending: boolean
  /**
   * Lien cliqué vers un fichier introuvable (fiche 272, D2) : montré barré tant qu'une
   * revérification ne l'a pas retrouvé. Horodaté (`clock`) : un « oui » demandé avant le clic
   * ne le fait pas revenir.
   */
  gone?: number
}

export class FileChecks {
  /** Par ordre d'arrivée (ou de dernière réponse) : les plus anciennes sont oubliées d'abord. */
  private readonly entries = new Map<string, Entry>()
  private queue = new Map<string | undefined, Set<string>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly listeners = new Set<() => void>()
  /** Change à chaque signal : une réponse demandée avant n'est plus sûre, sauf un « oui ». */
  private epoch = 0
  private revision: number | undefined
  /** Ordre des demandes et des clics « introuvable » (voir `gone`). */
  private clock = 0

  private readonly ask: AskFiles

  constructor(ask: AskFiles) {
    this.ask = ask
  }

  /**
   * Vrai : existe (un lien) ; faux : n'existe pas, ou pas encore su (du code) ; `undefined` :
   * jamais demandé.
   */
  status(base: string | undefined, href: string): boolean | undefined {
    const entry = this.entries.get(keyOf(base, href))
    return entry ? entry.state === 'yes' : undefined
  }

  /** Lien cliqué dont le fichier est introuvable (fiche 272, D2) : barré jusqu'à son retour. */
  gone(base: string | undefined, href: string): boolean {
    return this.entries.get(keyOf(base, href))?.gone !== undefined
  }

  /**
   * Clic sur un lien dont le fichier n'existe plus : retenu comme « non », barré ; revérifié au
   * prochain signal du fil comme tout « non » (le lien revient si le fichier revient).
   */
  markGone(base: string | undefined, href: string): void {
    const key = keyOf(base, href)
    const entry = this.entries.get(key)
    const stamp = ++this.clock
    if (entry?.gone !== undefined && entry.state === 'no') {
      entry.gone = stamp
      return
    }
    if (entry) {
      entry.state = 'no'
      entry.gone = stamp
    } else this.remember(key, { base, href, state: 'no', pending: false, gone: stamp })
    this.notify()
  }

  /** Demande ceux qu'on n'a jamais demandés ; un seul appel pour ce qui arrive au même instant. */
  request(base: string | undefined, hrefs: readonly string[]): void {
    for (const href of hrefs) {
      const key = keyOf(base, href)
      if (this.entries.has(key)) continue
      this.remember(key, { base, href, state: 'new', pending: false })
      this.enqueue(key)
    }
  }

  /** Signal du fil (nombre qui grandit quand des fichiers ont pu changer) : revérifie les « non ». */
  sync(revision: number): void {
    const changed = this.revision !== undefined && revision !== this.revision
    this.revision = revision
    if (!changed) return
    this.epoch += 1
    for (const [key, entry] of this.entries) if (entry.state !== 'yes') this.enqueue(key)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Nombre de chemins retenus (essais). */
  get size(): number {
    return this.entries.size
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }

  private remember(key: string, entry: Entry): void {
    this.entries.delete(key)
    this.entries.set(key, entry)
    // Les plus anciennes d'abord, une à une, jamais une en cours de demande ; sans prévenir les
    // messages : un lien affiché le reste jusqu'à leur prochain rendu.
    for (const [old, value] of this.entries) {
      if (this.entries.size <= MAX_KNOWN) break
      if (!value.pending && old !== key) this.entries.delete(old)
    }
  }

  private enqueue(key: string): void {
    const entry = this.entries.get(key)
    if (!entry || entry.pending) return
    entry.pending = true
    const set = this.queue.get(entry.base) ?? new Set<string>()
    set.add(entry.href)
    this.queue.set(entry.base, set)
    if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), 0)
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
    const asked = ++this.clock
    const settle = (answer: FileLinkCheck | null) => {
      const yes = new Set(answer?.existing ?? [])
      const unknown = new Set(answer ? answer.unknown : hrefs)
      let shown = false
      const again: string[] = []
      for (const href of hrefs) {
        const key = keyOf(base, href)
        const entry = this.entries.get(key)
        if (!entry) continue
        entry.pending = false
        const before = entry.state === 'yes'
        if (yes.has(href) && entry.gone !== undefined && entry.gone > asked) {
          // « Oui » demandé avant le clic qui a dit « introuvable » : plus à jour, le « non » reste.
        } else if (yes.has(href)) {
          entry.state = 'yes'
          // Le fichier est revenu : le lien aussi.
          if (entry.gone !== undefined) shown = true
          delete entry.gone
        } else if (epoch !== this.epoch) {
          // Signal arrivé pendant la demande : la réponse ne dit plus « non », redemandée.
          again.push(key)
        } else entry.state = unknown.has(href) ? 'unknown' : 'no'
        if (before !== (entry.state === 'yes')) shown = true
      }
      for (const key of again) this.enqueue(key)
      // Les messages ne sont prévenus que si un lien apparaît ou disparaît.
      if (shown) this.notify()
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
