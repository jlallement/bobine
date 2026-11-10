/**
 * Conversations qui attendent l'utilisateur (fiche 024) : une demande en cours (autorisation,
 * question, connexion) ou une réponse finie qu'il n'a pas encore vue. Sert aux notifications
 * macOS et au rebond du Dock (seulement quand la fenêtre n'a pas le focus), à la section « À
 * traiter » et au compteur du Dock (fiche 119), aux pastilles de la barre latérale. Logique pure :
 * l'affichage est injecté.
 */
import type { AgentEvent, ElicitationPrompt } from '@shared/agent'
import { questionsOf } from '@shared/questions'
import type {
  AttentionDetail,
  AttentionDetails,
  AttentionKind,
  AttentionReason,
  AttentionState
} from '@shared/attention'
import { reasonKind } from '@shared/attention'
import { toolInputOf, toolText } from '@shared/tool-label'
import { t } from 'i18next'
import type { BounceKind } from './dock-bounce'
import { NoticeGroups, type AttentionNotice, type NoticeGroupsOptions } from './grouping'

export type { AttentionNotice } from './grouping'

export interface AttentionOptions {
  /** La fenêtre de l'app a le focus. */
  isFocused: () => boolean
  /** Conversations affichées (l'active, et celle ouverte à côté). */
  shownIds: () => string[]
  /**
   * Titre de la conversation, nom de son agent, si c'est une fille (texte des notifications), et
   * son dossier (chemins relatifs dans le libellé d'un outil, fiche 125).
   */
  describe: (
    conversationId: string
  ) => { title: string; agent: string; child?: boolean; workspace?: string } | undefined
  /** Notifications activées (réglage). */
  enabled: () => boolean
  notify: (notice: AttentionNotice) => void
  /** Retire les notifications d'une conversation (vue entre-temps). */
  withdraw: (conversationId: string) => void
  /** Son : une conversation attend une action, fenêtre sans focus (fiche 068). */
  chime?: () => void
  /** Rebond du Dock, aux mêmes moments qu'une notification (fiche 101). */
  bounce?: (kind: BounceKind) => void
  /** Retour dans la fenêtre : le rebond s'arrête. */
  stopBounce?: () => void
  /**
   * Bannières groupées par fenêtre de quelques secondes (fiche 119) : planification des fins de
   * fenêtre. Absent : chaque bannière part tout de suite.
   */
  groups?: Pick<NoticeGroupsOptions, 'schedule' | 'windowMs'>
  /** Horloge (début des attentes). */
  now?: () => number
  /** Nouvel état et ce qu'attend chaque conversation, pour la barre latérale et le compteur. */
  emit: (state: AttentionState, details: AttentionDetails) => void
}

/** Longueur maximale de l'extrait de réponse dans une notification. */
const EXCERPT = 160

interface Wait {
  reason: AttentionReason
  detail?: string
  since: number
}

interface Entry {
  /** Demandes d'autorisation ou d'information en cours, dans leur ordre d'arrivée. */
  requests: Map<string, Wait>
  /** Session bloquée (connexion SSO, dossier à approuver). */
  blocked?: Wait
  /** Réponse finie (ou en erreur) pas encore vue. */
  unseen?: Wait
  /** Texte de la réponse en cours, pour l'extrait de la notification de fin. */
  reply: string
}

export class AttentionTracker {
  private readonly entries = new Map<string, Entry>()
  private readonly options: AttentionOptions
  private readonly groups: NoticeGroups | undefined
  private readonly now: () => number

  constructor(options: AttentionOptions) {
    this.options = options
    this.now = options.now ?? Date.now
    this.groups =
      options.groups &&
      new NoticeGroups({
        show: (notice) => options.notify(notice),
        schedule: options.groups.schedule,
        ...(options.groups.windowMs !== undefined ? { windowMs: options.groups.windowMs } : {})
      })
  }

