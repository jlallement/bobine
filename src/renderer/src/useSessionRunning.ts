import { useEffect, useMemo, useState } from 'react'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import { childrenOf } from '@shared/children-rows'
import type { DevServerView } from '@shared/launch'
import type { TerminalTabInfo } from '@shared/terminal'
import type { TranscriptItem } from '@shared/transcript'
import {
  childObservations,
  EMPTY_RUNNING,
  sameRunning,
  serverObservations,
  subagentObservations,
  terminalObservations,
  trackRunning,
  type RunningState
} from './session-running'

/** Lancement de l'app (ms) : ce qui a fini avant n'est pas dans « Terminées ». */
const APP_START = Math.floor(performance.timeOrigin)

const now = () => Date.now()

/** Suivi par conversation, gardé tant que l'app tourne (changer de conversation ne le perd pas). */
const tracked = new Map<string, RunningState>()

/** Liste d'une source pour une conversation, relue quand elle change ; `null` : pas encore lue. */
function useSource<T>(
  conversationId: string | null,
  read: (id: string) => Promise<T[]>,
  subscribe: (refresh: (id?: string) => void) => () => void
): T[] | null {
  const [loaded, setLoaded] = useState<{ id: string; list: T[] } | null>(null)
  useEffect(() => {
    if (!conversationId) return
    let alive = true
    const id = conversationId
    const refresh = (changed?: string) => {
      if (changed !== undefined && changed !== id) return
      read(id)
        .then((list) => alive && setLoaded({ id, list }))
        .catch(() => alive && setLoaded({ id, list: [] }))
    }
    refresh()
    const off = subscribe(refresh)
    return () => {
      alive = false
      off()
    }
  }, [conversationId, read, subscribe])
  return loaded && loaded.id === conversationId ? loaded.list : null
}

const readTerminals = (id: string): Promise<TerminalTabInfo[]> => window.api.terminal.list(id)
const watchTerminals = (refresh: (id?: string) => void) =>
  window.api.terminal.onChanged((change) => refresh(change.conversationId))
const readServers = (id: string): Promise<DevServerView[]> => window.api.preview.list(id)
// Les serveurs sont ceux d'un dossier : tout changement fait relire ceux de la conversation.
const watchServers = (refresh: (id?: string) => void) =>
  window.api.preview.onChanged(() => refresh())

/**
 * « En cours » de la conversation active (onglet « Session », fiche 166) : terminaux du panneau,
 * serveurs de dev, sous-agents en arrière-plan, filles au travail ; et ce qui a fini depuis le
 * lancement. Appelé par `App` (le suivi continue panneau fermé) ; d'une conversation qu'on ne
 * regarde pas, une fin est vue au retour.
 */
export function useSessionRunning(options: {
  conversationId: string | null
  items: readonly TranscriptItem[]
  conversations: readonly ConversationSummary[]
  attention: AttentionState
}): RunningState {
  const { conversationId, items, conversations, attention } = options
  const terminals = useSource(conversationId, readTerminals, watchTerminals)
  const servers = useSource(conversationId, readServers, watchServers)
  const observed = useMemo(
    () =>
      terminals && servers
        ? [
            ...terminalObservations(terminals),
            ...serverObservations(servers),
            ...subagentObservations(items),
            ...childObservations(childrenOf(conversationId, conversations), attention)
          ]
        : null,
    [terminals, servers, items, conversationId, conversations, attention]
  )
  // Comparées par valeur : le fil et la liste des conversations changent d'identité à chaque
  // rendu de l'app (un fil vide est un tableau neuf), pas forcément de contenu.
  const observedKey = observed && JSON.stringify(observed)
  // Suivi mis à jour pendant le rendu, à chaque nouvelle observation (ajustement d'état) ; gardé
  // ensuite par conversation pour le retour.
  const [state, setState] = useState<{
    id: string
    observed: string
    running: RunningState
  } | null>(null)
  // Sources pas encore lues pour cette conversation : rien ne doit passer pour « fini ».
  if (
    conversationId &&
    observed &&
    observedKey &&
    (state?.id !== conversationId || state.observed !== observedKey)
  ) {
    const previous =
      state?.id === conversationId ? state.running : (tracked.get(conversationId) ?? EMPTY_RUNNING)
    const next = trackRunning(previous, observed, now(), APP_START)
    setState({
      id: conversationId,
      observed: observedKey,
      running: sameRunning(previous, next) ? previous : next
    })
  }
  useEffect(() => {
    if (state) tracked.set(state.id, state.running)
  }, [state])
  if (conversationId && state?.id !== conversationId) {
    return tracked.get(conversationId) ?? EMPTY_RUNNING
  }
  return state?.running ?? EMPTY_RUNNING
}
