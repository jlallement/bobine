import { GitPullRequest } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSettingsView, AgentSnapshot, ControlValue } from '@shared/agent'
import { changesSummary } from '@shared/changes'
import { contextBreakdown, type McpMeasure } from '@shared/context-breakdown'
import { ipcErrorText } from '../../ipc-errors'
import type { McpAgentView } from '@shared/mcp'
import type { TranscriptState } from '@shared/transcript'
import { composerView } from '../../composer-view'
import { mcpKey, mcpStatus, testMcpServers, useMcpStatuses } from '../../mcp-status'
import { platformFeatures } from '../../platform-features'
import type { RunningEntry, RunningState } from '../../session-running'
import { Tip } from '../common/Menus'
import { SessionChanges } from './SessionChanges'
import { SessionContext } from './SessionContext'
import { SessionEnvironment } from './SessionEnvironment'
import { SessionFolders } from './SessionFolders'
import { SessionRunning } from './SessionRunning'
import { checksLine } from './PrCard'
import { usePrTrack } from '../../usePrTrack'
import '../../session-tab.css'

/** Ce que l'onglet « Session » montre de la conversation active (fiche 166), fourni par `App`. */
export interface SessionTabData {
  snapshot: AgentSnapshot | null
  settings: AgentSettingsView | null
  transcript: TranscriptState
  workspace?: string | undefined
  /** Branche du worktree de la conversation (fiche 036). */
  worktreeBranch?: string | undefined
  /** Branche git du dossier (fiche 049). */
  gitBranch?: string | undefined
  running: RunningState
  onSetControl: (id: string, value: ControlValue) => void
  onRevealWorkspace: () => void
  /** Autres dossiers de la conversation (fiche 179). */
  additionalDirectories?: readonly string[] | undefined
  /** Affiche un autre dossier dans le Finder. */
  onRevealFolder: (folder: string) => void
  /** Échec d'un ajout ou d'un retrait (agent qui répond…), montré comme les autres avertissements. */
  onWarn: (message: string) => void
  /** Onglet Modifications, vue git. */
  onOpenGit: () => void
  /** Onglet Modifications, vue de la conversation (fiche 207). */
  onOpenConversationChanges: () => void
  onOpenConversation: (id: string) => void
  /** Serveurs MCP de l'agent de la conversation (fiche 060). */
  onLoadMcp: () => Promise<McpAgentView | undefined>
  /** Réglages › Mémoire, depuis la ligne « Mémoire » du contexte (fiche 182). */
  onOpenMemory?: () => void
}

/** Outils terminés : de quoi relire ce qui a pu changer (dépôt, outils reçus). */
const finishedTools = (transcript: TranscriptState) =>
  transcript.items.filter((i) => i.kind === 'tool' && i.status === 'completed').length

