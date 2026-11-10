import {
  Check,
  CircleExclamationPoint,
  CircleDot,
  CircleHelp,
  Hand,
  LoaderCircle
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
  if (state === 'waiting')
    return reason === 'question' ? <CircleHelp {...props} /> : <Hand {...props} />
  if (state === 'error') return <CircleExclamationPoint {...props} />
  if (state === 'unread') return <CircleDot {...props} />
  return <Check {...props} />
}
