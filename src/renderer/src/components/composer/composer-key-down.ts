import type { FormEvent, KeyboardEvent } from 'react'
import type { AgentCommand, ControlValue, SessionControl } from '@shared/agent'
import { composerKeyAction, nextOption, type ComposerHistoryState } from '../../composer-keys'
import type { useCommandMenu } from '../../useCommandMenu'
import type { useMentions } from '../../useMentions'
import type { MentionEntry } from './FileMenu'

/** Ce que les touches de la saisie lisent et déclenchent (`composerKeyDown`). */
export interface KeyContext {
  roleCompose: { removeLast: () => boolean }
  mentions: ReturnType<typeof useMentions>
  commandMenu: ReturnType<typeof useCommandMenu>
  busy: boolean
  text: string
  queued: readonly { id: string }[]
  modeControl: SessionControl | undefined
  status: string
  pickEntry: (entry: MentionEntry) => void
  pickCommand: (command: AgentCommand, complete: boolean) => void
  submit: (event?: FormEvent) => void
  onCancel: () => void
  editQueued: (id: string) => Promise<void>
  setControl: (id: string, value: ControlValue) => void
  /**
   * Historique de la saisie (fiche 225) : son état pour cette touche (la ligne affichée du curseur
   * mesurée au besoin), et ce qu'il fait.
   */
  history: (input: HTMLTextAreaElement, key: string) => ComposerHistoryState
  recall: (index: number, from: 'up' | 'down') => void
  leaveHistory: () => void
}

/**
 * Touches de la zone de saisie (`composer-keys.ts`), sorties de `Composer` (taille bornée,
 * fiche 089).
 */
export function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, c: KeyContext): unknown {
  const { mentions, commandMenu, queued, modeControl } = c
  // Retour arrière en tête de la saisie : le dernier jeton de rôle part d'un coup (fiche 223).
  const input = event.currentTarget
  if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
    if (c.roleCompose.removeLast()) return event.preventDefault()
  }
  const action = composerKeyAction(
    {
      key: event.key,
      shift: event.shiftKey,
      composing: event.nativeEvent.isComposing,
      modified: event.altKey || event.ctrlKey || event.metaKey
    },
    {
      mentions: { open: mentions.open, count: mentions.entries.length, active: mentions.active },
      commands: {
        open: commandMenu.open,
        count: commandMenu.matches.length,
        active: commandMenu.active
      },
      busy: c.busy,
      empty: !c.text,
      hasQueued: queued.length > 0,
      canCycleMode: !!modeControl && c.status === 'ready',
      history: c.history(input, event.key)
    }
  )
  if (action.kind === 'none') return
  event.preventDefault()
  switch (action.kind) {
    case 'mention-move':
      return mentions.setActive(action.index)
    case 'mention-pick': {
      const picked = mentions.entries[mentions.active]
      return picked && c.pickEntry(picked)
    }
    case 'mention-dismiss':
      return mentions.dismiss()
    case 'command-move':
      return commandMenu.setActive(action.index)
    case 'command-pick': {
      const picked = commandMenu.matches[commandMenu.active]
      return picked && c.pickCommand(picked, action.complete)
    }
    case 'command-dismiss':
      return commandMenu.dismiss()
    case 'submit':
      return c.submit(event)
    case 'cancel':
      return c.onCancel()
    case 'edit-last-queued': {
      const lastQueued = queued.at(-1)
      return lastQueued && void c.editQueued(lastQueued.id)
    }
    case 'next-mode': {
      const next = modeControl && nextOption(modeControl)
      return modeControl && next && c.setControl(modeControl.id, next)
    }
    case 'history-move':
      return c.recall(action.index, action.from)
    case 'history-exit':
      return c.leaveHistory()
  }
}
