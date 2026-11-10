import { useEffect, useState } from 'react'
import type { ExcludedPaths, PromptCapabilities } from '@shared/attachments'
import { loadDraft, saveDraft } from './drafts'
import { toPromptAttachment, useAttachments } from './useAttachments'

/**
 * Brouillon de la zone de saisie (fiches 026, 155 ; sorti de `Composer`) : texte et pièces jointes,
 * relus au montage, réécrits à chaque changement.
 */
export function useComposerDraft(options: {
  draftKey: string | undefined
  caps: PromptCapabilities | undefined
  agentName: string
  onWarn: (message: string) => void
  checkExcluded: ((paths: string[]) => Promise<ExcludedPaths>) | undefined
}) {
  const { draftKey } = options
  const [draft] = useState(() => (draftKey ? loadDraft(draftKey) : undefined))
  const [text, setText] = useState(draft?.text ?? '')
  const attachments = useAttachments(options.caps, options.agentName, options.onWarn, {
    ...(draft ? { initial: draft.attachments } : {}),
    ...(options.checkExcluded ? { checkExcluded: options.checkExcluded } : {})
  })
  const items = attachments.items
  useEffect(() => {
    if (draftKey) saveDraft(draftKey, { text, attachments: items.map(toPromptAttachment) })
  }, [draftKey, text, items])
  return { text, setText, attachments }
}
