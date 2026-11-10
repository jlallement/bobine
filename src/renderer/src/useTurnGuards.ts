import { useEffect, useMemo, useRef } from 'react'
import { focusMemory } from './memory-focus'
import type { AgentSnapshot } from '@shared/agent'
import type { CapPreferences, ConversationCap } from '@shared/cost-cap'
import type { Preferences } from '@shared/preferences'
import type { TurnControls } from './turn-controls'

/** Ce que la puce de consommation propose de plus (fiche 157). */
export interface UsageActions {
  /** Envoie la commande de compaction du profil (comme `/compact`), quand l'agent est prêt. */
  onCompact?: () => void
  /** Commande de compaction de l'agent, pour l'infobulle. */
  compactCommand?: string
  /** Plafond propre à la conversation (dans son fil) ; absent : celui des réglages. */
  costCap?: ConversationCap
  preferences?: CapPreferences
  /** Plafond de la conversation ; `null` : retour à celui des réglages. */
  onSetCostCap?: (cap: ConversationCap | null) => void
}

/**
 * Pendant le tour (fiche 157) : ce que les cartes du fil (`TurnControls`) et la puce de
 * consommation (`UsageActions`) peuvent faire de la conversation active.
 */
export function useTurnGuards({
  conversationId,
  snapshot,
  costCap,
  preferences,
  cancel,
  compact,
  warn,
  openSettings
}: {
  conversationId: string | null
  snapshot: AgentSnapshot | null
  costCap: ConversationCap | undefined
  preferences: Preferences | undefined
  cancel: () => void
  /** Lance `/compact` (commandes de l'app, fiche 039). */
  compact: () => void
  warn: (message: string) => void
  /** Ouvre les réglages sur une section (Réglages › Mémoire, fiche 182). */
  openSettings: (section: 'memory') => void
}): { turnControls: TurnControls; usageActions: UsageActions } {
  const busy = snapshot?.status === 'busy'
  const ready = snapshot?.status === 'ready'
  const compactCommand = snapshot?.compactCommand
  const stalledMinutes = preferences?.stalledCommandMinutes ?? 3
  const memoryEnabled = preferences?.memoryEnabled ?? true
  // Fonction des dialogues recréée à chaque rendu : lue au clic, sans refaire les contrôles.
  const openSettingsRef = useRef(openSettings)
  useEffect(() => {
    openSettingsRef.current = openSettings
  })
  const turnControls = useMemo<TurnControls>(
    () => ({
      busy,
      cancel,
      stalledAfterMs: stalledMinutes * 60_000,
      answerCostCap: (itemId, answer) => {
        if (!conversationId) return
        window.api.conversations
          .answerCostCap(conversationId, itemId, answer)
          .catch((error: unknown) => warn(error instanceof Error ? error.message : String(error)))
      },
      answerTurnLimit: (itemId, answer) => {
        if (!conversationId) return
        window.api.conversations
          .answerTurnLimit(conversationId, itemId, answer)
          .catch((error: unknown) => warn(error instanceof Error ? error.message : String(error)))
      },
      ...(conversationId
        ? {
            memory: {
              enabled: memoryEnabled,
              decide: (proposalId, accept, force) =>
                window.api.memory.decide({
                  conversationId,
                  proposalId,
                  accept,
                  ...(force ? { force } : {})
                }),
              open: (name) => {
                focusMemory(name)
                openSettingsRef.current('memory')
              }
            }
          }
        : {})
    }),
    [busy, cancel, stalledMinutes, conversationId, warn, memoryEnabled]
  )
  const usageActions: UsageActions = {
    ...(compactCommand && ready ? { onCompact: compact, compactCommand } : {}),
    ...(costCap ? { costCap } : {}),
    ...(preferences ? { preferences } : {}),
    ...(conversationId
      ? {
          onSetCostCap: (cap: ConversationCap | null) => {
            window.api.conversations
              .setCostCap(conversationId, cap)
              .catch((error: unknown) =>
                warn(error instanceof Error ? error.message : String(error))
              )
          }
        }
      : {})
  }
  return { turnControls, usageActions }
}
