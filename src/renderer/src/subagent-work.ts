import { createContext } from 'react'
import type { TranscriptItem } from '@shared/transcript'

/**
 * Relit le travail d'un sous-agent dont l'agent garde la session (fiche 053), pour la conversation
 * affichée. Absent : la carte n'offre pas « Voir son travail ».
 */
export type LoadSubagentWork = (toolCallId: string) => Promise<TranscriptItem[]>

export const SubagentWorkContext = createContext<LoadSubagentWork | null>(null)
