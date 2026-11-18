import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fallbackCommitMessage,
  type CommitDraftPlace,
  type CommitDraftResult
} from '@shared/commit-draft'
import type { CommitFile } from '@shared/worktree-cycle'

/**
 * Nom de l'agent de chaque conversation (« OpenCode »), pour « Rédaction par… » avant la réponse :
 * tenu par `useConversations` à chaque liste reçue du main. Lu au départ d'une rédaction seulement.
 */
const agentLabels = new Map<string, string>()

export function rememberAgentLabels(list: readonly { id: string; profileLabel: string }[]): void {
  agentLabels.clear()
  for (const c of list) agentLabels.set(c.id, c.profileLabel)
}

/** État de la rédaction du message de commit (fiche 246), tel que le formulaire le montre. */
export type CommitDraftState =
  | { status: 'drafting'; agentLabel?: string; startedAt: number }
  | {
      status: 'done'
      result: CommitDraftResult
      /** Fichiers cochés quand la rédaction a commencé : comparés à ceux d'à présent. */
      files: string
      /** Combien de fichiers. */
      count: number
    }

const keyOf = (files: readonly CommitFile[]) => files.map((f) => `${f.status}:${f.path}`).join('\n')

/**
 * Rédaction par l'agent à l'ouverture du formulaire de commit (fiche 246, ADR-0056) : une demande
 * au main par rédaction, jamais relancée sans clic (« Rédiger à nouveau », « Réessayer ») ; une
 * réponse d'une rédaction dépassée est jetée. `files` : les fichiers cochés en ce moment.
 */
export function useCommitDraft(
  conversationId: string,
  files: readonly CommitFile[],
  place: CommitDraftPlace
) {
  const [state, setState] = useState<CommitDraftState | null>(null)
  /** Numéro de la rédaction : le formulaire oublie le message retouché à chaque nouvelle. */
  const [round, setRound] = useState(0)
  const generation = useRef(0)
  const current = useRef(files)
  useEffect(() => {
    current.current = files
  })

  const start = useCallback(() => {
    const chosen = current.current
    if (chosen.length === 0 || !conversationId) return
    const mine = ++generation.current
    const agentLabel = agentLabels.get(conversationId)
    setRound(mine)
    setState({
      status: 'drafting',
      startedAt: Date.now(),
      ...(agentLabel ? { agentLabel } : {})
    })
    window.api.commit
      .draft(conversationId, { files: [...chosen], place })
      .then((result) => {
        if (generation.current === mine) {
          setState({ status: 'done', result, files: keyOf(chosen), count: chosen.length })
        }
      })
      .catch((error: unknown) => {
        // Le main ne lève pas ; un canal refusé (profil en lecture seule…) : le repli, sans relance.
        if (generation.current !== mine) return
        setState({
          status: 'done',
          result: {
            source: 'fallback',
            message: fallbackCommitMessage(chosen),
            reason: 'failed',
            detail: error instanceof Error ? error.message : String(error)
          },
          files: keyOf(chosen),
          count: chosen.length
        })
      })
  }, [conversationId, place])

  const stop = useCallback(() => {
    void window.api.commit.stop(conversationId).catch(() => undefined)
  }, [conversationId])

  // Formulaire fermé ou démonté pendant la rédaction : l'agent s'arrête.
  const drafting = state?.status === 'drafting'
  const drafted = useRef(drafting)
  useEffect(() => {
    drafted.current = drafting
  })
  useEffect(
    () => () => {
      generation.current++
      if (drafted.current) void window.api.commit.stop(conversationId).catch(() => undefined)
    },
    [conversationId]
  )

  const stale = state?.status === 'done' && state.files !== keyOf(files)
  return { state, round, start, stop, stale }
}

/** Secondes écoulées depuis `startedAt`, relues chaque seconde tant que `on`. */
export function useElapsed(startedAt: number | undefined, on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [on, startedAt])
  return startedAt === undefined ? 0 : Math.max(0, Math.round((now - startedAt) / 1000))
}
