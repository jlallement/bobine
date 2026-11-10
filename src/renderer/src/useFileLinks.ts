import { useCallback, useLayoutEffect, useRef } from 'react'
import i18next from 'i18next'
import { ipcErrorText } from './ipc-errors'
import { openOutcomeNote, type FileLinkOutcome, type MarkdownDocument } from '@shared/file-links'
import type { RuleFileView } from '@shared/rules'
import type { OpenFileLink } from './components/thread/FileLink'
import type { LoadSubagentWork } from './subagent-work'
import type { PanelState } from './usePanel'

/** Ouvre un lien de fichier cité dans le fil d'une conversation, dans le dossier de celle-ci. */
export type OpenFileLinkIn = (
  conversationId: string,
  href: string,
  options: { reveal: boolean; base?: string }
) => void

/** Ce que les liens ouvrent dans le panneau (fonctions stables de `usePanel`). */
export interface LinkPanel {
  showDocument: (conversationId: string, document: MarkdownDocument) => void
  update: (change: Partial<PanelState>) => void
}

/** Avis affichés dans le fil de la conversation active. */
export interface LinkNotices {
  info: (message: string) => void
  warn: (message: string) => void
}

/**
 * Ce que le fil d'une conversation affichée ouvre (`ConversationScope`) : ses liens de fichiers,
 * dans son propre dossier, et le travail de ses sous-agents, rejoué à part (fiche 053). Fonctions
 * stables tant que la conversation l'est, pour les éléments mémoïsés du fil (fiche 047).
 */
export function useConversationScope(
  conversationId: string | null,
  openFileLink: OpenFileLinkIn,
  /** Erreur rendue sans conversation. */
  missing: 'app.noConversation' | 'app.noBeside'
): { openLink: OpenFileLink; loadSubagentWork: LoadSubagentWork } {
  const openLink = useCallback<OpenFileLink>(
    (href, options) => {
      if (conversationId) openFileLink(conversationId, href, options)
    },
    [conversationId, openFileLink]
  )
  const loadSubagentWork = useCallback<LoadSubagentWork>(
    (toolCallId) =>
      conversationId
        ? window.api.conversations.subagentWork(conversationId, toolCallId)
        : Promise.reject(new Error(i18next.t(missing))),
    [conversationId, missing]
  )
  return { openLink, loadSubagentWork }
}

/**
 * Liens de fichiers dans le fil (fiche 052) : aperçu d'un .md dans le panneau, page HTML dans le
 * navigateur de la conversation (fiche 064), app par défaut ou Finder pour le reste ; liens du
 * document en aperçu ; règles actives (fiche 056). Les avis passent par le fil.
 */
export function useFileLinks(options: {
  /** Conversation active. */
  conversationId: string | null
  /** Conversation du document en aperçu : ses liens s'ouvrent dans son dossier. */
  previewConversation: string | undefined
  panel: LinkPanel
  notices: LinkNotices
}) {
  const { conversationId, previewConversation, panel, notices } = options
  // Lu au moment du clic : `openFileLink` reste stable quoi qu'il arrive aux avis.
  const actions = useRef({ panel, notices })
  useLayoutEffect(() => {
    actions.current = { panel, notices }
  })
  const openFileLink = useCallback<OpenFileLinkIn>((id, href, linkOptions) => {
    const { panel: side, notices: notes } = actions.current
    window.api.fileLinks
      .open(id, href, linkOptions)
      .then((outcome: FileLinkOutcome) => {
        const note = openOutcomeNote(outcome)
        if (outcome.kind === 'preview') {
          side.showDocument(id, outcome.document)
        } else if (outcome.kind === 'browser') {
          // Page HTML (fiche 064) : ouverte dans le navigateur de la conversation.
          side.update({ open: true, tab: 'browser' })
        } else if (note && outcome.kind === 'missing') {
          notes.warn(note)
        } else if (note) {
          notes.info(note)
        }
      })
      .catch((e: unknown) => notes.warn(ipcErrorText(e)))
  }, [])
  const active = useConversationScope(conversationId, openFileLink, 'app.noConversation')
  const openPreviewLink = useCallback<OpenFileLink>(
    (href, linkOptions) => {
      if (previewConversation) openFileLink(previewConversation, href, linkOptions)
    },
    [previewConversation, openFileLink]
  )
  // Règle active : en aperçu, comme un `.md` cité ; une consigne en ligne s'ouvre dans le
  // navigateur.
  const openRule = (rule: RuleFileView) => {
    const id = conversationId
    if (!id) return
    if (rule.url) {
      window.open(rule.path)
      return
    }
    window.api.fileLinks
      .readMarkdown(id, rule.path)
      .then((document) => panel.showDocument(id, document))
      .catch((e: unknown) => notices.warn(ipcErrorText(e)))
  }
  return {
    openFileLink,
    openActiveLink: active.openLink,
    loadActiveSubagentWork: active.loadSubagentWork,
    openPreviewLink,
    openRule
  }
}
