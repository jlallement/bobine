/**
 * Connexion des serveurs MCP distants par l'agent (fiche 293, ADR-0077), côté renderer : l'état de
 * chaque serveur, relu chez l'agent par le main à l'ouverture de l'onglet, après chaque action et
 * à chaque changement de dossier ou de serveurs, puis tenu à jour par l'événement `mcp:authState`.
 * Le renderer ne lance rien et ne voit jamais l'adresse de la page : il demande au main et affiche
 * ce qu'il rend (état, hôte, raison courte).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  McpAgentView,
  McpAuthState,
  McpAuthStatus,
  McpConnectResult,
  McpDisconnectResult
} from '@shared/mcp'
import { ipcErrorText } from './ipc-errors'

/**
 * Ce qu'une action a rendu et que l'état ne dit pas (refus, déconnexion non confirmée, commande
 * copiée) : montré tant que l'état du serveur reste celui qu'il avait à ce moment-là.
 */
export interface McpAuthNote {
  /** État du serveur quand la note a été posée ; elle disparaît dès qu'il change. */
  status: McpAuthStatus | undefined
  kind: 'problem' | 'copied'
  text: string
}

export interface McpAuthModel {
  /** Commande de l'agent trouvée ; `undefined` : pas encore relu. */
  agentFound: boolean | undefined
  states: Record<string, McpAuthState>
  /** Commande à copier par serveur (« Dans un terminal »). */
  terminal: Record<string, string>
  notes: Record<string, McpAuthNote>
  /** Une connexion est en cours dans cet onglet : les autres « Se connecter » attendent. */
  busy: boolean
  /** Relecture impossible (IPC) : dite, jamais un état deviné. */
  error: string | null
  connect: (name: string) => Promise<void>
  cancel: (name: string) => Promise<void>
  reopen: (name: string) => Promise<void>
  disconnect: (name: string) => Promise<void>
  copyCommand: (name: string) => Promise<void>
}

const byName = (states: readonly McpAuthState[]) =>
  Object.fromEntries(states.map((s) => [s.name, s]))

interface Snapshot {
  /** Dossier et serveurs pour lesquels il a été lu : un autre contexte ne le montre pas. */
  context: string
  agentFound: boolean | undefined
  states: Record<string, McpAuthState>
  terminal: Record<string, string>
}

const EMPTY: Omit<Snapshot, 'context'> = { agentFound: undefined, states: {}, terminal: {} }