  state(): AttentionState {
    const state: AttentionState = {}
    for (const [id, entry] of this.entries) {
      const kind = kindOf(entry)
      if (kind) state[id] = kind
    }
    return state
  }

  /** Ce qu'attend chaque conversation (fiche 119) : la demande la plus ancienne d'abord. */
  details(): AttentionDetails {
    const details: AttentionDetails = {}
    for (const [id, entry] of this.entries) {
      const wait = waitOf(entry)
      if (wait) details[id] = wait
    }
    return details
  }

  onEvent(conversationId: string, event: AgentEvent): void {
    const entry = this.entry(conversationId)
    const before = signature(entry)
    switch (event.type) {
      case 'user-message':
        entry.reply = ''
        entry.unseen = undefined
        break
      case 'update': {
        const update = event.update
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          entry.reply = (entry.reply + update.content.text).slice(-4000)
        }
        break
      }
      case 'permission-request': {
        // Le même libellé que la carte (fiche 125) : pas le titre brut de l'agent.
        const { title, kind, locations, rawInput, content } = event.toolCall
        const input = toolInputOf(rawInput)
        const tool = title
          ? toolText(
              {
                title,
                ...(kind ? { toolKind: kind } : {}),
                locations: locations ?? [],
                ...(input ? { input } : {}),
                ...(content ? { content } : {})
              },
              this.options.describe(conversationId)?.workspace
            )
          : undefined
        entry.requests.set(event.requestId, this.wait('permission', tool))
        this.alert(
          conversationId,
          'permission',
          t('notifications.permission', { tool: tool ?? t('notifications.tool') })
        )
        break
      }
      case 'elicitation-request':
        entry.requests.set(event.requestId, this.wait('question', questionText(event.prompt)))
        this.alert(
          conversationId,
          'question',
          t('notifications.question', { question: oneLine(event.prompt.message) })
        )
        break
      case 'permission-resolved':
      case 'elicitation-resolved':
        entry.requests.delete(event.requestId)
        break
      // Fenêtre « Enregistrer sous », boîte d'une page : l'app attend l'utilisateur (fiche 097).
      case 'waiting-user':
        if (!event.waiting) entry.requests.delete(event.key)
        else {
          entry.requests.set(event.key, this.wait(event.reason))
          this.alert(
            conversationId,
            event.reason,
            t(event.reason === 'save' ? 'notifications.saveDialog' : 'notifications.pageDialog')
          )
        }
        break
      case 'status': {
        const blocker =
          event.snapshot.status === 'needs-action' ? event.snapshot.blocker : undefined
        if (blocker && !entry.blocked) {
          const reason = blocker.kind === 'auth' ? 'auth' : 'trust'
          entry.blocked = this.wait(reason)
          this.alert(conversationId, reason, t(`notifications.${reason}`))
        } else if (!blocker) entry.blocked = undefined
        break
      }
      case 'turn-end':
        // Interrompu par l'utilisateur : il le sait déjà.
        if (event.stopReason !== 'cancelled' && !this.inView(conversationId)) {
          entry.unseen = this.wait('done')
          this.alert(conversationId, 'done', excerpt(entry.reply) || t('notifications.done'))
        }
        entry.reply = ''
        break
      case 'turn-error':
        if (!this.inView(conversationId)) {
          entry.unseen = this.wait('error')
          this.alert(
            conversationId,
            'error',
            t('notifications.error', { message: oneLine(event.message) })
          )
        }
        entry.reply = ''
        break
      default:
        return
    }
    if (signature(entry) !== before) this.changed()
  }

  /** Focus de la fenêtre ou conversation affichée changés : ce qui est sous les yeux est vu. */
  refresh(): void {
    if (!this.options.isFocused()) return
    this.options.stopBounce?.()
    let changed = false
    for (const id of this.options.shownIds()) {
      this.groups?.withdraw(id)
      this.options.withdraw(id)
      const entry = this.entries.get(id)
      if (entry?.unseen) {
        entry.unseen = undefined
        changed = true
      }
    }
    if (changed) this.changed()
  }

  /** Réglage changé : le compteur suit. */
  settingsChanged(): void {
    this.changed()
  }

  /** Conversation supprimée. */
  forget(conversationId: string): void {
    this.groups?.withdraw(conversationId)
    this.options.withdraw(conversationId)
    if (this.entries.delete(conversationId)) this.changed()
  }

  /** Arrêt de l'app : plus de bannière en attente. */
  dispose(): void {
    this.groups?.dispose()
  }

  private wait(reason: AttentionReason, detail?: string): Wait {
    return { reason, ...(detail ? { detail } : {}), since: this.now() }
  }

  private inView(conversationId: string): boolean {
    return this.options.isFocused() && this.options.shownIds().includes(conversationId)
  }

  private alert(conversationId: string, reason: AttentionReason, body: string): void {
    if (this.options.isFocused()) return
    const kind = reasonKind(reason)
    // Plusieurs conversations dans la même fenêtre (fiche 119) : un seul son, un seul rebond.
    const first = this.groups ? this.groups.open(kind) : true
    // Son seulement quand une action est attendue, réglé à part des notifications (fiche 068).
    if (kind === 'request' && first) this.options.chime?.()
    if (!this.options.enabled()) return
    // Rebond coupé avec les notifications ; jusqu'au retour quand rien n'avance sans l'utilisateur.
    if (first) this.options.bounce?.(kind === 'request' ? 'critical' : 'informational')
    const about = this.options.describe(conversationId)
    const notice: AttentionNotice = {
      conversationId,
      kind,
      reason,
      conversationTitle: about?.title ?? 'Bobine',
      ...(about?.child ? { child: true } : {}),
      title: about ? `${about.agent} · ${about.title}` : 'Bobine',
      body
    }
    if (this.groups) this.groups.push(notice)
    else this.options.notify(notice)
  }

  private changed(): void {
    this.options.emit(this.state(), this.details())
  }

  private entry(conversationId: string): Entry {
    let entry = this.entries.get(conversationId)
    if (!entry) {
      entry = { requests: new Map(), reply: '' }
      this.entries.set(conversationId, entry)
    }
    return entry
  }
}

