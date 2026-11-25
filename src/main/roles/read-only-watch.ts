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
  /** Un écart constaté (fiche 265 : la carte du Code reviewer le dit aussi). */
  changed?: (id: string) => void
  /**
   * Groupe de conversations qui travaillent ensemble sur le même dossier (participants d'un même
   * tour de table, fiche 285) : leurs outils ne rendent pas les tours des autres « partagés ».
   */
  group?: (id: string) => string | undefined
  /** Le tour n'a pas pu être jugé (dossier partagé avec un autre écrivain, git en échec). */
  unjudged?: (id: string) => void
  /**
   * Le dossier est dans un dépôt git ; sinon, rien n'est surveillé, sans avertissement : c'est un
   * état attendu (lecture seule « non vérifiée », fiche 285). Défaut : oui.
   */
  inRepo?: (workspace: string) => boolean
}

interface Turn {
  workspace: string
  /** Empreinte de départ ; `undefined` : elle n'a pas pu être prise. */
  baseline: Promise<string | undefined>
  /** Une autre conversation du dossier a lancé un outil qui peut écrire pendant le tour. */
  shared: boolean
  /** Groupe de la conversation (`group`) : ses outils ne rendent pas « partagés » les autres. */
  group?: string
}

/** Fille en lecture seule suivie ici : un rôle de conseil, ou le Code reviewer (fiche 265). */
function watched(child: ConversationSummary | undefined): child is ConversationSummary {
  return !!child?.role?.readOnly && !!child.startedFrom
}

/** Genres d'outils ACP qui peuvent changer le dossier. */
const WRITING_KINDS: ReadonlySet<string> = new Set(['edit', 'delete', 'move', 'execute'])

export class ReadOnlyWatch {
  private readonly deps: ReadOnlyWatchDeps
  private readonly turns = new Map<string, Turn>()
  /** Empreintes prises avant l'envoi d'un message de Bobine, en attente de son tour. */
  private readonly prepared = new Map<string, { workspace: string; fingerprint?: string }>()
  /** Vérifications de fin de tour en cours, par conversation. */
  private readonly checking = new Map<string, Promise<void>>()

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
        const done = this.check(id, turn).catch((error: unknown) =>
          log.warn('Lecture seule : fin de tour non vérifiée :', messageOf(error))
        )
        this.checking.set(id, done)
        void done.finally(() => {
          if (this.checking.get(id) === done) this.checking.delete(id)
        })
      }
    }
  }

  forget(id: string): void {
    this.turns.delete(id)
    this.prepared.delete(id)
  }

  /** L'envoi préparé n'a pas eu lieu (échec) : son empreinte ne sert plus. */
  unprepare(id: string): void {
    this.prepared.delete(id)
  }

  /**
   * Avant d'envoyer un message de Bobine à une fille en lecture seule : l'empreinte de départ de
   * son prochain tour. Sans effet pour une autre conversation ; ne lève jamais.
   */
  async prepare(id: string): Promise<void> {
    const child = this.find(id)
    if (!watched(child) || !this.inRepo(child.workspace)) return
    const { workspace } = child
    const fingerprint = await folderFingerprint(this.deps.run, workspace).catch(
      (error: unknown) => {
        log.warn('Lecture seule : empreinte de départ impossible :', messageOf(error))
        return undefined
      }
    )
    this.prepared.set(id, { workspace, ...(fingerprint ? { fingerprint } : {}) })
  }

  /** Vérification de fin de tour de cette conversation finie (essais). */
  settled(id: string): Promise<void> {
    return this.checking.get(id) ?? Promise.resolve()
  }

  /** Tours suivis (essais). */
  get watching(): number {
    return this.turns.size
  }

  private inRepo(workspace: string): boolean {
    return this.deps.inRepo?.(workspace) ?? true
  }

  private find(id: string): ConversationSummary | undefined {
    try {
      return this.deps.summary(id)
    } catch {
      return undefined
    }
  }

  private turnStarted(id: string): void {
    // Un second message pendant le tour (file d'attente) ne remplace pas l'empreinte de départ.
    if (this.turns.has(id)) return
    const ready = this.prepared.get(id)
    this.prepared.delete(id)
    if (ready) {
      this.begin(id, ready.workspace, Promise.resolve(ready.fingerprint))
      return
    }
    const child = this.find(id)
    if (!watched(child) || !this.inRepo(child.workspace)) return
    const { workspace } = child
    this.begin(
      id,
      workspace,
      folderFingerprint(this.deps.run, workspace).catch((error: unknown) => {
        log.warn('Lecture seule : empreinte de départ impossible :', messageOf(error))
        return undefined
      })
    )
  }

  /**
   * Tour suivi. Chaque participant d'un groupe juge seul son propre tour (empreinte de début et de
   * fin) : un changement pendant son tour le concerne ; en dehors, il ne le concerne pas.
   */
  private begin(id: string, workspace: string, baseline: Promise<string | undefined>): void {
    const group = this.deps.group?.(id)
    this.turns.set(id, { workspace, baseline, shared: false, ...(group ? { group } : {}) })
  }

  private noteTool(id: string, update: { sessionUpdate: string; kind?: string | null }): void {
    if (this.turns.size === 0) return
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
    if (!update.kind || !WRITING_KINDS.has(update.kind)) return
    const workspace = this.find(id)?.workspace
    // Même groupe (participants d'un tour de table) : pas « partagé » ; un changement du dossier
    // sera dit à tous les tours qui se chevauchent (`check`).
    const group = this.deps.group?.(id)
    for (const [childId, turn] of this.turns) {
      const sameGroup = group !== undefined && turn.group === group
      if (childId !== id && turn.workspace === workspace && !sameGroup) turn.shared = true
    }
  }

  private async check(id: string, turn: Turn): Promise<void> {
    if (turn.shared) {
      this.deps.unjudged?.(id)
      return
    }
    const before = await turn.baseline
    const after = before
      ? await folderFingerprint(this.deps.run, turn.workspace).catch((error: unknown) => {
          log.warn('Lecture seule : empreinte de fin impossible :', messageOf(error))
          return undefined
        })
      : undefined
    const child = this.find(id)
    if (!child) return
    if (!before || !after) {
      // git en échec ou trop lent : pas de jugement, mais pas de silence non plus.
      this.deps.conversations.post(id, {
        type: 'notice',
        level: 'warning',
        message: { key: 'roles.notice.watchFailed' }
      })
      this.deps.unjudged?.(id)
      return
    }
    if (after === before) return
    log.warn(`Rôle en lecture seule (${id.slice(0, 8)}) : le dossier a changé pendant son tour`)
    this.deps.changed?.(id)
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
