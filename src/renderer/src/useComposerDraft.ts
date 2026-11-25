import { useCallback, useEffect, useState } from 'react'
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
  // tour de table au retour dans la conversation — seulement si le tour de table y est utilisable
  // (`adopt`) : ailleurs (Discussion, `/roundtable` de l'agent ou de l'utilisateur), le texte reste
  // tel quel, préfixe compris (N3).
  const [roundtableDraft] = useState(() => !!draft?.text.startsWith(ROUNDTABLE_PREFIX))
  const [prefix, setPrefix] = useState('')
  const [text, setText] = useState(draft?.text ?? '')
  const adopt = useCallback(() => {
    setText((t) => (t.startsWith(ROUNDTABLE_PREFIX) ? t.slice(ROUNDTABLE_PREFIX.length) : t))
    setPrefix(ROUNDTABLE_PREFIX)
  }, [])
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
  return {
    text,
    setText,
    attachments,
    roundtable: { startActive: roundtableDraft, setPrefix, adopt }
  }
}
