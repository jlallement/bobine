import { CircleCheck, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { RemoteBranchOutcome } from '@shared/worktree-cycle'

/** Ce que « Nettoyer » a fait de la branche distante. */
export interface Cleaned {
  branch: string
  remote: RemoteBranchOutcome
}

/** Délai pendant lequel l'onglet qui suit le nettoyage peut reprendre la note. */
const HANDOFF_MS = 10_000

// Le nettoyage archive la conversation et en affiche une autre : l'onglet Modifications est
// remonté. La note passe donc par ce relais, repris une fois, dans les secondes qui suivent, par
// l'onglet affiché ; elle reste ensuite attachée à sa conversation (remarque 7).
let pending: { cleaned: Cleaned; at: number } | null = null
const listeners = new Set<(cleaned: Cleaned) => void>()

/** Retient la note du nettoyage pour l'onglet Modifications affiché (ou celui qui suit). */
export function rememberCleaned(cleaned: Cleaned): void {
  pending = { cleaned, at: Date.now() }
  for (const listener of listeners) listener(cleaned)
}

/** Note reprise maintenant, si le nettoyage vient d'avoir lieu ; personne d'autre ne la verra. */
function takePending(): Cleaned | null {
  const taken = pending && Date.now() - pending.at < HANDOFF_MS ? pending.cleaned : null
  pending = null
  return taken
}

/**
 * Note du dernier nettoyage pour l'onglet de cette conversation : prise une fois, oubliée quand la
 * conversation change, et masquable.
 */
export function useCleanedNote(conversationId: string): {
  cleaned: Cleaned | null
  dismiss: () => void
} {
  const [note, setNote] = useState<{ id: string; cleaned: Cleaned } | null>(() => {
    const taken = takePending()
    return taken ? { id: conversationId, cleaned: taken } : null
  })
  useEffect(() => {
    const listener = (next: Cleaned) => {
      if (takePending()) setNote({ id: conversationId, cleaned: next })
    }
    listeners.add(listener)
    return () => void listeners.delete(listener)
  }, [conversationId])
  const dismiss = useCallback(() => setNote(null), [])
  return { cleaned: note?.id === conversationId ? note.cleaned : null, dismiss }
}

/**
 * Après « Nettoyer » une PR fusionnée (0.9.1, D19) : ce qu'il est advenu de la branche sur
 * GitHub. La barre du worktree a disparu avec lui : l'onglet Modifications le dit.
 */
export function WorktreeCleaned({
  branch,
  remote,
  onDismiss
}: Cleaned & { onDismiss: () => void }) {
  const { t } = useTranslation()
  const code = { code: <code /> }
  const dismiss = (
    <button
      className="icon-button small"
      aria-label={t('worktreeCycle.cleanup.dismiss')}
      title={t('worktreeCycle.cleanup.dismiss')}
      onClick={onDismiss}
      data-testid="worktree-cleaned-dismiss"
    >
      <X size={13} />
    </button>
  )
  if ('error' in remote) {
    return (
      <>
        <div className="panel-note worktree-note" data-testid="worktree-cleaned">
          <CircleCheck size={13} />
          <span>{t('worktreeCycle.cleanup.done')}</span>
          {dismiss}
        </div>
        <div className="browser-error git-error" data-testid="worktree-cleaned-error">
          <Trans
            t={t}
            i18nKey="worktreeCycle.cleanup.remoteFailed"
            values={{ branch, message: remote.error }}
            components={code}
          />
        </div>
      </>
    )
  }
  return (
    <div
      className="panel-note worktree-note"
      data-testid="worktree-cleaned"
      data-remote={'kept' in remote ? 'kept' : 'deleted'}
    >
      <CircleCheck size={13} />
      <span>
        <Trans
          t={t}
          i18nKey={
            'kept' in remote
              ? 'worktreeCycle.cleanup.remoteKept'
              : 'worktreeCycle.cleanup.doneRemote'
          }
          values={{ branch }}
          components={code}
        />
      </span>
      {dismiss}
    </div>
  )
}
