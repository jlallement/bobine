/**
 * Textes d'une conversation dont le message a été refusé faute de connexion (recette 0.9, D10) :
 * statut de la liste et invite de la zone de saisie. Modèle nommé par la carte (fiche 210) : un
 * texte de modèle refusé, pas « Connexion expirée ».
 */
import i18next from 'i18next'
import type { AgentBlocker } from '@shared/agent'

export function refusedTurnText(
  blocker: AgentBlocker | undefined,
  where: 'status' | 'placeholder'
): string | undefined {
  if (blocker?.kind !== 'auth' || !blocker.atTurn) return undefined
  const key = blocker.model ? 'modelRefused' : 'authExpired'
  return where === 'status'
    ? i18next.t(`sidebar.status.${key}`)
    : i18next.t(`composer.placeholder.${key}`)
}
