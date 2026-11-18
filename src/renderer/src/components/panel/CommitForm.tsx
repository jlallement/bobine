import { LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DRAFT_TIMEOUT_MS,
  fallbackCommitMessage,
  type CommitDraftPlace,
  type CommitDraftResult
} from '@shared/commit-draft'
import type { CommitFile } from '@shared/worktree-cycle'
import { useCommitDraft, useElapsed } from './useCommitDraft'
import '../../commit-draft.css'

/**
 * Formulaire de commit (fiche 110, partagé par la fiche 123) : message proposé, modifiable, puis
 * « Committer ». Le même dans la barre d'un worktree, la vue Git d'une conversation ordinaire et
 * la carte « fusion refusée » (« Committer d'abord »). `testid` préfixe les identifiants d'essai.
 *
 * Fiche 246 (ADR-0056) : à l'ouverture, le message est **rédigé par l'agent** de la conversation,
 * dans une session à part (« Rédaction par… », « Arrêter ») ; sinon, ou en cas d'échec, un message
 * en anglais déduit des fichiers cochés, qui suit les cases. Un message retouché par l'utilisateur
 * n'est jamais remplacé sans un clic (« Rédiger à nouveau », « Réessayer »).
 */
export function CommitForm({
  conversationId,
  files,
  place,
  busy,
  testid,
  confirmLabel,
  blocked,
  onCommit,
  onCancel
}: {
  /** Conversation dont l'agent rédige le message. */
  conversationId: string
  /** Fichiers cochés en ce moment. */
  files: readonly CommitFile[]
  /** Où se fait le commit : dossier de la conversation, ou racine du dépôt (« Committer d'abord »). */
  place: CommitDraftPlace
  busy: boolean
  testid: string
  /** Libellé du bouton ; « Committer » par défaut. */
  confirmLabel?: string
  /** Raison de ne pas committer (aucun fichier coché, fiche 244) : bouton désactivé, raison écrite. */
  blocked?: string
  onCommit: (message: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const draft = useCommitDraft(conversationId, files, place)
  const { state, round, start } = draft
  // Message retouché, pour cette rédaction : une nouvelle (clic) reprend la main sur lui. Sans
  // retouche, le message suit la proposition.
  const [retouched, setRetouched] = useState<{ round: number; text: string } | null>(null)
  const edited = retouched?.round === round ? retouched.text : null
  const setEdited = (text: string) => setRetouched({ round, text })
  // À l'ouverture, et dès qu'un fichier est coché si aucun ne l'était : la rédaction part.
  const startable = !state && files.length > 0 && !!conversationId
  useEffect(() => {
    if (startable) start()
  }, [startable, start])
  // La rédaction part à l'effet qui suit le premier rendu : d'ici là, déjà « en cours » (sinon
  // « Committer » serait actif un instant, avec le repli, avant d'attendre l'agent).
  const drafting = state?.status === 'drafting' || startable
  const result = state?.status === 'done' ? state.result : undefined
  // Repli : déduit des fichiers cochés en ce moment (il suit les cases, comme avant).
  const proposed = drafting
    ? ''
    : result?.source === 'agent'
      ? result.message
      : files.length > 0
        ? fallbackCommitMessage(files)
        : ''
  const message = edited ?? proposed
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // Message arrivé : curseur à la fin, pour compléter le message plutôt que l'écraser.
    const el = field.current
    if (el && !drafting) el.setSelectionRange(el.value.length, el.value.length)
  }, [drafting])
  return (
    <div className="worktree-form" data-testid={`${testid}-form`}>
      <label className="muted" htmlFor={id}>
        {t('worktreeCycle.commit.message')}
      </label>
      {state?.status === 'drafting' && (
        <Drafting
          agent={state.agentLabel ?? t('worktreeCycle.commit.draft.theAgent')}
          startedAt={state.startedAt}
          testid={testid}
          onStop={draft.stop}
        />
      )}
      <textarea
        id={id}
        ref={field}
        value={message}
        rows={drafting ? 4 : 6}
        autoFocus
        disabled={drafting}
        data-drafting={drafting || undefined}
        placeholder={drafting ? t('worktreeCycle.commit.draft.placeholder') : undefined}
        onChange={(e) => setEdited(e.target.value)}
        data-testid={`${testid}-message`}
      />
      {state?.status === 'done' && (
        <DraftOutcome
          result={state.result}
          count={state.count}
          stale={draft.stale}
          testid={testid}
          onAgain={start}
        />
      )}
      {blocked && (
        <p className="commit-blocked" role="status" data-testid={`${testid}-blocked`}>
          {blocked}
        </p>
      )}
      <div className="worktree-form-actions">
        <button className="btn small ghost" onClick={onCancel} data-testid={`${testid}-cancel`}>
          {t('worktreeCycle.commit.cancel')}
        </button>
        <button
          className="btn small primary"
          disabled={!message.trim() || busy || !!blocked || drafting}
          onClick={() => onCommit(message)}
          data-testid={`${testid}-confirm`}
        >
          {confirmLabel ?? t('worktreeCycle.commit.confirm')}
        </button>
      </div>
    </div>
  )
}

