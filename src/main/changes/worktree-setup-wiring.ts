/**
 * Branchement de la préparation des worktrees (fiche 175) sur les conversations, hors du
 * gestionnaire : au départ d'un worktree (évènement `worktree-start`), la préparation commence ;
 * un message envoyé pendant ce temps est retenu (`promptGate`, chaîné à celui du plafond de coût)
 * puis envoyé à la fin, avec la ligne de contexte d'un échec ; dans une conversation lancée par
 * l'utilisateur, il attend aussi l'accord (ou « Continuer sans préparer »), et la carte dit qu'un
 * message attend (« Arrêter », « Continuer sans attendre » pendant la commande). Une tâche
 * planifiée n'attend jamais d'accord. L'état va dans le fil par `post`.
 */
import type { PromptAttachment } from '@shared/attachments'
import type { PromptOptions } from '../agent/agent-host'
import type { ConversationManager } from '../conversations/manager'
import { joinContext } from '../conversations/helpers'
import { log } from '../log'
import type { Run } from '../simulator/run'
import { WorktreePreparation, type SetupApprovals } from './worktree-setup'
import { Worktrees } from './worktrees'

type Host = Pick<ConversationManager, 'subscribe' | 'post' | 'prompt' | 'worktreeOf' | 'view'> & {
  promptGate?: ConversationManager['promptGate']
}

/** Worktrees de l'app et leur préparation, la commande `archive` avant chaque suppression. */
export function preparedWorktrees(
  run: Run,
  approvals: SetupApprovals
): { worktrees: Worktrees; preparation: WorktreePreparation } {
  const worktrees = new Worktrees(run)
  const preparation = new WorktreePreparation({ run, approvals, env: () => process.env, log })
  worktrees.beforeRemove = (info) => preparation.beforeRemove(info)
  return { worktrees, preparation }
}

/** Ce que l'IPC appelle depuis la carte « Préparation du worktree ». */
export interface WorktreeSetupControl {
  /** « Autoriser » : l'empreinte des commandes montrées (canal `conversation:approveWorktreeSetup`). */
  approve: (id: string, signature: string) => void
  /**
   * « Continuer sans préparer » (commande à autoriser) ou « Continuer sans attendre » (commande en
   * cours) : canal `conversation:skipWorktreeSetup`.
   */
  skip: (id: string) => void
  /** « Arrêter » la commande en cours (canal `conversation:stopWorktreeSetup`). */
  stop: (id: string) => void
}

interface Held {
  text: string
  attachments: PromptAttachment[]
  options: PromptOptions
}

type Preparation = Pick<
  WorktreePreparation,
  | 'start'
  | 'awaiting'
  | 'hold'
  | 'takeContext'
  | 'approve'
  | 'skip'
  | 'stop'
  | 'proceed'
  | 'dispose'
>

/**
 * Suit les conversations : préparation au départ d'un worktree, messages retenus pendant qu'elle
 * tourne ou attend l'accord, la carte le disant. À appeler après la pose des autres gardes d'envoi
 * (plafond de coût), qu'elle enchaîne.
 */
export function connectWorktreePreparation(
  conversations: Host,
  preparation: Preparation
): WorktreeSetupControl {
  const post =
    (id: string) => (setup: Parameters<Parameters<WorktreePreparation['start']>[2]>[0]) => {
      try {
        conversations.post(id, { type: 'worktree-setup', setup })
      } catch {
        // Conversation supprimée entre-temps : plus de fil où l'écrire.
      }
    }
  conversations.subscribe({
    event: ({ conversationId, event }) => {
      if (event.type !== 'worktree-start') return
      const target = conversations.worktreeOf(conversationId)
      if (target) preparation.start(conversationId, target.worktree, post(conversationId))
    }
  })
  const resend = (id: string, m: Held) =>
    conversations.prompt(id, m.text, m.attachments, m.options).catch((error: unknown) => {
      log.warn('Message retenu pendant la préparation du worktree, envoi impossible :', error)
      try {
        conversations.post(id, { type: 'notice', level: 'error', message: String(error) })
      } catch {
        // Conversation supprimée.
      }
    })
  // Messages retenus (préparation en cours, ou commande à autoriser), dits sur la carte.
  const held = new Map<string, Held[]>()
  // Fin de préparation déjà suivie, pour ne pas renvoyer deux fois les mêmes messages.
  const watched = new WeakSet<Promise<unknown>>()
  /** Renvoie les messages retenus : ils repassent par la garde (contexte, ou de nouveau retenus). */
  const release = (id: string, context?: string) => {
    const messages = held.get(id) ?? []
    held.delete(id)
    messages.forEach((m, i) => {
      const first = i === 0 && context
      void resend(
        id,
        first
          ? { ...m, options: { ...m.options, context: joinContext(context, m.options.context) } }
          : m
      )
    })
  }
  const keep = (id: string, message: Held, done?: Promise<unknown>) => {
    const list = [...(held.get(id) ?? []), message]
    held.set(id, list)
    // Pas encore de carte (la copie commence) : une ligne le dit, une seule fois.
    if (!preparation.hold(id, list.length) && list.length === 1) {
      conversations.post(id, {
        type: 'notice',
        level: 'info',
        message: { key: 'worktreeSetup.waiting' }
      })
    }
    if (done && !watched.has(done)) {
      watched.add(done)
      void done.then(() => release(id))
    }
  }
  const summary = (id: string) => conversations.view(id).summary
  // Personne n'est là pour donner l'accord : une fille (son agent est prévenu), une tâche planifiée
  // (elle part sans la préparation, et son historique le dit).
  const isChild = (id: string) => !!summary(id).startedFrom
  const isUnattended = (id: string) => !!summary(id).scheduled
  const previous = conversations.promptGate
  conversations.promptGate = (id, text, attachments = [], options = {}) => {
    const awaiting = preparation.awaiting(id)
    const message = { text, attachments, options }
    if (awaiting && !awaiting.finished) {
      keep(id, message, awaiting.done)
      return true
    }
    const setup = awaiting?.setup
    // `archive` seule à autoriser : rien ne tourne à la création, le message part.
    if (setup?.state === 'approval' && setup.command) {
      if (isUnattended(id)) preparation.skip(id, true)
      else if (!isChild(id)) {
        keep(id, message)
        return true
      }
    }
    const context = awaiting ? preparation.takeContext(id) : undefined
    if (context) {
      void resend(id, {
        ...message,
        options: { ...options, context: joinContext(context, options.context) }
      })
      return true
    }
    return previous?.(id, text, attachments, options) ?? false
  }
  // Départ de l'app : les commandes en cours sont arrêtées avec elle.
  process.once('exit', () => preparation.dispose())
  return {
    approve: (id, signature) => {
      const target = conversations.worktreeOf(id)
      if (!target) return
      // Lancée : les messages retenus partent à sa fin (avec l'échec s'il y en a un). Fichier
      // changé : ils attendent le nouvel accord.
      void preparation
        .approve(id, target.worktree, signature)
        .then((result) => {
          if (result === 'approved') release(id)
        })
        .catch((error: unknown) => log.warn('Accord de la préparation du worktree :', error))
    },
    skip: (id) => {
      if (preparation.skip(id)) return release(id)
      const context = preparation.proceed(id)
      if (context !== undefined) release(id, context || undefined)
    },
    stop: (id) => {
      // La fin de la commande (arrêtée) libère les messages retenus.
      preparation.stop(id)
    }
  }
}
