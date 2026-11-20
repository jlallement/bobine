import {
  Check,
  CircleExclamationPoint,
  CircleDot,
  CircleHelp,
  CircleStop,
  Hand,
  LoaderCircle,
  TriangleAlert
} from 'lucide-react'
import type { ChildState } from '@shared/children'

/** Même vocabulaire visuel pour les lignes de conversation et la carte « Sous-tâches ». */
export function ConversationStateIcon({
  state,
  label,
  reason
}: {
  state: ChildState
  label?: string
  reason?: string
}) {
  const props = {
    size: 13,
    className: `child-state ${state}${state === 'running' ? ' spin' : ''}`,
    'aria-label': label,
    'data-state': state,
    ...(reason ? { 'data-reason': reason } : {})
  }
  if (state === 'running') return <LoaderCircle {...props} />
  // Bloquée par un modèle refusé (fiche 267) : une alerte, pas la main d'un accord à donner.
  if (state === 'waiting' && reason === 'blocked') return <TriangleAlert {...props} />
  if (state === 'waiting')
    return reason === 'question' ? <CircleHelp {...props} /> : <Hand {...props} />
  if (state === 'error') return <CircleExclamationPoint {...props} />
  if (state === 'unread') return <CircleDot {...props} />
  // Arrêtée (fiche 258) : l'icône et le gris du compte rendu « a été arrêtée ».
  if (state === 'stopped') return <CircleStop {...props} />
  return <Check {...props} />
}
