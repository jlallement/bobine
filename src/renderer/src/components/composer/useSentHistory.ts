import { useCallback, useMemo, useState } from 'react'
import { addSentEntry, parseSentHistory, type SentEntry, type SentRole } from '@shared/sent-history'
import { endOfFirstLine, onFirstLine, onLastLine, textareaCaretTops } from '../../visual-lines'
import type { ComposerHistoryState } from '../../composer-keys'

/**
 * Historique de la saisie (fiche 227) : les messages envoyés de la conversation, gardés par le
 * main dans son fil (`sentHistory`, reçu ici avec lui), parcourus par ↑ / ↓.
 *
 * Un message repris le reste tant que la saisie montre exactement ce qui a été repris (texte,
 * jetons, aucune pièce jointe) : la première modification en fait un brouillon ordinaire, pour de
 * bon (une flèche ne détruit jamais un brouillon).
 */

/** Ce qu'un rappel pose dans la saisie. */
export interface RecalledDraft {
  text: string
  /** Jetons de rôle (noms) encore connus. */
  tokens: string[]
}

/**
 * Texte et jetons d'un message repris : les rôles encore connus reviennent en jetons ; un rôle
 * supprimé depuis revient en texte simple « @Libellé », en tête.
 */
export function recalledDraft(entry: SentEntry, known: readonly { name: string }[]): RecalledDraft {
  const roles = entry.roles ?? []
  const tokens = roles.filter((r) => known.some((k) => k.name === r.name)).map((r) => r.name)
  const gone = roles.filter((r) => !tokens.includes(r.name)).map((r) => `@${r.label}`)
  return { text: [...gone, entry.text].filter(Boolean).join(' '), tokens }
}

/** Jetons posés à l'envoi, avec leur libellé (pour un rôle supprimé depuis). */
export function sentRoles(
  tokens: readonly string[],
  known: readonly { name: string; label: string }[]
): SentRole[] {
  return tokens.map((name) => ({ name, label: known.find((r) => r.name === name)?.label ?? name }))
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

interface Recalled extends RecalledDraft {
  index: number
}

export function useSentHistory(options: {
  conversationId: string | undefined
  /** `sentHistory` du fil de la conversation (non vérifié : il vient du disque). */
  raw: unknown
  /** Ce que montre la saisie, pour voir une modification. */
  text: string
  tokens: readonly string[]
  attachments: number
}) {
  const { conversationId, text, tokens, attachments } = options
  const { raw } = options
  const parsed = useMemo(() => parseSentHistory(raw), [raw])
  // Message tout juste envoyé : dans la liste tout de suite, sans attendre l'aller-retour du main
  // (↑ juste après l'envoi le trouve) ; le fil reçu ensuite le contient et prend le relais.
  const [optimistic, setOptimistic] = useState<{ base: unknown; list: SentEntry[] }>()
  const entries = optimistic && optimistic.base === raw ? optimistic.list : parsed
  const [recalled, setRecalled] = useState<Recalled>()
  // Pièces jointes du message repris, qui ne reviennent pas : dit tant que la saisie n'est pas vide.
  const [lost, setLost] = useState(0)

  // Une frappe, un collage, un effacement, une pièce jointe : le message repris devient brouillon,
  // pour de bon (oublié pendant le rendu : pas d'effet, pas d'image intermédiaire).
  const untouched =
    !!recalled &&
    recalled.text === text &&
    sameList(recalled.tokens, tokens) &&
    attachments === 0 &&
    recalled.index < entries.length
  if (recalled && !untouched) setRecalled(undefined)
  const blank = !text && tokens.length === 0 && attachments === 0
  if (blank && !recalled && lost) setLost(0)

  const recall = useCallback((index: number, draft: RecalledDraft, entry: SentEntry) => {
    setRecalled({ index, ...draft })
    setLost(entry.attachments ?? 0)
  }, [])
  /** Échap, ↓ après le dernier, envoi : hors de l'historique. */
  const leave = useCallback(() => {
    setRecalled(undefined)
    setLost(0)
  }, [])
  const record = useCallback(
    (entry: SentEntry) => {
      if (!conversationId) return
      setOptimistic({ base: raw, list: addSentEntry(entries, entry) })
      // Jamais un envoi empêché par l'historique : un échec (profil en lecture seule…) est ignoré.
      try {
        void window.api.conversations.recordSent(conversationId, entry).catch(() => undefined)
      } catch {
        // API absente (essais de composants) : rien à garder.
      }
    },
    [conversationId, raw, entries]
  )
  return {
    entries,
    /** Message repris affiché, non modifié ; `undefined` hors de l'historique. */
    index: untouched ? recalled.index : undefined,
    blank,
    lost,
    recall,
    leave,
    record
  }
}

/** État de l'historique pour les touches : la ligne affichée du curseur n'est mesurée qu'au besoin. */
export function historyKeyState(
  history: { entries: readonly unknown[]; index: number | undefined; blank: boolean },
  input: HTMLTextAreaElement,
  key: string
): ComposerHistoryState {
  const base = { count: history.entries.length, index: history.index, blank: history.blank }
  const arrow = key === 'ArrowUp' || key === 'ArrowDown'
  if (history.index === undefined || !arrow) return { ...base, firstLine: true, lastLine: true }
  const { topOf, dispose } = textareaCaretTops(input, input.value)
  try {
    return {
      ...base,
      firstLine: onFirstLine(input.selectionStart, topOf),
      lastLine: onLastLine(input.selectionEnd, input.value.length, topOf)
    }
  } finally {
    dispose()
  }
}

/**
 * Où poser le curseur d'un message repris : par ↑, en fin de première ligne affichée (le champ
 * remonte en haut) ; par ↓, en fin de texte.
 */
export function recalledCaret(
  input: HTMLTextAreaElement | null,
  text: string,
  from: 'up' | 'down'
): number {
  if (from === 'down' || !input) return text.length
  const { topOf, dispose } = textareaCaretTops(input, text)
  try {
    return endOfFirstLine(text.length, topOf)
  } finally {
    dispose()
  }
}
