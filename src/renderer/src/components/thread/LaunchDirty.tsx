import { Eye, TriangleExclamationPoint } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { FolderDirty } from '@shared/launch-folder'
import { proposeCommitMessage } from '@shared/worktree-cycle'
import { ipcErrorText } from '../../ipc-errors'
import { CommitForm } from '../panel/CommitForm'
import { useArmedCard } from './useArmedCard'

/** Fichiers montrés, au plus ; les autres sont comptés (comme « Fusion refusée »). */
const MAX_SHOWN = 6

/**
 * Avant de lancer une fille en worktree (fiche 240, ADR-0055) : le dossier a du non commité, que
 * la fille n'aura pas. Même famille que « Fusion refusée » (`MainDirtyCard`) : nombre, fichiers,
 * commit de départ, puis « Committer d'abord » (message proposé, puis le lancement part) ou
 * « Partir quand même » ; pour des rôles cités avec `@`, l'avis en lecture seule en plus.
 */
export function LaunchDirtyCard({
  dirty,
  who,
  many,
  anywayLabel,
  onCommitted,
  onAnyway,
  onOpinion,
  commit,
  attention = 0
}: {
  dirty: FolderDirty
  /** Qui part, déjà traduit (« les 2 conversations filles »). */
  who: string
  /** Plusieurs filles : accord au pluriel. */
  many: boolean
  anywayLabel: string
  /** Commit fait : le lancement part (la carte, la saisie ou le dialogue s'en chargent). */
  onCommitted: () => void
  onAnyway: () => void
  /** Avis en lecture seule dans ce dossier (rôles cités avec `@` seulement). */
  onOpinion?: () => void
  /** Committe ces fichiers, avec ce message, dans le dépôt de la mère. */
  commit: (message: string, files: string[]) => Promise<unknown>
  /** Change à chaque envoi retenu (Entrée) : le bloc prend le focus pour être vu. */
  attention?: number
}) {
  const { t } = useTranslation()
  const [committing, setCommitting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  // Le bloc arrive après la lecture du dossier et pousse les boutons d'en dessous : un clic de
  // souris visé juste avant (« Lancer ») tomberait sur « Partir quand même ». Ses boutons ne
  // comptent un clic réel que 400 ms après son apparition, comme une carte d'autorisation.
  const { armed, accepts } = useArmedCard(box)
  useEffect(() => {
    if (attention > 0) {
      box.current?.scrollIntoView({ block: 'nearest' })
      box.current?.querySelector<HTMLButtonElement>('[data-testid=launch-dirty-commit]')?.focus()
    }
  }, [attention])
  const { count } = dirty
  const more = count - MAX_SHOWN
  const files = dirty.files.map((f) => f.path)
  const doCommit = async (message: string) => {
    setBusy(true)
    setError(null)
    try {
      await commit(message, files)
      setCommitting(false)
      onCommitted()
    } catch (e) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="main-dirty launch-dirty"
      ref={box}
      role="group"
      aria-live="polite"
      data-testid="launch-dirty"
      data-count={count}
      data-armed={armed ? '' : undefined}
    >
      <div className="main-dirty-title" data-testid="launch-dirty-title">
        <TriangleExclamationPoint size={13} />
        {t(many ? 'launchDirty.titleMany' : 'launchDirty.title', { count, who })}
      </div>
      <ul className="main-dirty-files launch-dirty-files" aria-label={t('launchDirty.files')}>
        {dirty.files.slice(0, MAX_SHOWN).map((file) => (
          <li key={file.path} data-testid="launch-dirty-file">
            {file.path}
          </li>
        ))}
        {more > 0 && (
          <li className="muted">{t('worktreeCycle.mainDirty.more', { count: more })}</li>
        )}
      </ul>
      <div className="main-dirty-why">
        <Trans
          i18nKey={dirty.subject ? 'launchDirty.why' : 'launchDirty.whyBare'}
          values={{ commit: dirty.commit, subject: dirty.subject ?? '' }}
          components={{ code: <code /> }}
        />
      </div>
      {committing ? (
        <CommitForm
          proposed={proposeCommitMessage(dirty.title ?? '', dirty.files)}
          busy={busy}
          testid="launch-dirty-commit"
          confirmLabel={t('launchDirty.commitConfirm')}
          onCommit={(message) => void doCommit(message)}
          onCancel={() => setCommitting(false)}
        />
      ) : (
        <div className="main-dirty-actions">
          <button
            type="button"
            className="btn small primary"
            onClick={(event) => accepts(event) && setCommitting(true)}
            data-testid="launch-dirty-commit"
          >
            {t('launchDirty.commit')}
          </button>
          <span className="grow" />
          <button
            type="button"
            className="btn small ghost"
            onClick={(event) => accepts(event) && onAnyway()}
            data-testid="launch-dirty-anyway"
          >
            {anywayLabel}
          </button>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {onOpinion && !committing && (
        <div className="launch-dirty-opinion">
          <Eye size={13} aria-hidden />
          <span>{t('launchDirty.opinionLead')}</span>
          <button
            type="button"
            className="btn small"
            onClick={(event) => accepts(event) && onOpinion()}
            data-testid="launch-dirty-opinion"
          >
            {t('launchDirty.opinion')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Non commité du dossier d'une mère, lu quand un lancement en worktree se prépare (`wanted`) et
 * relu au retour du focus (un commit fait dans un terminal). `null` : propre ; `undefined` : pas
 * encore lu. `read()` relit et rend le résultat (un envoi qui attend la réponse).
 */
export function useFolderDirty(
  motherId: string | undefined,
  wanted: boolean
): { dirty: FolderDirty | null | undefined; read: () => Promise<FolderDirty | null> } {
  const [state, setState] = useState<{ id: string; dirty: FolderDirty | null }>()
  const read = useCallback(async (): Promise<FolderDirty | null> => {
    if (!motherId) return null
    const dirty = await window.api.conversations.childFolderDirty(motherId).catch(() => null)
    setState({ id: motherId, dirty })
    return dirty
  }, [motherId])
  useEffect(() => {
    if (!wanted || !motherId) return
    let live = true
    const fetch = () =>
      window.api.conversations
        .childFolderDirty(motherId)
        .catch(() => null)
        .then((dirty) => {
          if (live) setState({ id: motherId, dirty })
        })
    void fetch()
    const onFocus = () => void fetch()
    window.addEventListener('focus', onFocus)
    return () => {
      live = false
      window.removeEventListener('focus', onFocus)
    }
  }, [wanted, motherId])
  return { dirty: state && state.id === motherId ? state.dirty : undefined, read }
}
