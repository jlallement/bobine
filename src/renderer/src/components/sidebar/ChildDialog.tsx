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
import { LaunchDetails, LaunchLine, useLaunchFolder } from '../thread/LaunchLine'
import { uncommittedOf } from '../../launch-choice'

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
  // Fiches 240 et 262 : le dossier de la mère lu à l'ouverture. Avec du non commité, une ligne
  // discrète le dit (« Partira du dernier commit, sans vos N modifications ») et « Changer… »
  // propose de committer d'abord ; « Lancer » part sans elles, choix porté par la requête. Pas
  // encore lu : « Lancer » attend un instant, pour porter le bon choix.
  const folder = useLaunchFolder(mother.id, true)
  const held = folder.state === undefined
  const [committing, setCommitting] = useState(false)
  const [showFiles, setShowFiles] = useState(false)

  /** `committed` : le commit vient d'être fait, `state` relu après lui. */
  const launch = async (state = folder.state, committed = false) => {
    if (!text.trim() || busy || state === undefined || (committing && !committed)) return
    const uncommitted = uncommittedOf(state, 'without')
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
          {folder.state && (folder.state.place === 'here' || folder.state.dirty) && (
            <div className="launch-place" data-testid="child-launch-place">
              <LaunchLine
                state={folder.state}
                choice="without"
                onChoose={() => {}}
                who="work"
                opinion={false}
                standalone
                committing={committing}
                onCommitting={setCommitting}
                showFiles={showFiles}
                onShowFiles={setShowFiles}
                disabled={busy}
              />
              <LaunchDetails
                state={folder.state}
                committing={committing}
                onCommitting={setCommitting}
                showFiles={showFiles}
                onShowFiles={setShowFiles}
                commit={{
                  conversationId: mother.id,
                  confirmLabel: t('launchLine.commitThenStart'),
                  run: (message, files) =>
                    window.api.conversations.commitForChildren(mother.id, { message, files }),
                  // Commit fait : le dossier relu, le lancement part de ce commit (les décochés
                  // restent : il part sans eux, et c'est dit).
                  onCommitted: () => void folder.read().then((state) => launch(state, true))
                }}
              />
            </div>
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
              disabled={!text.trim() || busy || held || committing}
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
