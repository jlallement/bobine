/**
 * Conversation affichée au lancement (fiche 243) : la dernière affichée à la fermeture précédente,
 * si elle est encore dans l'historique et pas archivée ; sinon aucune (le gestionnaire ouvre alors
 * une nouvelle conversation, comme avant). Un brouillon n'est jamais retenu : il n'est pas enregistré.
 */
import type { Settings } from '../settings'
import { NO_FOLDER } from './agentless'
import type { ConversationRecord } from './store'

type Shown = Pick<ConversationRecord, 'id' | 'archived'>

export function conversationToReopen<T extends Shown>(
  saved: string | undefined,
  records: Iterable<T>
): T | undefined {
  if (!saved) return undefined
  for (const record of records) {
    if (record.id === saved) return record.archived ? undefined : record
  }
  return undefined
}

/** Ce qui est retenu de la conversation affichée : son identifiant, rien pour un brouillon. */
export function shownToRemember(shown: { record: { id: string }; draft: boolean } | undefined) {
  return shown && !shown.draft ? shown.record.id : undefined
}

/**
 * Agent et dossier de la nouvelle conversation du lancement (quand aucune n'est rouverte) : imposés
 * (essais), réglage « Nouvelle conversation », derniers choisis ; sinon aucun dossier, l'agent
 * attend le choix (premier lancement, fiche 093).
 */
export function launchDraftTarget(
  settings: Readonly<Settings>,
  options: { overrides?: { profileId?: string; workspace?: string }; defaultWorkspace?: string }
): { profileId: string | undefined; wanted: string; fallback: string } {
  const { overrides } = options
  const defaults = settings.newConversation
  const fallback = options.defaultWorkspace ?? NO_FOLDER
  return {
    profileId: overrides?.profileId ?? defaults?.profileId ?? settings.profileId,
    wanted: overrides?.workspace ?? defaults?.workspace ?? settings.workspace ?? fallback,
    fallback
  }
}
