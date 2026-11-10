/**
 * Canaux IPC de la préparation des worktrees (fiche 175) : « Autoriser et lancer », « Continuer
 * sans préparer » (ou « sans attendre »), « Arrêter », et l'accord d'un dépôt retiré dans
 * Réglages › Confidentialité.
 */
import type { AgentSettingsView } from '@shared/agent'
import type { IpcHandlers } from '@shared/ipc'
import { t } from 'i18next'
import type { WorktreeSetupControl } from './worktree-setup-wiring'

export type { WorktreeSetupControl }

type Channel =
  | 'conversation:approveWorktreeSetup'
  | 'conversation:skipWorktreeSetup'
  | 'conversation:stopWorktreeSetup'
  | 'settings:forgetWorktreeSetup'

export interface WorktreeSetupIpcDeps {
  control: WorktreeSetupControl | undefined
  /** L'accord gardé (`ApprovalStore.forgetWorktreeSetup`) ; erreur si indisponible. */
  forget: (root: string) => void
  settingsView: () => AgentSettingsView
}

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function worktreeSetupHandlers(deps: WorktreeSetupIpcDeps): Pick<IpcHandlers, Channel> {
  const control = () => {
    if (!deps.control) throw new Error(t('conversations.error.noWorktrees'))
    return deps.control
  }
  return {
    'conversation:approveWorktreeSetup': (id, signature) => {
      control().approve(str(id, 'id'), str(signature, 'signature'))
      return undefined
    },
    'conversation:skipWorktreeSetup': (id) => {
      control().skip(str(id, 'id'))
      return undefined
    },
    'conversation:stopWorktreeSetup': (id) => {
      control().stop(str(id, 'id'))
      return undefined
    },
    'settings:forgetWorktreeSetup': (root) => {
      deps.forget(str(root, 'root'))
      return deps.settingsView()
    }
  }
}
