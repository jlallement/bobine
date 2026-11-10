/**
 * Panneau latéral à onglets (fiche 029) : la session en un coup d'œil (fiche 166), ce que l'agent
 * fait avec les outils de l'app (navigateur, simulateur, terminal…), sa liste de tâches et ses
 * échanges ACP.
 */
import { t } from 'i18next'
export type PanelTab =
  | 'session'
  | 'browser'
  | 'simulator'
  | 'android'
  | 'terminal'
  | 'tasks'
  | 'acp'
  | 'changes'
  | 'document'

export const PANEL_TABS: { id: PanelTab; label: string }[] = [
  // Résumé de la session courante (fiche 166) : toujours en tête, sauf fermé à la main.
  {
    id: 'session',
    get label() {
      return t('panel.tab.session')
    }
  },
  {
    id: 'browser',
    get label() {
      return t('panel.tab.browser')
    }
  },
  {
    id: 'simulator',
    get label() {
      return t('panel.tab.simulator')
    }
  },
  {
    id: 'android',
    get label() {
      return t('panel.tab.android')
    }
  },
  {
    id: 'terminal',
    get label() {
      return t('panel.tab.terminal')
    }
  },
  {
    id: 'tasks',
    get label() {
      return t('panel.tab.tasks')
    }
  },
  // Échanges ACP bruts de la conversation (fiche 135), seulement ouvert par le menu « + ».
  {
    id: 'acp',
    get label() {
      return t('panel.tab.acp')
    }
  },
  {
    id: 'changes',
    get label() {
      return t('panel.tab.changes')
    }
  },
  // Aperçu d'un document Markdown cité dans la conversation (fiche 052), seulement s'il y en a un.
  {
    id: 'document',
    get label() {
      return t('panel.tab.document')
    }
  }
]

export const isPanelTab = (value: unknown): value is PanelTab =>
  PANEL_TABS.some((tab) => tab.id === value)
