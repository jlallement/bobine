import { useState, type RefObject } from 'react'
import { commandQuery } from '@shared/commands'
import type { Tips } from '../../useTips'
import {
  historyKeyState,
  recalledCaret,
  recalledDraft,
  sentRoles,
  useSentHistory
} from './useSentHistory'

/**
 * L'historique de la saisie branché sur `Composer` (fiche 227, sorti pour sa taille) : ce que
 * fait un rappel (texte, jetons, curseur, menus), ce qui part dans l'historique à l'envoi, le
 * rappel « ↑ Messages précédents ».
 */
export function useComposerHistory(o: {
  conversationId: string | undefined
  raw: unknown
  text: string
  roles: {
    /** Rôles connus (un jeton d'un rôle supprimé depuis revient en texte). */
    known: readonly { name: string; label: string }[]
    compose: { tokens: string[]; replace: (names: readonly string[]) => void }
  }
  attachments: number
  textarea: RefObject<HTMLTextAreaElement | null>
  changeText: (value: string, caret?: number) => void
  placeCaret: (caret: number, scroll?: 'top' | 'bottom') => void
  commandMenu: { dismiss: () => void }
  mentions: { dismiss: () => void }
  tips: Tips | null
}) {
  const { roles, tips } = o
  const history = useSentHistory({
    conversationId: o.conversationId,
    raw: o.raw,
    text: o.text,
    tokens: roles.compose.tokens,
    attachments: o.attachments
  })
  const [focused, setFocused] = useState(false)

  /** Message `index` repris : texte et jetons, curseur selon la flèche, menus fermés. */
  const recall = (index: number, from: 'up' | 'down') => {
    const entry = history.entries[index]
    if (!entry) return
    // Entrée dans l'historique : le rappel « ↑ Messages précédents » a servi une fois de plus.
    if (history.index === undefined) tips?.hintUsed?.('history')
    const draft = recalledDraft(entry, roles.known)
    roles.compose.replace(draft.tokens)
    const at = recalledCaret(o.textarea.current, draft.text, from)
    o.changeText(draft.text, at)
    o.placeCaret(at, from === 'up' ? 'top' : 'bottom')
    // Les menus ne s'ouvrent pas d'eux-mêmes (« /compact » repris n'ouvre pas le menu « / »).
    if (commandQuery(draft.text) !== undefined) o.commandMenu.dismiss()
    o.mentions.dismiss()
    history.recall(index, draft, entry)
  }
  /** Échap, ou ↓ après le dernier : saisie vide, hors de l'historique. */
  const leaveHistory = () => {
    roles.compose.replace([])
    o.changeText('', 0)
    history.leave()
  }

  return {
    index: history.index,
    count: history.entries.length,
    lost: history.lost,
    /** Message parti, tel que tapé (jetons compris) : il entre dans l'historique. */
    recordSent: (text: string, tokens: readonly string[] = []) => {
      history.record({
        text,
        roles: sentRoles(tokens, roles.known),
        attachments: o.attachments
      })
      history.leave()
    },
    /** Pour `composerKeyDown`. */
    keys: {
      history: (input: HTMLTextAreaElement, key: string) => historyKeyState(history, input, key),
      recall,
      leaveHistory
    },
    /**
     * Rappel « ↑ Messages précédents » : saisie vide avec le focus, historique non vide, tant
     * qu'il n'a pas servi trois fois ; `free` : rien d'autre ne prend ↑ (message en attente) et
     * la saisie n'est pas bloquée.
     */
    hint: (free: boolean) =>
      free && focused && history.blank && history.entries.length > 0 && !!tips?.hint?.('history'),
    focusProps: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false)
    }
  }
}