/** Ce qu'attend la conversation : la demande la plus ancienne, sinon la réponse à lire. */
function waitOf(entry: Entry): AttentionDetail | undefined {
  const requests = [...entry.requests.values(), ...(entry.blocked ? [entry.blocked] : [])]
  if (requests.length) return requests.reduce((a, b) => (b.since < a.since ? b : a))
  return entry.unseen
}

/** État et raison : un changement de l'un ou de l'autre est envoyé. */
function signature(entry: Entry): string {
  const wait = waitOf(entry)
  return wait ? `${kindOf(entry)}:${wait.reason}:${wait.since}:${wait.detail ?? ''}` : ''
}

/** Une demande passe avant une réponse à lire. */
function kindOf(entry: Entry): AttentionKind | undefined {
  if (entry.requests.size || entry.blocked) return 'request'
  return entry.unseen?.reason === 'error' ? 'error' : entry.unseen ? 'done' : undefined
}

/**
 * Texte de la question pour « À traiter » (fiche 119) : celui de la première question d'un
 * questionnaire (le message d'un `AskUserQuestion` ne dit que « Questions »), sinon le message.
 */
function questionText(prompt: ElicitationPrompt): string {
  const first = prompt.mode === 'form' ? questionsOf(prompt.schema, prompt.message)?.[0] : undefined
  return oneLine(first?.text ?? prompt.message)
}

function oneLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > EXCERPT ? `${line.slice(0, EXCERPT - 1)}…` : line
}

/** Fin de la réponse, sans la mise en forme Markdown la plus visible. */
export function excerpt(reply: string): string {
  const plain = reply
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>]+/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > EXCERPT ? `…${plain.slice(-(EXCERPT - 1)).trimStart()}` : plain
}
