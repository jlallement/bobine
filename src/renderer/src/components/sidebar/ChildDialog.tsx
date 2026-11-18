import * as Dialog from '@radix-ui/react-dialog'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { ipcErrorText } from '../../ipc-errors'
import {
  ChildOptions,
  childChoiceRequest,
  childModelAllowed,
  useMotherModel,
  type ChildChoice
} from './child-options'
import { LaunchDirtyCard, useFolderDirty } from '../thread/LaunchDirty'

/**
 * « Lancer en parallèle… » (fiche 097) : la consigne d'une conversation fille, son agent et son
 * modèle (`child-options.tsx`), ceux de la mère par défaut. La conversation affichée ne change
 * pas : la fille apparaît sous sa mère.
 */
export function ChildDialog({
  mother,
  profiles,
  onClose
}: {
  mother: ConversationSummary
  profiles: ProfileSummary[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [choice, setChoice] = useState<ChildChoice>({
    profileId: mother.profileId,
    modelValue: null
  })
  const model = useMotherModel(mother.id, childModelAllowed(profiles, mother))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fiche 240 : le dossier de la mère lu à l'ouverture ; avec du non commité, « Lancer » attend le
  // choix (committer d'abord, ou partir quand même). Pas encore lu : « Lancer » attend aussi, sans
  // quoi un clic rapide part sans choix (refusé par le main) ou tombe sous le bloc qui arrive.
  const folder = useFolderDirty(mother.id, true)
  const held = folder.dirty !== null

  /** `committed` : le commit vient d'être fait, le dossier lu au rendu précédent est périmé. */
  const launch = async (after?: 'anyway' | 'committed') => {
    if (!text.trim() || busy || (held && !after)) return
    const uncommitted = after === 'anyway' ? after : undefined
    setBusy(true)
    setError(null)
    try {
      await window.api.conversations.startChild(mother.id, {
        text,
        ...childChoiceRequest(mother, model, choice),
        ...(uncommitted ? { uncommitted } : {})
      })
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
        <Dialog.Content className="dialog confirm-dialog child-dialog" data-testid="child-dialog">
          <Dialog.Title className="confirm-title">{t('children.dialog.title')}</Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('children.dialog.description', { title: mother.title })}
          </Dialog.Description>
          <label className="form-field">
            <span className="field-label">{t('children.dialog.prompt')}</span>
            <textarea
              className="field-input"
              rows={5}
              autoFocus
              value={text}
              placeholder={t('children.dialog.placeholder')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              data-testid="child-prompt"
            />
          </label>
          <ChildOptions
            mother={mother}
            profiles={profiles}
            model={model}
            choice={choice}
            onChange={setChoice}
            testId="child"
          />
          {folder.dirty && (
            <LaunchDirtyCard
              conversationId={mother.id}
              dirty={folder.dirty}
              who={t('launchDirty.whoOne')}
              many={false}
              anywayLabel={t('launchDirty.anyway')}
              commit={async (message, files) => {
                await window.api.conversations.commitForChildren(mother.id, { message, files })
                await folder.read()
              }}
              onCommitted={(left) => void launch(left > 0 ? 'anyway' : 'committed')}
              onAnyway={() => void launch('anyway')}
            />
          )}
          {error && (
            <p className="field-error" role="alert" data-testid="child-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost" disabled={busy}>
              {t('common.cancel')}
            </Dialog.Close>
            <button
              className="btn primary"
              disabled={!text.trim() || busy || held}
              onClick={() => void launch()}
              data-testid="child-launch"
            >
              {busy ? t('children.dialog.launching') : t('children.dialog.launch')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
