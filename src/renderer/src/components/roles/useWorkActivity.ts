import { useEffect, useState } from 'react'

/** Derniers faits gardés par travail (maquette A : « les trois derniers faits »). */
export const RECENT_FACTS = 3

/** Un outil du travail : son titre (de l'agent), son genre ACP et le chemin qu'il vise. */
export interface WorkTool {
  title: string
  kind?: string
  path?: string
}

/** Ce que fait un travail en ce moment : l'outil en cours, puis ses derniers outils finis. */
export interface WorkActivity {
  current?: WorkTool
  done: WorkTool[]
}

const IDLE: WorkActivity = { done: [] }

/**
 * Activité en direct d'un travail (fiche 263), comme `useChildActivity` : seulement ce qui arrive
 * pendant que la carte est affichée (rien n'est relu du fil de la conversation). Un outil annoncé
 * devient l'outil en cours ; fini (ou en échec), il passe dans les derniers faits. Un nouveau
 * message à ce travail repart de zéro ; la fin de son tour efface l'outil en cours.
 */
export function useWorkActivity(id: string | undefined): WorkActivity {
  const [activity, setActivity] = useState<{ id: string | undefined; value: WorkActivity }>({
    id,
    value: IDLE
  })
  useEffect(() => {
    if (!id) return
    // Chaque outil, par identifiant : une mise à jour ne répète pas toujours titre et genre.
    const tools = new Map<string, WorkTool>()
    const set = (update: (value: WorkActivity) => WorkActivity) =>
      setActivity((current) => ({
        id,
        value: update(current.id === id ? current.value : IDLE)
      }))
    return window.api.agent.onEvent(({ conversationId, event }) => {
      if (conversationId !== id) return
      if (event.type === 'user-message') {
        tools.clear()
        set(() => IDLE)
        return
      }
      if (event.type === 'turn-end' || event.type === 'turn-error') {
        set(({ current: _current, ...rest }) => rest)
        return
      }
      if (event.type !== 'update') return
      const update = event.update
      if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
        return
      }
      const known = tools.get(update.toolCallId)
      const title = update.title ?? known?.title
      if (!title) return
      const kind = update.kind ?? known?.kind
      const path = update.locations?.[0]?.path ?? known?.path
      const tool: WorkTool = { title, ...(kind ? { kind } : {}), ...(path ? { path } : {}) }
      tools.set(update.toolCallId, tool)
      const finished = update.status === 'completed' || update.status === 'failed'
      set((value) =>
        finished
          ? {
              done: [...value.done.filter((t) => t.title !== title), tool].slice(-RECENT_FACTS),
              ...(value.current && value.current.title !== title ? { current: value.current } : {})
            }
          : { ...value, current: tool }
      )
    })
  }, [id])
  return activity.id === id ? activity.value : IDLE
}
