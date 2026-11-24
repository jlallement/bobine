import { useEffect, useState } from 'react'
import type { ExcludedPaths, PromptCapabilities } from '@shared/attachments'
import { loadDraft, saveDraft } from './drafts'
import { toPromptAttachment, useAttachments } from './useAttachments'

const ROUNDTABLE_PREFIX = '/roundtable '

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
  // Tour de table (fiche 285) : son brouillon est gardé sous la forme `/roundtable …`, repris en
  // tour de table au retour dans la conversation.
  const [roundtableDraft] = useState(() => !!draft?.text.startsWith(ROUNDTABLE_PREFIX))
  const [prefix, setPrefix] = useState(roundtableDraft ? ROUNDTABLE_PREFIX : '')
  const [text, setText] = useState(
    roundtableDraft ? (draft?.text.slice(ROUNDTABLE_PREFIX.length) ?? '') : (draft?.text ?? '')
  )
  const attachments = useAttachments(options.caps, options.agentName, options.onWarn, {
    ...(draft ? { initial: draft.attachments } : {}),
    ...(options.checkExcluded ? { checkExcluded: options.checkExcluded } : {})
  })
  const items = attachments.items
  useEffect(() => {
    if (!draftKey) return
    saveDraft(draftKey, {
      text: text ? prefix + text : prefix,
      attachments: items.map(toPromptAttachment)
    })
  }, [draftKey, text, items, prefix])
  return { text, setText, attachments, roundtable: { startActive: roundtableDraft, setPrefix } }
}
