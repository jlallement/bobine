import * as Dialog from '@radix-ui/react-dialog'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpFooterLink } from '../help/HelpLink'
import { useTipsContext } from '../../useTips'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { ipcErrorText } from '../../ipc-errors'
import {
  ChildOptions,
  childChoiceRequest,
  childModelAllowed,
  useMotherModel,
  type ChildChoice
} from '../sidebar/child-options'

/**
 * « Faire relire… » (fiche 177) : ce que relit la relecture, les points à surveiller, l'agent et
 * le modèle — ceux de la conversation relue, suggérés et à confirmer (règle de la fiche 160) —, et
 * ce qu'elle coûte. Rien ne part sans « Lancer la relecture » ; la conversation affichée ne change
 * pas, le relecteur apparaît parmi les filles.
 */
export function ReviewDialog({
  author,
  profiles,
  onClose
}: {
  author: ConversationSummary
  profiles: ProfileSummary[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [focus, setFocus] = useState('')
  const [choice, setChoice] = useState<ChildChoice>({
    profileId: author.profileId,
    modelValue: null
  })
  const model = useMotherModel(author.id, childModelAllowed(profiles, author))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tips = useTipsContext()

  const launch = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.conversations.startReview(author.id, {
        ...(focus.trim() ? { focus } : {}),
        ...childChoiceRequest(author, model, choice)
      })
      // Une relecture lancée : l'astuce « Faire relire » n'a plus lieu d'être (fiche 191).
      tips?.used('review')
      onClose()
    } catch (e) {
      setError(ipcErrorText(e))
      setBusy(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void launch()
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog child-dialog" data-testid="review-dialog">
          <Dialog.Title className="confirm-title">
            {t('review.dialog.title', { title: author.title })}
          </Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('review.dialog.description')}
          </Dialog.Description>
          <p className="field-help" data-testid="review-scope">
            {author.branch
              ? t('review.dialog.scopeBranch', { branch: author.branch })
              : t('review.dialog.scopeUncommitted')}
          </p>
          <label className="form-field">
            <span className="field-label">{t('review.dialog.focus')}</span>
            <textarea
              className="field-input"
              rows={3}
              autoFocus
              value={focus}
              placeholder={t('review.dialog.placeholder')}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={onKeyDown}
              data-testid="review-focus"
            />
          </label>
          <ChildOptions
            mother={author}
            profiles={profiles}
            model={model}
            choice={choice}
            onChange={setChoice}
            testId="review"
          />
          <p className="field-help" data-testid="review-suggested">
            {t('review.dialog.suggested')} {t('review.dialog.cost')}
          </p>
          {error && (
            <p className="field-error" role="alert" data-testid="review-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            {/* En bas à gauche, loin des boutons (fiche 186). */}
            <span className="confirm-actions-start">
              <HelpFooterLink topic="review" />
            </span>
            <Dialog.Close className="btn ghost" disabled={busy}>
              {t('common.cancel')}
            </Dialog.Close>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void launch()}
              data-testid="review-launch"
            >
              {busy ? t('review.dialog.launching') : t('review.dialog.launch')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
