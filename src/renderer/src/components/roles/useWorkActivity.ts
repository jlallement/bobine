import { useEffect, useState } from 'react'

/** Derniers faits gardés par travail (maquette A : « les trois derniers faits »). */
export const RECENT_FACTS = 3

/** Ce que fait un travail en ce moment : l'outil en cours, puis ses derniers outils finis. */
export interface WorkActivity {
  current?: string
  done: string[]
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
    // Titre de chaque outil, par identifiant : une mise à jour ne le répète pas toujours.
    const titles = new Map<string, string>()
    const set = (update: (value: WorkActivity) => WorkActivity) =>
      setActivity((current) => ({
        id,
        value: update(current.id === id ? current.value : IDLE)
      }))
    return window.api.agent.onEvent(({ conversationId, event }) => {
      if (conversationId !== id) return
      if (event.type === 'user-message') {
        titles.clear()
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
      if (update.title) titles.set(update.toolCallId, update.title)
      const title = titles.get(update.toolCallId)
      if (!title) return
      const finished = update.status === 'completed' || update.status === 'failed'
      set((value) =>
        finished
          ? {
              done: [...value.done.filter((t) => t !== title), title].slice(-RECENT_FACTS),
              ...(value.current && value.current !== title ? { current: value.current } : {})
            }
          : { ...value, current: title }
      )
    })
  }, [id])
  return activity.id === id ? activity.value : IDLE
}
