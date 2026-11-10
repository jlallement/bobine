import { GitCompare, SquareTerminal } from 'lucide-react'
import type { ContextSource } from '@shared/context-mentions'

/** Icône d'une mention de contexte (fiche 057) : modifications git ou terminal. */
export function ContextIcon({ source, size = 14 }: { source: ContextSource; size?: number }) {
  return source === 'git-changes' ? <GitCompare size={size} /> : <SquareTerminal size={size} />
}
