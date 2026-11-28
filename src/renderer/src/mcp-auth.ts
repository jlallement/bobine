/**
 * Connexion des serveurs MCP distants par l'agent (fiche 293, ADR-0077), côté renderer : l'état de
 * chaque serveur, relu chez l'agent par le main à l'ouverture de l'onglet, après chaque action et
 * à chaque changement de dossier ou de serveurs, puis tenu à jour par l'événement `mcp:authState`.
 * Le renderer ne lance rien et ne voit jamais l'adresse de la page : il demande au main et affiche
 * ce qu'il rend (état, hôte, raison courte).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
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
  /** Le focus est-il à rendre à la ligne de ce serveur (une action partie d'elle) ? */
  focusPending: (name: string) => boolean
  focusDone: (name: string) => void
}

const byName = (states: readonly McpAuthState[]) =>
  Object.fromEntries(states.map((s) => [s.name, s]))

/* ---------- Magasin partagé (Réglages › Serveurs MCP, menu « Réglages de la session ») ---------- */

/** Dernier état connu des serveurs d'un agent : relu chez lui, puis tenu par `mcp:authState`. */
export interface McpAuthEntry {
  /** Commande de l'agent trouvée ; `undefined` : pas encore relu. */
  agentFound: boolean | undefined
  states: Record<string, McpAuthState>
  terminal: Record<string, string>
}

const entries = new Map<string, McpAuthEntry>()
const listeners = new Set<() => void>()
let version = 0
let unsubscribe: (() => void) | undefined
/** Numéro du dernier événement par serveur : une relecture partie avant lui ne l'écrase pas. */
let events = 0
const eventOf = new Map<string, number>()
/** Dernière relecture demandée par agent : une réponse plus ancienne ne range rien. */
let requests = 0
/** Dernière relecture partie par agent (gardée : une plus ancienne qui finit après lui cède). */
const pending = new Map<string, { id: number; promise: Promise<McpAuthEntry> }>()

const keyOf = (profileId: string, name: string) => `${profileId}\u0000${name}`

function changed(): void {
  version++
  for (const listener of listeners) listener()
}

/** Écoute de `mcp:authState`, une seule pour toute la fenêtre, posée au premier abonné. */
function listen(): void {
  if (unsubscribe) return
  unsubscribe = window.api.mcp.onAuthState((state) => {
    eventOf.set(keyOf(state.profileId, state.name), ++events)
    const entry = entries.get(state.profileId) ?? {
      agentFound: undefined,
      states: {},
      terminal: {}
    }
    entries.set(state.profileId, { ...entry, states: { ...entry.states, [state.name]: state } })
    changed()
  })
}

/** État connu des serveurs d'un agent (lecture synchrone, sans abonnement). */
export function mcpAuthEntry(profileId: string): McpAuthEntry | undefined {
  return entries.get(profileId)
}

/**
 * Relit chez l'agent l'état de ses serveurs (pour le dossier de la conversation affichée) et le
 * range : une relecture dépassée par une plus récente ne range rien ; un état reçu par événement
 * pendant la relecture l'emporte. Rejette si le main ne répond pas (l'appelant le dit).
 */
export function readMcpAuth(profileId: string): Promise<McpAuthEntry> {
  listen()
  const id = ++requests
  const since = events
  const reading = window.api.mcp
    .authStates(profileId)
    .then((read): Promise<McpAuthEntry> | McpAuthEntry => {
      // Dépassée par une relecture plus récente : c'est elle qui range, et qui répond.
      const newer = pending.get(profileId)
      if (newer && newer.id !== id) return newer.promise
      const next = byName(read.servers)
      for (const [name, state] of Object.entries(entries.get(profileId)?.states ?? {})) {
        if ((eventOf.get(keyOf(profileId, name)) ?? 0) > since && name in next) next[name] = state
      }
      const entry = { agentFound: read.agentFound, states: next, terminal: read.terminal }
      entries.set(profileId, entry)
      changed()
      return entry
    })
  pending.set(profileId, { id, promise: reading })
  return reading
}

