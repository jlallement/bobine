/**
 * Agent lancé hors de toute conversation : essai pour le diagnostic (fiche 061), et sessions qu'il
 * garde sans que l'historique les connaisse (fiche 055). Sorti du gestionnaire des conversations
 * (fiche 089) : il ne reçoit que ce qu'il lui faut (profil, clés, PATH, dossiers connus).
 *
 * N'importe pas `electron` : testable sous Vitest contre l'agent factice.
 */
import { realpathSync } from 'node:fs'
import type { AgentSessionView, ApiKeyInfo } from '@shared/agent'
import type { EnvChanges } from '../agent-config/api-keys'
import type { AgentCheck } from '../diagnostics'
import { AgentHost } from './agent-host'
import type { AgentAnnouncement } from './capabilities'
import { isDirectory } from './process-utils'
import { findExecutable, type AgentProfile } from './profiles'
import { listAgentSessions } from './session-list'

/** Dossiers connus demandés un à un à l'agent pour « Tous les dossiers » (fiche 055). */
const MAX_LISTED_FOLDERS = 30

export interface CheckAgentOptions {
  profile: AgentProfile
  /** Dossier de la session d'essai (celui de la conversation affichée). */
  workspace: string
  pathEnv: string | undefined
  clientVersion?: string | undefined
  credentials: () => Promise<EnvChanges>
  apiKeyInfo: () => ApiKeyInfo | undefined
  onAnnounced: (announcement: AgentAnnouncement) => void
  /** Ouvrir une session même chez un agent qui ne saurait pas la supprimer (elle est fermée). */
  trySession?: boolean
}

/**
 * Essai d'un agent pour le diagnostic : démarré sans les outils de l'app. La session d'essai est
 * supprimée chez l'agent ; un agent qui ne sait pas la supprimer n'en ouvre pas, sauf `trySession`
 * (elle est alors fermée, et reste dans son historique). L'agent est toujours arrêté.
 */
export async function checkAgent(options: CheckAgentOptions): Promise<AgentCheck> {
  const { profile, workspace } = options
  const executable = findExecutable(profile.command, options.pathEnv)
  if (!executable) return { workspace }
  let announcement: AgentAnnouncement | undefined
  const host = new AgentHost({
    profile,
    workspace,
    clientVersion: options.clientVersion,
    credentials: options.credentials,
    apiKeyInfo: options.apiKeyInfo,
    onAnnounced: (seen) => {
      announcement = seen
      options.onAnnounced(seen)
    },
    ...(options.trySession ? {} : { newSession: 'if-deletable' as const }),
    emit: () => {}
  })
  try {
    await host.start()
    const snapshot = host.snapshot()
    let session: AgentCheck['session']
    if (host.currentSessionId) {
      const { delete: canDelete, close: canClose } = host.sessionSupport
      const end = canDelete
        ? host.deleteSession().then(() => 'deleted' as const)
        : canClose
          ? host.closeSession().then(() => 'closed' as const)
          : Promise.resolve('kept' as const)
      session = await end.catch(() => 'kept' as const)
    } else if (snapshot.status === 'ready') {
      session = 'skipped'
    }
    return {
      workspace,
      executable,
      ...(announcement ? { announcement } : {}),
      snapshot,
      ...(session ? { session } : {})
    }
  } finally {
    host.stop()
  }
}

export interface UnknownSessionsOptions {
  profile: AgentProfile
  /** Seulement les sessions de ce dossier ; absent : toutes. */
  only?: string | undefined
  /** Sessions déjà dans l'historique (identifiants chez cet agent) : écartées. */
  known: ReadonlySet<string>
  /** Dossiers connus de l'app (récents, conversations), demandés un à un pour « Tous ». */
  knownFolders: readonly string[]
  /** Dossier où lancer l'agent quand `only` est absent ou a disparu. */
  defaultWorkspace: string
  credentials: EnvChanges
  clientVersion?: string | undefined
}

/**
 * Sessions que l'agent garde et que l'historique ne connaît pas : celles du dossier `only`, ou
 * toutes ; sans celles dont le dossier a disparu, ni les sessions vides que le profil sait
 * reconnaître. Les plus récentes d'abord. Rien n'est ouvert chez l'agent.
 */
export async function unknownSessions(
  options: UnknownSessionsOptions
): Promise<AgentSessionView[]> {
  const { profile, only } = options
  const cwd = only && isDirectory(only) ? only : options.defaultWorkspace
  const folder = only ? realFolder(only) : undefined
  // Un agent compare le texte du chemin (`/var` est `/private/var` sur macOS) : on demande la
  // liste sans dossier et le dossier sous ses deux formes, puis l'app compare les chemins réels.
  // « Tous » : la liste sans dossier, plus les dossiers connus de l'app (OpenCode ne donne sans
  // dossier que les sessions hors dépôt git).
  const folders = only
    ? [undefined, ...new Set([only, realFolder(only)])]
    : [undefined, ...new Set(options.knownFolders.filter(isDirectory))].slice(
        0,
        MAX_LISTED_FOLDERS + 1
      )
  const sessions = await listAgentSessions({
    profile,
    cwd,
    folders,
    credentials: options.credentials,
    ...(options.clientVersion ? { clientVersion: options.clientVersion } : {})
  })
  return sessions
    .filter(
      (s) =>
        !options.known.has(s.sessionId) &&
        isDirectory(s.cwd) &&
        (!folder || realFolder(s.cwd) === folder) &&
        !(s.title && profile.emptySessionTitle?.test(s.title))
    )
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

/** Chemin réel d'un dossier (liens symboliques résolus), sinon tel quel. */
function realFolder(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}