export function useMcpAuth(view: McpAgentView, workspace: string): McpAuthModel {
  const { t } = useTranslation()
  const enabled = !!view.oauth
  const { profileId, label: agent } = view
  // Dossier ou serveurs changés : rien de l'ancien contexte n'est montré, l'état est relu.
  const servers = view.servers.map((s) => `${s.scope}:${s.name}:${s.authPreset ?? ''}`).join('|')
  const context = `${profileId}\n${workspace}\n${servers}`
  const [snapshot, setSnapshot] = useState<Snapshot>({ context: '', ...EMPTY })
  const [notes, setNotes] = useState<Record<string, McpAuthNote & { context: string }>>({})
  const [error, setError] = useState<string | null>(null)
  // Dernière relecture demandée : une réponse plus ancienne est ignorée.
  const request = useRef(0)
  // Numéro du dernier événement reçu par serveur : une relecture partie avant lui ne l'écrase pas.
  const events = useRef(0)
  const eventOf = useRef<Record<string, number>>({})
  // Tenu à jour dès réception, avant le rendu : une note prend l'état du moment.
  const latest = useRef<Snapshot>(snapshot)
  const show = (next: Snapshot) => {
    latest.current = next
    setSnapshot(next)
  }
  // Contexte courant, lu par les actions parties d'un rendu précédent (« Connecter » ajoute le
  // serveur, puis se connecte : la liste a changé entre-temps).
  const contextRef = useRef(context)
  useLayoutEffect(() => {
    contextRef.current = context
  }, [context])
  const shown = snapshot.context === context ? snapshot : { context, ...EMPTY }
  const { states } = shown

  const refresh = useCallback(() => {
    if (!enabled) return
    const id = ++request.current
    const since = events.current
    const asked = contextRef.current
    window.api.mcp
      .authStates(profileId)
      .then((read) => {
        if (id !== request.current) return
        setError(null)
        const next = byName(read.servers)
        for (const [name, state] of Object.entries(latest.current.states)) {
          if ((eventOf.current[name] ?? 0) > since && name in next) next[name] = state
        }
        show({ context: asked, agentFound: read.agentFound, states: next, terminal: read.terminal })
      })
      .catch((e: unknown) => id === request.current && setError(ipcErrorText(e)))
  }, [enabled, profileId])

  useEffect(() => refresh(), [refresh, context])

  useEffect(() => {
    if (!enabled) return undefined
    return window.api.mcp.onAuthState((state) => {
      if (state.profileId !== profileId) return
      eventOf.current[state.name] = ++events.current
      const now = latest.current
      show({ ...now, states: { ...now.states, [state.name]: state } })
    })
  }, [enabled, profileId])

  const note = (name: string, kind: McpAuthNote['kind'], text: string) =>
    setNotes((current) => ({
      ...current,
      [name]: {
        status: latest.current.states[name]?.status,
        kind,
        text,
        context: contextRef.current
      }
    }))
  const clear = (name: string) =>
    setNotes((current) => {
      const { [name]: _gone, ...rest } = current
      return rest
    })

  /** Une action : la note précédente s'efface, l'erreur IPC est dite, l'état est relu après. */
  const act = async (name: string, action: () => Promise<void>) => {
    clear(name)
    try {
      await action()
    } catch (e) {
      note(name, 'problem', ipcErrorText(e))
    }
    refresh()
  }

  const connectRefused = (result: McpConnectResult): string | undefined => {
    if (result.started) return undefined
    switch (result.reason) {
      case 'busy':
        return t('mcp.auth.busy')
      case 'disabled':
        return t('mcp.auth.disabled')
      case 'not-offered':
        return t('mcp.auth.notOffered', { agent })
      // L'état « agent absent » arrive par l'événement et la relecture.
      case 'agent-missing':
        return undefined
    }
  }

  const disconnectFailed = (result: McpDisconnectResult): string | undefined => {
    if (result.done) return undefined
    switch (result.reason) {
      case 'busy':
        return t('mcp.auth.busy')
      case 'not-offered':
        return t('mcp.auth.notOffered', { agent })
      case 'agent-missing':
        return undefined
      case 'timeout':
        return t('mcp.auth.signOut.timeout', { agent })
      case 'failed':
        return t('mcp.auth.signOut.failed', { agent })
      case 'still-connected':
        return t('mcp.auth.signOut.stillConnected', { agent })
      case 'unconfirmed':
        return t('mcp.auth.signOut.unconfirmed')
    }
  }

  return {
    agentFound: shown.agentFound,
    states,
    terminal: shown.terminal,
    notes: Object.fromEntries(
      Object.entries(notes).filter(
        ([name, n]) => n.context === context && states[name]?.status === n.status
      )
    ),
    busy: Object.values(states).some((s) => s.status === 'connecting'),
    error,
    connect: (name) =>
      act(name, async () => {
        const refused = connectRefused(await window.api.mcp.connect(profileId, name))
        if (refused) note(name, 'problem', refused)
      }),
    cancel: (name) =>
      act(name, async () => {
        await window.api.mcp.cancelConnect(profileId, name)
      }),
    reopen: (name) =>
      act(name, async () => {
        await window.api.mcp.reopenPage(profileId, name)
      }),
    disconnect: (name) =>
      act(name, async () => {
        const failed = disconnectFailed(await window.api.mcp.disconnect(profileId, name))
        if (failed) note(name, 'problem', failed)
      }),
    copyCommand: async (name) => {
      const command = shown.terminal[name]
      if (!command) return
      clear(name)
      try {
        await navigator.clipboard.writeText(command)
        note(name, 'copied', command)
      } catch {
        note(name, 'problem', t('mcp.auth.copyFailed'))
      }
    }
  }
}
