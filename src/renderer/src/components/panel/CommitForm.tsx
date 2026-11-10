import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Formulaire de commit (fiche 110, partagé par la fiche 123) : message proposé, modifiable, puis
 * « Committer ». Le même dans la barre d'un worktree, la vue Git d'une conversation ordinaire et
 * la carte « fusion refusée » (« Committer d'abord »). `testid` préfixe les identifiants d'essai.
 *
 * 0.11, D4 : le message proposé suit les cases cochées (il est recalculé par le parent) tant que
 * l'utilisateur ne l'a pas retouché ; une fois retouché, son texte reste. Le curseur est à la fin.
 */
export function CommitForm({
  proposed,
  busy,
  testid,
  confirmLabel,
  onCommit,
  onCancel
}: {
  /** Message proposé pour les fichiers cochés en ce moment. */
  proposed: string
  busy: boolean
  testid: string
  /** Libellé du bouton ; « Committer » par défaut. */
  confirmLabel?: string
  onCommit: (message: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  // `null` : pas retouché, le message suit la proposition.
  const [edited, setEdited] = useState<string | null>(null)
  const message = edited ?? proposed
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // À l'ouverture : curseur à la fin, pour compléter le message plutôt que l'écraser.
    const el = field.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  return (
    <div className="worktree-form" data-testid={`${testid}-form`}>
      <label className="muted" htmlFor={id}>
        {t('worktreeCycle.commit.message')}
      </label>
      <textarea
        id={id}
        ref={field}
        value={message}
        rows={5}
        autoFocus
        onChange={(e) => setEdited(e.target.value)}
        data-testid={`${testid}-message`}
      />
      <div className="worktree-form-actions">
        <button className="btn small ghost" onClick={onCancel} data-testid={`${testid}-cancel`}>
          {t('worktreeCycle.commit.cancel')}
        </button>
        <button
          className="btn small primary"
          disabled={!message.trim() || busy}
          onClick={() => onCommit(message)}
          data-testid={`${testid}-confirm`}
        >
          {confirmLabel ?? t('worktreeCycle.commit.confirm')}
        </button>
      </div>
    </div>
  )
}
