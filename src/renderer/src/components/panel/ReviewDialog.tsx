import * as Dialog from '@radix-ui/react-dialog'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpFooterLink } from '../help/HelpLink'
import { useTipsContext } from '../../useTips'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import { ipcErrorText } from '../../ipc-errors'
import {
  ChildOptions,
  childChoiceRequest,
  childModelAllowed,
  useMotherModel,
  type ChildChoice
} from '../sidebar/child-options'

/**
 * Un autre modèle que celui de la conversation relue (fiche 265, idée D39 de la recette du 19/11 :
 * une relecture vaut surtout avec un regard neuf) : du même groupe (même fournisseur) d'abord,
 * sinon le premier autre ; `null` s'il n'y en a pas.
 */
export function otherModel(
  control: Pick<SessionControl, 'type' | 'currentValue' | 'options'>
): string | null {
  if (control.type !== 'select') return null
  const current = String(control.currentValue)
  const group = control.options.find((o) => o.value === current)?.group
  // Jamais un modèle refusé faute de connexion (fiche 210).
  const others = control.options.filter((o) => o.value !== current && !o.authRequired)
  return (others.find((o) => group !== undefined && o.group === group) ?? others[0])?.value ?? null
}

/**
 * « Faire relire… » (fiche 177) : ce que relit la relecture, les points à surveiller, l'agent et
 * le modèle — l'agent de la conversation relue et, s'il en a un autre, un autre modèle (fiche 265),
 * suggérés et à confirmer (règle de la fiche 160) —, et ce qu'elle coûte. Rien ne part sans
 * « Lancer la relecture » ; la conversation affichée ne change pas : le rôle Code reviewer répond
 * dans le fil (fiche 265).
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
  // Un autre modèle proposé d'office, une fois lu (fiche 265) ; un choix fait l'emporte.
  const other = model ? otherModel(model) : null
  const shown: ChildChoice =
    choice.modelValue === null && other ? { ...choice, modelValue: other } : choice
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
        ...childChoiceRequest(author, model, shown)
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
            choice={shown}
            onChange={setChoice}
            testId="review"
          />
          <p className="field-help" data-testid="review-suggested">
            {t(other ? 'review.dialog.suggestedOther' : 'review.dialog.suggested')}{' '}
            {t('review.dialog.cost')}
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
