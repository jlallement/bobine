/**
 * Garde-fou des rôles en lecture seule (fiche 223), indépendant des demandes d'autorisation : un
 * agent qui écrit sans demander (OpenCode réglé par défaut) n'est pas arrêté par un refus. Une
 * empreinte git du dossier (`folder-fingerprint.ts`) est prise quand la fille reçoit un message et
 * comparée à la fin de son tour ; un écart est dit dans son fil et dans celui de sa mère, qui
 * partage le dossier. Rien n'est défait : l'utilisateur voit et décide.
 *
 * L'empreinte de départ est prise **avant** l'envoi quand le message passe par Bobine (consigne de
 * lancement, message de la mère : `prepare`) ; un message tapé par l'utilisateur dans la fille la
 * fait prendre à son départ, en même temps que l'agent commence (un agent réel met bien plus de
 * temps à écrire qu'un `git status`).
 *
 * Pour ne pas accuser la fille à tort, le tour n'est pas jugé quand une autre conversation du même
 * dossier (sa mère, une sœur en lecture seule) a lancé pendant ce temps un outil qui peut écrire
 * (modification, suppression, déplacement, commande). Une modification faite à la main par
 * l'utilisateur pendant le tour serait signalée : le texte dit « le dossier a changé », sans plus.
 * Suivi perdu au redémarrage de l'app, comme celui des relecteurs (fiche 177).
 */
import type { ConversationEvent, ConversationSummary } from '@shared/agent'
import { messageOf } from '@shared/errors'
import type { ConversationManager } from '../conversations/manager'
import { folderFingerprint } from '../conversations/folder-fingerprint'
import { log } from '../log'
import type { Run } from '../simulator/run'

export interface ReadOnlyWatchDeps {
  conversations: Pick<ConversationManager, 'post'>
  /** Résumé d'une conversation ; lève si elle n'existe plus. */
  summary: (id: string) => ConversationSummary
  run: Run
}

interface Turn {
  workspace: string
  baseline: Promise<string | undefined>
  /** Une autre conversation du dossier a lancé un outil qui peut écrire pendant le tour. */
  shared: boolean
}

/** Genres d'outils ACP qui peuvent changer le dossier. */
const WRITING_KINDS: ReadonlySet<string> = new Set(['edit', 'delete', 'move', 'execute'])

export class ReadOnlyWatch {
  private readonly deps: ReadOnlyWatchDeps
  private readonly turns = new Map<string, Turn>()
  /** Empreintes prises avant l'envoi d'un message de Bobine, en attente de son tour. */
  private readonly prepared = new Map<string, { workspace: string; fingerprint?: string }>()

  constructor(deps: ReadOnlyWatchDeps) {
    this.deps = deps
  }

  onEvent(payload: ConversationEvent): void {
    const { conversationId: id, event } = payload
    if (event.type === 'update') this.noteTool(id, event.update)
    else if (event.type === 'user-message') this.turnStarted(id)
    else if (event.type === 'turn-end' || event.type === 'turn-error') {
      const turn = this.turns.get(id)
      this.turns.delete(id)
      if (turn) {
        void this.check(id, turn).catch((error: unknown) =>
          log.warn('Lecture seule : fin de tour non vérifiée :', messageOf(error))
        )
      }
    }
  }

  forget(id: string): void {
    this.turns.delete(id)
    this.prepared.delete(id)
  }

  /**
   * Avant d'envoyer un message de Bobine à une fille en lecture seule : l'empreinte de départ de
   * son prochain tour. Sans effet pour une autre conversation ; ne lève jamais.
   */
  async prepare(id: string): Promise<void> {
    const child = this.find(id)
    if (!child?.role?.readOnly || !child.startedFrom) return
    const { workspace } = child
    const fingerprint = await folderFingerprint(this.deps.run, workspace).catch(() => undefined)
    this.prepared.set(id, { workspace, ...(fingerprint ? { fingerprint } : {}) })
  }

  /** Tours suivis (essais). */
  get watching(): number {
    return this.turns.size
  }

  private find(id: string): ConversationSummary | undefined {
    try {
      return this.deps.summary(id)
    } catch {
      return undefined
    }
  }

  private turnStarted(id: string): void {
    const ready = this.prepared.get(id)
    this.prepared.delete(id)
    if (ready) {
      this.turns.set(id, {
        workspace: ready.workspace,
        baseline: Promise.resolve(ready.fingerprint),
        shared: false
      })
      return
    }
    const child = this.find(id)
    if (!child?.role?.readOnly || !child.startedFrom) return
    const { workspace } = child
    this.turns.set(id, {
      workspace,
      baseline: folderFingerprint(this.deps.run, workspace).catch(() => undefined),
      shared: false
    })
  }

  private noteTool(id: string, update: { sessionUpdate: string; kind?: string | null }): void {
    if (this.turns.size === 0) return
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
    if (!update.kind || !WRITING_KINDS.has(update.kind)) return
    const workspace = this.find(id)?.workspace
    for (const [childId, turn] of this.turns) {
      if (childId !== id && turn.workspace === workspace) turn.shared = true
    }
  }

  private async check(id: string, turn: Turn): Promise<void> {
    const before = await turn.baseline
    if (!before || turn.shared) return
    const after = await folderFingerprint(this.deps.run, turn.workspace).catch(() => undefined)
    if (!after || after === before) return
    const child = this.find(id)
    if (!child) return
    log.warn(`Rôle en lecture seule (${id.slice(0, 8)}) : le dossier a changé pendant son tour`)
    this.deps.conversations.post(id, {
      type: 'notice',
      level: 'warning',
      message: { key: 'roles.notice.folderChanged' }
    })
    const motherId = child.startedFrom?.id
    if (motherId && this.find(motherId)) {
      this.deps.conversations.post(motherId, {
        type: 'notice',
        level: 'warning',
        message: { key: 'roles.notice.childFolderChanged', params: { title: child.title } }
      })
    }
  }
}
