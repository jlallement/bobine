/**
 * Ce que la fenêtre rapide (fiche 062) demande au main par l'IPC : la cible d'une nouvelle
 * conversation, l'envoi du message, la taille. Sorti d'`index.ts` (plafond de lignes, fiche 089).
 */
import type { PromptAttachment } from '@shared/attachments'
import type { IpcEventContract } from '@shared/ipc'
import type { ConversationManager } from './conversations/manager'
import { log } from './log'
import type { QuickEntry } from './quick-entry'

export interface QuickEntryDepsInput {
  conversations: Pick<ConversationManager, 'newConversationTarget' | 'create' | 'prompt'>
  quickEntry: Pick<QuickEntry, 'hide' | 'resize'>
  focusMainWindow: () => void
  broadcast: <K extends 'app:openConversation' | 'app:prefill'>(
    channel: K,
    payload: IpcEventContract[K]
  ) => void
}

export function quickEntryDeps({
  conversations,
  quickEntry,
  focusMainWindow,
  broadcast
}: QuickEntryDepsInput) {
  return {
    info: () => {
      const target = conversations.newConversationTarget()
      return { agentLabel: target.profileLabel, workspace: target.workspace }
    },
    // Nouvelle conversation (réglages « Nouvelle conversation »), fenêtre principale dessus.
    send: async (text: string, attachments: PromptAttachment[]) => {
      const view = await conversations.create({})
      const { id } = view.summary
      quickEntry.hide()
      focusMainWindow()
      broadcast('app:openConversation', id)
      const prefill = () => broadcast('app:prefill', { id, text, attachments })
      // L'agent attend une action (dossier, connexion, licence) : le message attend dans la
      // zone de saisie, sous son panneau.
      if (view.snapshot?.status !== 'ready') return prefill()
      void conversations.prompt(id, text, attachments).catch((error: unknown) => {
        log.warn('Fenêtre rapide : message non envoyé', error)
        prefill()
      })
    },
    hide: () => quickEntry.hide(),
    resize: (height: number) => quickEntry.resize(height)
  }
}
