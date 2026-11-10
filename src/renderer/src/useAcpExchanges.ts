/**
 * Échanges ACP d'une conversation pour l'onglet du panneau (fiche 135) : instantané à l'ouverture,
 * puis les lots du main, fusionnés par numéro (un lot peut recouvrir l'instantané) et bornés aux
 * 2 000 derniers. En pause, les messages reçus attendent la reprise.
 */
import { ACP_EXCHANGES_MAX, type AcpExchange } from '@shared/acp-exchanges'
import { useEffect, useRef, useState } from 'react'
import { parseExchange, type ParsedExchange } from './acp-view'

/** Ajoute les messages nouveaux (numéro plus grand que le dernier), bornés aux plus récents. */
export function mergeExchanges(
  current: readonly ParsedExchange[],
  incoming: readonly AcpExchange[],
  max = ACP_EXCHANGES_MAX
): ParsedExchange[] {
  let last = current.at(-1)?.seq ?? 0
  const fresh: ParsedExchange[] = []
  for (const message of [...incoming].sort((a, b) => a.seq - b.seq)) {
    if (message.seq <= last) continue
    fresh.push(parseExchange(message))
    last = message.seq
  }
  if (fresh.length === 0) return current as ParsedExchange[]
  const merged = [...current, ...fresh]
  return merged.length > max ? merged.slice(-max) : merged
}

export function useAcpExchanges(conversationId: string) {
  const [messages, setMessages] = useState<ParsedExchange[]>([])
  const [paused, setPausedState] = useState(false)
  /** Reçus pendant la pause. */
  const [waiting, setWaiting] = useState<AcpExchange[]>([])
  const pausedRef = useRef(false)

  useEffect(() => {
    let live = true
    // Les lots arrivés avant l'instantané sont gardés, puis fusionnés par numéro.
    const early: AcpExchange[] = []
    let ready = false
    const add = (incoming: AcpExchange[]) => {
      if (pausedRef.current) setWaiting((w) => [...w, ...incoming].slice(-ACP_EXCHANGES_MAX))
      else setMessages((m) => mergeExchanges(m, incoming))
    }
    const unsubscribe = window.api.acp.onMessages((batch) => {
      if (batch.conversationId !== conversationId) return
      if (ready) add(batch.messages)
      else early.push(...batch.messages)
    })
    void window.api.acp.watch(conversationId).then(
      (snapshot) => {
        if (!live) return
        ready = true
        setMessages(mergeExchanges([], [...snapshot.messages, ...early]))
      },
      () => {
        ready = true
      }
    )
    return () => {
      live = false
      unsubscribe()
      void window.api.acp.unwatch(conversationId).catch(() => {})
    }
  }, [conversationId])

  /** Pause ; à la reprise, les messages en attente rejoignent la liste. */
  const setPaused = (next: boolean) => {
    pausedRef.current = next
    setPausedState(next)
    if (next || waiting.length === 0) return
    setMessages((m) => mergeExchanges(m, waiting))
    setWaiting([])
  }

  return { messages, paused, setPaused, waiting: waiting.length }
}
