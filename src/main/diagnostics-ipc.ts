/**
 * Canaux IPC de Réglages › Diagnostic : diagnostic de la machine et d'un agent (fiche 061),
 * niveau et fichiers du journal (fiche 080). Sortis de `ipc.ts` (fiche 181, plafond de 800
 * lignes). Les arguments viennent du renderer : vérifiés ici.
 */
import { t } from 'i18next'
import type { DiagnosticGroup } from '@shared/diagnostics'
import type { IpcHandlers } from '@shared/ipc'
import { isVerbosity, type LogStatus, type Verbosity } from '@shared/log-level'

export interface DiagnosticsIpcDeps {
  /** Diagnostic (fiche 061, injecté : commandes, versions, agents). */
  diagnostics?: {
    system: () => Promise<DiagnosticGroup[]>
    agent: (profileId: string, trySession: boolean) => Promise<DiagnosticGroup>
  }
  /** Journal (fiche 080) : niveau et fichiers. */
  log?: {
    status: () => LogStatus
    setLevel: (level: Verbosity) => LogStatus
    open: (file: 'main' | 'agents') => void
    reveal: (file: 'main' | 'agents') => void
  }
}

type DiagnosticsChannel =
  Extract<keyof IpcHandlers, `diagnostics:${string}`> | Extract<keyof IpcHandlers, `log:${string}`>

const logFile = (file: unknown): 'main' | 'agents' => {
  if (file !== 'main' && file !== 'agents') throw new Error('Paramètre invalide : file')
  return file
}

export function diagnosticsHandlers(
  deps: DiagnosticsIpcDeps
): Pick<IpcHandlers, DiagnosticsChannel> {
  const diagnostics = () => {
    if (!deps.diagnostics) throw new Error(t('ipc.unavailable.diagnostics'))
    return deps.diagnostics
  }
  const journal = () => {
    if (!deps.log) throw new Error(t('ipc.unavailable.diagnostics'))
    return deps.log
  }
  return {
    'diagnostics:system': () => diagnostics().system(),
    'diagnostics:agent': (profileId, trySession) => {
      if (typeof trySession !== 'boolean') throw new Error('Paramètre invalide : trySession')
      if (typeof profileId !== 'string' || !profileId) {
        throw new Error('Paramètre invalide : profileId')
      }
      return diagnostics().agent(profileId, trySession)
    },
    'log:status': () => journal().status(),
    'log:setLevel': (level) => {
      if (!isVerbosity(level)) throw new Error('Paramètre invalide : level')
      return journal().setLevel(level)
    },
    'log:open': (file) => {
      journal().open(logFile(file))
      return undefined
    },
    'log:reveal': (file) => {
      journal().reveal(logFile(file))
      return undefined
    }
  }
}