function Drafting({
  agent,
  startedAt,
  testid,
  onStop
}: {
  agent: string
  startedAt: number
  testid: string
  onStop: () => void
}) {
  const { t } = useTranslation()
  const seconds = useElapsed(startedAt, true)
  return (
    <div
      className="commit-draft"
      role="status"
      data-state="drafting"
      data-testid={`${testid}-draft`}
    >
      <LoaderCircle size={13} className="spin" />
      <span>
        {t('worktreeCycle.commit.draft.drafting', { agent })}{' '}
        <span className="commit-draft-time">
          {t('worktreeCycle.commit.draft.seconds', { count: seconds })}
        </span>
      </span>
      <button className="link-button" onClick={onStop} data-testid={`${testid}-draft-stop`}>
        {t('worktreeCycle.commit.draft.stop')}
      </button>
    </div>
  )
}

/** Ligne sous le message : rédigé par l'agent, ou pourquoi le repli ; rien si c'est voulu. */
function DraftOutcome({
  result,
  count,
  stale,
  testid,
  onAgain
}: {
  result: CommitDraftResult
  count: number
  stale: boolean
  testid: string
  onAgain: () => void
}) {
  const { t } = useTranslation()
  if (result.source === 'fallback' && result.reason === 'disabled') return null
  const agent = result.agentLabel || t('worktreeCycle.commit.draft.theAgent')
  const fallback = result.source === 'fallback'
  let text: string
  if (result.source === 'agent') {
    text = stale
      ? t('worktreeCycle.commit.draft.changed')
      : t(
          result.withMemory
            ? 'worktreeCycle.commit.draft.received'
            : 'worktreeCycle.commit.draft.receivedNoMemory',
          { agent, count, seconds: Math.max(1, Math.round(result.ms / 1000)) }
        )
  } else {
    const seconds = Math.round((result.timeoutMs ?? DRAFT_TIMEOUT_MS) / 1000)
    switch (result.reason) {
      case 'timeout':
        text = t('worktreeCycle.commit.draft.reason.timeout', { agent, seconds })
        break
      case 'stopped':
        text = t('worktreeCycle.commit.draft.reason.stopped')
        break
      case 'refused':
        text = t('worktreeCycle.commit.draft.reason.refused', { agent })
        break
      case 'needs-action':
        text = t('worktreeCycle.commit.draft.reason.needsAction', { agent })
        break
      case 'empty':
        text = t('worktreeCycle.commit.draft.reason.empty', { agent })
        break
      case 'too-long':
        text = t('worktreeCycle.commit.draft.reason.tooLong', { agent })
        break
      default:
        text = result.detail
          ? t('worktreeCycle.commit.draft.reason.failedDetail', { agent, detail: result.detail })
          : t('worktreeCycle.commit.draft.reason.failed', { agent })
    }
  }
  return (
    <div
      className={`commit-draft ${fallback ? 'fallback' : 'received'}`}
      role="status"
      data-state={fallback ? 'fallback' : 'agent'}
      data-reason={fallback ? result.reason : undefined}
      data-testid={`${testid}-draft`}
    >
      {fallback ? <TriangleAlert size={13} /> : <Sparkles size={13} />}
      <span>{text}</span>
      <button className="link-button" onClick={onAgain} data-testid={`${testid}-draft-again`}>
        {fallback ? t('worktreeCycle.commit.draft.retry') : t('worktreeCycle.commit.draft.again')}
      </button>
    </div>
  )
}
