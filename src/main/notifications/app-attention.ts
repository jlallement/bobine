/**
 * Conversations qui attendent l'utilisateur, branchées à l'app (sorti de `index.ts`, qui reste
 * sous son plafond de lignes, fiche 089) : notifications (fiche 024), son quand un agent attend
 * (fiche 068), rebond du Dock (fiche 101) et compteur « À traiter » du Dock (fiche 119) ; ni
 * bannière, ni son, ni rebond, ni compteur en mode présentation (fiche 159).
 */
import type { AttentionDetails, AttentionState } from '@shared/attention'
import { inboxCount } from '@shared/inbox'
import type { ConversationManager } from '../conversations/manager'
import type { Presentation } from '../presentation'
import type { SettingsStore } from '../settings-store'
import { AttentionTracker } from './attention'
import { systemAlerts } from './system-alerts'
import type { SystemNotifier } from './system-notifier'

export interface AppAttentionDeps {
  settings: Pick<SettingsStore, 'preferences' | 'notificationsEnabled'>
  presentation: Pick<Presentation, 'active' | 'onChange'>
  conversations: Pick<ConversationManager, 'state' | 'shownIds'>
  notifier: Pick<SystemNotifier, 'notify' | 'withdraw'>
  /** La fenêtre principale a le focus (la fenêtre rapide n'affiche pas de conversation). */
  isFocused: () => boolean
  /** Capacité `dockBadge` de la plateforme (fiche 145). */
  dockBadge: boolean
  /** Nouvel état, vers les fenêtres. */
  emit: (state: AttentionState, details: AttentionDetails) => void
}

export function appAttention(deps: AppAttentionDeps) {
  const { settings, presentation, conversations } = deps
  const alerts = systemAlerts(
    () => settings.preferences(),
    // Bannières et compteur coupés en mode présentation (fiche 159).
    () => settings.notificationsEnabled() && !presentation.active,
    deps.dockBadge
  )
  // Compteur « À traiter » du Dock (fiche 119) : la règle de la barre latérale, comptée ici.
  const updateBadge = () =>
    alerts.badge.update(
      inboxCount(conversations.state().conversations, attention.state(), attention.details())
    )
  presentation.onChange(() => updateBadge())
  const attention = new AttentionTracker({
    isFocused: deps.isFocused,
    shownIds: () => conversations.shownIds(),
    describe: (id) => {
      const summary = conversations.state().conversations.find((c) => c.id === id)
      return (
        summary && {
          title: summary.title,
          agent: summary.profileLabel,
          child: !!summary.startedFrom,
          workspace: summary.workspace
        }
      )
    },
    enabled: () => settings.notificationsEnabled() && !presentation.active,
    notify: (notice) => deps.notifier.notify(notice),
    withdraw: (id) => deps.notifier.withdraw(id),
    ...alerts.attention,
    // Ni son ni rebond du Dock en mode présentation (fiche 159).
    chime: () => !presentation.active && alerts.attention.chime?.(),
    bounce: (kind) => !presentation.active && alerts.attention.bounce?.(kind),
    emit: (state, details) => {
      deps.emit(state, details)
      updateBadge()
    }
  })
  return { attention, alerts, updateBadge }
}
