import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import i18next from 'i18next'
import { chosenEditor, type EditorInfo, type EditorOpenOutcome } from '@shared/editors'
import { ipcErrorText } from './ipc-errors'
import type { LinkNotices } from './useFileLinks'

/** « Ouvrir dans <éditeur> » pour le fil d'une conversation (fiche 156). */
export interface EditorAction {
  /** Nom de l'éditeur (« VS Code »). */
  name: string
  /** Ouvre `path` (relatif au dossier, ou à `base`) à `line`. */
  open: (path: string, options?: { line?: number; base?: string }) => void
  /** Ouvre un texte (sortie d'outil trop grosse pour le fil, fiche 192). */
  openText?: (text: string) => void
}

/** Éditeurs installés, détectés par le main ; `null` tant qu'ils ne sont pas connus. */
export function useInstalledEditors(): EditorInfo[] | null {
  const [editors, setEditors] = useState<EditorInfo[] | null>(null)
  useEffect(() => {
    let alive = true
    window.api.editors
      .list()
      .then((list) => alive && setEditors(list))
      .catch(() => alive && setEditors([]))
    return () => {
      alive = false
    }
  }, [])
  return editors
}

/** Éditeur choisi dans Réglages › Général, suivi quand il change. */
function useEditorPreference(): string | undefined {
  const [preference, setPreference] = useState<string | undefined>()
  useEffect(() => {
    let alive = true
    window.api.settings
      .get()
      .then((s) => alive && setPreference(s.preferences.editor))
      .catch(() => {})
    const off = window.api.settings.onChanged((s) => setPreference(s.preferences.editor))
    return () => {
      alive = false
      off()
    }
  }, [])
  return preference
}

/** Avis d'une ouverture qui n'a pas eu lieu ; rien quand le fichier s'est ouvert. */
export function editorOutcomeNote(outcome: EditorOpenOutcome): string | undefined {
  switch (outcome.kind) {
    case 'opened':
      return undefined
    case 'missing':
      return i18next.t('editor.missing', { path: outcome.path })
    case 'outside':
      return i18next.t('editor.outside', { path: outcome.path })
    case 'no-editor':
      return i18next.t('editor.none')
  }
}

/**
 * L'éditeur pour le fil de `conversationId` : `null` sans conversation ou sans éditeur installé.
 * Les avis (fichier absent, hors du dossier) passent par le fil.
 */
export function useEditorAction(
  conversationId: string | null | undefined,
  notices?: LinkNotices
): EditorAction | null {
  const installed = useInstalledEditors()
  const preference = useEditorPreference()
  const editor = installed ? chosenEditor(installed, preference) : undefined
  // Lus au moment du clic : l'action reste stable pour les éléments mémoïsés du fil (fiche 047).
  const latest = useRef(notices)
  useEffect(() => {
    latest.current = notices
  })
  const editorId = editor?.id
  const open = useCallback<EditorAction['open']>(
    (path, options) => {
      if (!conversationId || !editorId) return
      const warn = (message: string) => latest.current?.warn(message)
      window.api.editors
        .open(conversationId, editorId, path, options)
        .then((outcome) => {
          const note = editorOutcomeNote(outcome)
          if (note) warn(note)
        })
        .catch((e: unknown) => warn(ipcErrorText(e)))
    },
    [conversationId, editorId]
  )
  const openText = useCallback(
    (text: string) => {
      if (!conversationId || !editorId) return
      const warn = (message: string) => latest.current?.warn(message)
      window.api.editors
        .openText(conversationId, editorId, text)
        .then((outcome) => {
          const note = editorOutcomeNote(outcome)
          if (note) warn(note)
        })
        .catch((e: unknown) => warn(i18next.t('cap.openFailed', { error: ipcErrorText(e) })))
    },
    [conversationId, editorId]
  )
  const name = editor?.name
  return useMemo(
    () => (conversationId && name ? { name, open, openText } : null),
    [conversationId, name, open, openText]
  )
}
