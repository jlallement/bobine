import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'

/**
 * « Continuer dans un projet… » (fiche 224, maquette E6) : la discussion part dans une nouvelle
 * conversation de l'espace Code, dans le dossier choisi ensuite (dialogue du système) ; ses
 * documents y sont copiés si la case reste cochée. La discussion reste telle quelle.
 */
export function ContinueInProjectDialog({
  discussion,
  onClose,
  onOpened
}: {
  discussion: ConversationSummary
  onClose: () => void
  /** La nouvelle conversation, à afficher. */
  onOpened: (id: string) => void
}) {
  const { t } = useTranslation()
  const [count, setCount] = useState(0)
  const [copy, setCopy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    void window.api.documents
      .list(discussion.id)
      .then((docs) => setCount(docs.length))
      .catch(() => setCount(0))
  }, [discussion.id])
  const go = () => {
    window.api.documents
      .continueInProject(discussion.id, { copyDocuments: copy && count > 0 })
      .then((view) => {
        if (!view) return
        onClose()
        onOpened(view.summary.id)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog" data-testid="continue-dialog">
          <Dialog.Title className="confirm-title">{t('discussion.continue.title')}</Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('discussion.continue.text')}
          </Dialog.Description>
          {count > 0 && (
            <label className="confirm-option">
              <input
                type="checkbox"
                checked={copy}
                onChange={(e) => setCopy(e.target.checked)}
                data-testid="continue-copy"
              />
              {t('discussion.continue.copy', { count })}
            </label>
          )}
          {error && <p className="confirm-text confirm-warning">{error}</p>}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost">{t('discussion.continue.cancel')}</Dialog.Close>
            <button className="btn primary" onClick={go} data-testid="continue-choose">
              {t('discussion.continue.choose')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Dialogue « Continuer dans un projet… » tenu à part de la fenêtre : l'ouvrir, et son rendu. */
export function useContinueInProject(onOpened: (id: string) => void): {
  open: (discussion: ConversationSummary) => void
  dialog: ReactNode
} {
  const [discussion, setDiscussion] = useState<ConversationSummary | null>(null)
  return {
    open: setDiscussion,
    dialog: discussion && (
      <ContinueInProjectDialog
        discussion={discussion}
        onClose={() => setDiscussion(null)}
        onOpened={onOpened}
      />
    )
  }
}