/** Re-rend le composant à chaque changement du magasin ; `active` faux : n'écoute rien. */
export function useMcpAuthStore(active = true): number {
  return useSyncExternalStore(
    (listener) => {
      if (active) listen()
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
}

/** Essais : magasin vidé et écoute à reposer (l'`api` d'essai change d'un essai à l'autre). */
export function resetMcpAuthStore(): void {
  unsubscribe?.()
  unsubscribe = undefined
  entries.clear()
  eventOf.clear()
  pending.clear()
  changed()
}

/* ---------- Onglet d'un agent dans Réglages › Serveurs MCP ---------- */

const EMPTY: McpAuthEntry = { agentFound: undefined, states: {}, terminal: {} }

export function useMcpAuth(view: McpAgentView, workspace: string): McpAuthModel {
  const { t } = useTranslation()
  const enabled = !!view.oauth
  const { profileId, label: agent } = view
  useMcpAuthStore(enabled)
  // Dossier ou serveurs changés : rien de l'ancien contexte n'est montré, l'état est relu.
  const servers = view.servers.map((s) => `${s.scope}:${s.name}:${s.authPreset ?? ''}`).join('|')
  const context = `${profileId}\n${workspace}\n${servers}`
  // Contexte pour lequel l'état a été relu par cet onglet.
  const [readFor, setReadFor] = useState('')
  const [notes, setNotes] = useState<Record<string, McpAuthNote & { context: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  // Contexte courant, lu par les actions parties d'un rendu précédent (« Connecter » ajoute le
  // serveur, puis se connecte : la liste a changé entre-temps).
  const contextRef = useRef(context)
  useLayoutEffect(() => {
    contextRef.current = context
  }, [context])
  const shown = (readFor === context ? mcpAuthEntry(profileId) : undefined) ?? EMPTY
  const { states } = shown

  const refresh = useCallback(() => {
    if (!enabled) return
    const id = ++request.current
    const asked = contextRef.current
    readMcpAuth(profileId)
      .then(() => {
        if (id !== request.current) return
        setError(null)
        setReadFor(asked)
      })
      .catch((e: unknown) => id === request.current && setError(ipcErrorText(e)))
  }, [enabled, profileId])

  useEffect(() => refresh(), [refresh, context])

  const note = (name: string, kind: McpAuthNote['kind'], text: string) =>
    setNotes((current) => ({
      ...current,
      [name]: {
        status: mcpAuthEntry(profileId)?.states[name]?.status,
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

  // Actions en vol par serveur : un second clic (double clic) est ignoré, jamais un refus « busy ».
  const inFlight = useRef(new Set<string>())
  // Serveurs dont l'action vient de faire disparaître le bouton cliqué : le focus y est rendu.
  const focusWanted = useRef(new Set<string>())

  /**
   * Une action : ignorée si une autre de ce serveur est en vol ; la note précédente s'efface,
   * l'erreur IPC est dite, l'état est relu après.
   */
  const act = async (name: string, action: () => Promise<void>) => {
    if (inFlight.current.has(name)) return
    inFlight.current.add(name)
    focusWanted.current.add(name)
    clear(name)
    try {
      await action()
    } catch (e) {
      note(name, 'problem', ipcErrorText(e))
    } finally {
      inFlight.current.delete(name)
    }
    refresh()
  }

  // Commande copiée pour un terminal : la connexion peut s'y faire. L'état est relu quand la
  // fenêtre reprend le focus (retour du terminal), tant qu'une note « Copiée » est affichée.
  const copied = Object.values(notes).some((n) => n.kind === 'copied' && n.context === context)
  useEffect(() => {
    if (!copied) return undefined
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [copied, refresh])

  const connectRefused = (name: string, result: McpConnectResult): string | undefined => {
    if (result.started) return undefined
    switch (result.reason) {
      // Déjà « en cours » pour ce serveur (un autre onglet, une autre fenêtre) : rien à dire.
      case 'busy':
        return mcpAuthEntry(profileId)?.states[name]?.status === 'connecting'
          ? undefined
          : t('mcp.auth.busy')
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
    focusPending: (name) => focusWanted.current.has(name),
    focusDone: (name) => void focusWanted.current.delete(name),
    connect: (name) =>
      act(name, async () => {
        const refused = connectRefused(name, await window.api.mcp.connect(profileId, name))
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
      focusWanted.current.add(name)
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
