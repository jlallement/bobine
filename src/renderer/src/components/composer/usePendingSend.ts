import { useEffect, useRef, useState } from 'react'
import type { AgentSnapshot } from '@shared/agent'

/**
 * Envoi en attente (fiche 272, recette rc.3). Juste après « Nouvelle conversation » ou « Nouvelle
 * discussion », la vue du fil n'arrive qu'une fois l'agent démarré (pas de `snapshot`, puis
 * `starting`) : une Entrée ou un clic sur Envoyer n'est alors pas ignoré, il est retenu. Le texte
 * reste dans la saisie ; il part par le chemin normal (`send`, comme une Entrée à ce moment-là) dès
 * que l'agent est prêt ou répond. L'attente tombe, texte gardé, si le texte ou les pièces jointes
 * changent, si la conversation change, si le démarrage finit autrement (connexion demandée,
 * échec, lecture seule, arrêt) ou si la saisie est démontée.
 */
export function usePendingSend(
  snapshot: AgentSnapshot | null,
  draftKey: string | undefined,
  text: string,
  attachments: readonly unknown[],
  submit: () => void
) {
  const status = snapshot?.status
  // Conversation connue, agent pas encore prêt : l'envoi sera possible sans rien faire de plus.
  const waiting = draftKey !== undefined && (!snapshot || status === 'starting')
  const sendable = status === 'ready' || status === 'busy'
  const [pending, setPending] = useState<{
    text: string
    attachments: readonly unknown[]
    draftKey: string | undefined
  } | null>(null)
  const send = useRef(submit)
  useEffect(() => {
    send.current = submit
  })
  // Envois déclenchés : un numéro par envoi en attente arrivé au bout (l'effet le fait partir).
  const [fired, setFired] = useState(0)
  if (pending) {
    // Ajusté pendant le rendu (pas d'effet en cascade) : l'attente tombe ou aboutit.
    const same =
      pending.text === text && pending.attachments === attachments && pending.draftKey === draftKey
    if (!same || !waiting) {
      setPending(null)
      if (same && sendable) setFired((n) => n + 1)
    }
  }
  useEffect(() => {
    if (fired > 0) send.current()
  }, [fired])
  const hasContent = text.trim().length > 0 || attachments.length > 0
  return {
    /** Agent qui démarre, rien de retenu : un envoi serait retenu (bouton Envoyer actif). */
    free: waiting && pending === null,
    /** Envoi demandé pendant l'attente : retenu (vrai), sinon rien (faux). */
    hold: (): boolean => {
      if (!waiting || !hasContent) return false
      setPending({ text, attachments, draftKey })
      return true
    }
  }
}