/** Poids des outils de Bobine que reçoit la conversation (fiche 109) ; relu au changement d'état. */
function useAppToolsTokens(conversationId: string, status: string | undefined): number | undefined {
  const [loaded, setLoaded] = useState<{ id: string; tokens: number } | null>(null)
  useEffect(() => {
    let alive = true
    window.api.conversations
      .appTools(conversationId)
      .then((tools) => alive && setLoaded({ id: conversationId, tokens: tools.tokens }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversationId, status])
  return loaded?.id === conversationId ? loaded.tokens : undefined
}

/**
 * Poids des définitions des autres serveurs MCP (fiche 060) : seulement ce que le cache de
 * « Tester » connaît déjà, même ancien. L'onglet ne lance jamais un serveur de lui-même (décision
 * de l'utilisateur, fiche 166) : `measure` le fait, sur demande.
 */
export function useMcpTokens(
  load: () => Promise<McpAgentView | undefined>,
  profileId: string | undefined
): { line?: McpMeasure & { tokens: number }; measure: () => void } {
  const [view, setView] = useState<McpAgentView | null>(null)
  useMcpStatuses()
  useEffect(() => {
    let alive = true
    load()
      .then((loaded) => alive && setView(loaded ?? null))
      .catch(() => alive && setView(null))
    return () => {
      alive = false
    }
    // `load` change à chaque rendu de l'app : relu quand l'agent change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relu par agent, pas par rendu
  }, [profileId])
  const servers = view?.servers.filter((server) => server.enabled) ?? []
  const measure = () => {
    if (view) void testMcpServers(view.profileId, view.servers, false)
  }
  if (!view || servers.length === 0) return { measure }
  let tokens = 0
  let measured = 0
  let testing = false
  for (const server of servers) {
    const status = mcpStatus(mcpKey(view.profileId, server))
    if (status === 'testing') testing = true
    else if (status?.ok) {
      measured++
      tokens += status.toolTokens ?? 0
    }
  }
  return { line: { servers: servers.length, measured, tokens, testing }, measure }
}

/**
 * Modifications non commitées du dossier (« +N −M »), comme l'onglet Modifications › Git ;
 * `undefined` hors dépôt git (ou pas encore lu).
 */
function useGitChanges(conversationId: string, finished: number) {
  const [loaded, setLoaded] = useState<{
    id: string
    summary: ReturnType<typeof changesSummary> | null
  } | null>(null)
  useEffect(() => {
    let alive = true
    window.api.changes
      .git(conversationId)
      .then(
        (git) =>
          alive &&
          setLoaded({ id: conversationId, summary: git ? changesSummary(git.files) : null })
      )
      // Pas de dépôt, ou git refusé : pas de ligne.
      .catch(() => alive && setLoaded({ id: conversationId, summary: null }))
    return () => {
      alive = false
    }
  }, [conversationId, finished])
  return (loaded?.id === conversationId ? loaded.summary : null) ?? undefined
}

/**
 * Onglet « Session » (fiche 166) : la session courante d'un coup d'œil — environnement, place
 * occupée dans le contexte (jamais d'argent, fiche 113), modifications, ce qui tourne.
 */
export function SessionTab({
  conversationId,
  data
}: {
  conversationId: string
  data: SessionTabData
}) {
  const { t } = useTranslation()
  const view = composerView(data.snapshot, data.settings)
  const finished = finishedTools(data.transcript)
  const appTools = useAppToolsTokens(conversationId, data.snapshot?.status)
  const { line: mcp, measure: measureMcp } = useMcpTokens(
    data.onLoadMcp,
    data.snapshot?.info.profileId
  )
  const changes = useGitChanges(conversationId, finished)
  const pr = usePrTrack(conversationId, finished)
  const { items, terminals, usage, memoryTokens: memory } = data.transcript
  const breakdown = useMemo(
    () => contextBreakdown({ items, terminals, usage, appTools, mcp, memory }),
    [items, terminals, usage, appTools, mcp, memory]
  )
  const warn = (error: unknown) => data.onWarn(ipcErrorText(error))
  const stop = (entry: RunningEntry) => {
    const how = entry.stop
    if (!how) return
    const done =
      how.kind === 'terminal'
        ? window.api.terminal.stop(conversationId, how.tabId)
        : how.kind === 'server'
          ? window.api.preview.stop(conversationId, how.name)
          : window.api.agent.cancel(how.childId)
    void done.catch(() => {})
  }
  return (
    <div className="session-tab" data-testid="session-tab">
      <SessionEnvironment
        agentLabel={view.agentLabel}
        modelControl={view.modelControl}
        modeControl={view.modeControl}
        canSet={view.status === 'ready'}
        onSetControl={data.onSetControl}
        workspace={data.workspace}
        onRevealWorkspace={data.onRevealWorkspace}
        worktreeBranch={data.worktreeBranch}
        gitBranch={data.gitBranch}
        onOpenGit={data.onOpenGit}
        finder={platformFeatures().finder}
        folders={
          <SessionFolders
            folders={data.additionalDirectories ?? []}
            supported={!!data.snapshot?.additionalDirectories}
            busy={view.status === 'busy'}
            agentLabel={view.agentLabel}
            finder={platformFeatures().finder}
            onAdd={() => void window.api.conversations.addFolder(conversationId).catch(warn)}
            onRemove={(folder) =>
              void window.api.conversations.removeFolder(conversationId, folder).catch(warn)
            }
            onReveal={data.onRevealFolder}
          />
        }
      />
      <SessionContext
        breakdown={breakdown}
        agentLabel={view.agentLabel}
        onMeasureMcp={measureMcp}
        {...(data.onOpenMemory ? { onOpenMemory: data.onOpenMemory } : {})}
      />
      <SessionChanges
        items={items}
        folder={changes}
        onOpenConversation={data.onOpenConversationChanges}
        onOpenGit={data.onOpenGit}
      />
      {pr?.status === 'found' && (
        <section className="session-section" data-testid="session-pr">
          <h3 className="session-title">{t('sessionTab.pr')}</h3>
          <Tip label={t('sessionTab.prTip')}>
            <button
              type="button"
              className="session-link session-changes"
              onClick={data.onOpenGit}
              data-testid="session-pr-line"
            >
              <GitPullRequest size={13} />
              {`#${pr.pr.number} · ${
                pr.pr.state === 'open'
                  ? checksLine(pr.pr.checks, t, pr.ci)
                  : t(`prTrack.state.${pr.pr.state}`)
              }`}
            </button>
          </Tip>
        </section>
      )}
      <SessionRunning running={data.running} onStop={stop} onOpenChild={data.onOpenConversation} />
    </div>
  )
}
