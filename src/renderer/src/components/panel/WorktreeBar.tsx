import {
  CircleCheck,
  GitBranch,
  GitMerge,
  GitPullRequestArrow,
  Trash2,
  TriangleExclamationPoint
} from 'lucide-react'
import { CommandText } from '../common/CommandText'
import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { currentLocale } from '@shared/i18n/format'
import {
  mergeBlocker,
  prBlocker,
  requestRef,
  proposeCommitMessage,
  proposePr,
  type CommitFile,
  type MainDirty,
  type MergeOutcome,
  type RemoteBranchOutcome,
  type StashOutcome,
  type WorktreeCycleView
} from '@shared/worktree-cycle'
import { ipcErrorText } from '../../ipc-errors'
import { usePrTrack } from '../../usePrTrack'
import { CommitForm } from './CommitForm'
import { MainDirtyCard, stashSentence } from './MainDirtyCard'
import { PrCard } from './PrCard'
import { useTipsContext } from '../../useTips'
import { TipTab } from '../tips/TipTab'
import {
  forgeKey,
  identityKey,
  prVisibility,
  shownOutcome,
  type Outcome,
  type OutcomeSource,
  type StoredOutcome
} from './worktree-outcome'

/** Ce que la barre a à dire après une action (note sous les boutons). */
type Note =
  | { kind: 'committed'; hash: string }
  | { kind: 'undone' }
  | { kind: 'merged'; base: string; fastForward: boolean; stash?: StashOutcome }
  | { kind: 'nothing'; base: string }
  | { kind: 'dirty'; count: number }
  | { kind: 'aborted' }
  | { kind: 'pr'; url: string; existed: boolean; noun?: 'mr' }

/** Formulaire ou question ouverts sous les boutons. */
type Mode =
  | { kind: 'commit' }
  | { kind: 'pr'; title: string; body: string; noun?: 'mr' }
  | { kind: 'conflicts'; files: string[] }
  | { kind: 'cleanup' }

type Busy = 'commit' | 'pr' | 'merge' | 'resolve' | 'cleanup' | null

/** Ce que les formulaires demandent à la barre. */
interface Actions {
  commit: (message: string) => void
  openPr: (title: string, body: string) => void
  resolve: () => void
  retry: () => void
  abort: () => void
  cleanup: () => void
  close: () => void
}

/**
 * Barre du worktree en tête de la vue « Git » (fiche 110) : d'où il part, son état, puis
 * Committer (fichiers cochés, message proposé), Ouvrir une PR (`gh` détecté), Fusionner dans la
 * base (conflits listés, « Laisser l'agent résoudre »), Nettoyer après la fusion.
 */
export function WorktreeBar({
  conversationId,
  info,
  selected,
  onChanged,
  onCleaned,
  resetKey = 0
}: {
  conversationId: string
  info: WorktreeCycleView
  /** Fichiers cochés dans la liste, à committer. */
  selected: CommitFile[]
  /** Après une action git : l'état et la liste des fichiers sont à relire. */
  onChanged: () => void
  /**
   * Worktree nettoyé après une PR fusionnée : ce qu'il est advenu de la branche distante
   * (0.9.1, D19), dit par l'onglet, la barre disparaissant avec le worktree.
   */
  onCleaned?: (branch: string, remote: RemoteBranchOutcome) => void
  /** Compteur de « Actualiser » : l'issue affichée (erreur ou note) est effacée (fiche 189). */
  resetKey?: number
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode | null>(
    info.merging ? { kind: 'conflicts', files: info.merging.files } : null
  )
  const { note, error, setNote, setError, current } = useWorktreeOutcome(
    conversationId,
    info,
    resetKey
  )
  const [busy, setBusy] = useState<Busy>(null)
  // Fusion refusée d'avance : dossier principal non commité (fiche 123).
  const [mainDirty, setMainDirty] = useState<MainDirty | null>(null)
  // « Mettre de côté » choisi : vaut aussi pour la reprise après un conflit, sans redemander.
  const [stashed, setStashed] = useState(false)
  // Fiche 176 : la PR de la branche, suivie par le main ; relue à chaque état du worktree.
  const pr = usePrTrack(conversationId, info)
  const prMerged = pr?.status === 'found' && pr.pr.state === 'merged'
  // Fiche 189 : une forge sans suivi (GitLab) dit seulement si la MR de la branche est ouverte.
  const forgeOpen = info.pr.ok ? info.pr.open : undefined
  const openPr =
    pr?.status === 'found' && pr.pr.state === 'open'
      ? pr.pr
      : forgeOpen
        ? { title: forgeOpen.title ?? info.title }
        : undefined
  // Mot de la forge (« PR » ou « MR ») : contexte des clés de traduction, dit par le main.
  const noun = info.pr.noun
  const nounContext = noun ? { context: noun } : {}

  /** Lance une action git ; `undefined` si elle a échoué (l'erreur est affichée). */
  const run = async <T,>(
    what: NonNullable<Busy>,
    action: () => Promise<T>
  ): Promise<{ value: T } | undefined> => {
    setBusy(what)
    setError(null)
    const started = current()
    try {
      const value = await action()
      // Réponse d'un autre worktree (la conversation a changé entre-temps) : ignorée.
      return current() === started ? { value } : undefined
    } catch (e: unknown) {
      if (current() === started) setError(ipcErrorText(e), what === 'pr' ? 'forge' : 'git')
      return undefined
    } finally {
      setBusy(null)
    }
  }
  const showMerge = (outcome: MergeOutcome | undefined) => {
    if (!outcome) return
    setMainDirty(outcome.status === 'main-dirty' ? outcome : null)
    if (outcome.status === 'main-dirty') {
      setNote(null)
      setMode(null)
      return
    }
    if (outcome.status === 'conflicts') {
      setNote(null)
      setMode({ kind: 'conflicts', files: outcome.files })
      if (outcome.stash && !outcome.stash.restored) setError(stashSentence(outcome.stash))
    } else if (outcome.status === 'merged') {
      setMode(null)
      setNote({
        kind: 'merged',
        base: outcome.base,
        fastForward: outcome.kind === 'fast-forward',
        ...(outcome.stash ? { stash: outcome.stash } : {})
      })
    } else if (outcome.status === 'nothing') {
      setNote({ kind: 'nothing', base: outcome.base })
    } else {
      setNote({ kind: 'dirty', count: outcome.count })
    }
    onChanged()
  }
  const api = window.api.worktree
  const actions: Actions = {
    commit: async (message) => {
      const files = selected.map((f) => f.path)
      const done = await run('commit', () => api.commit(conversationId, { message, files }))
      if (!done) return
      setMode(null)
      setNote({ kind: 'committed', hash: done.value.hash })
      onChanged()
    },
    openPr: async (title, body) => {
      const outcome = await run('pr', () => api.pullRequest(conversationId, { title, body }))
      if (!outcome) return
      setMode(null)
      setNote({ kind: 'pr', ...outcome.value })
      onChanged()
    },
    resolve: async () =>
      showMerge(
        (
          await run('resolve', () =>
            stashed
              ? api.resolveWithAgent(conversationId, { stash: true })
              : api.resolveWithAgent(conversationId)
          )
        )?.value
      ),
    retry: async () =>
      showMerge(
        (
          await run('merge', () =>
            stashed
              ? api.mergeContinue(conversationId, { stash: true })
              : api.mergeContinue(conversationId)
          )
        )?.value
      ),
    abort: async () => {
      if (!(await run('merge', () => api.mergeAbort(conversationId)))) return
      setMode(null)
      setNote({ kind: 'aborted' })
      onChanged()
    },
    cleanup: async () => {
      const done = await run('cleanup', () => api.cleanup(conversationId))
      if (done?.value.remote) onCleaned?.(info.branch, done.value.remote)
    },
    close: () => setMode(null)
  }
  const undo = async (hash: string) => {
    if (!(await run('commit', () => api.undoCommit(conversationId, hash)))) return
    setNote({ kind: 'undone' })
    onChanged()
  }

  const tips = useTipsContext()
  const offerReview = () => {
    if (tips?.review) tips.offer('review')
  }
  const prWhy = prBlocker(info)
  const prHint = prWhy
    ? t(`worktreeCycle.pr.${prWhy}`, { ...nounContext, host: info.pr.host ?? '' })
    : undefined
  /*
   * Fiche 189 (verdict UX) : grisé quand l'utilisateur peut y remédier (outil absent, non connecté,
   * hôte injoignable) ; forge inconnue → pas de bouton, la raison seulement si la branche a des
   * commits à proposer ; pas de dépôt distant → ni bouton ni ligne.
   */
  const { button: showPrButton, line: prLine } = prVisibility(info, prWhy, {
    open: !!openPr,
    merged: prMerged
  })
  const mergeWhy = mergeBlocker(info)
  const mergeHint =
    mergeWhy === 'dirty'
      ? t('worktreeCycle.merge.dirty', { count: info.dirty })
      : mergeWhy === 'nothing'
        ? t('worktreeCycle.merge.nothing', { base: info.baseBranch })
        : undefined

  return (
    <div className="worktree-bar" data-testid="worktree-bar">
      <WorktreeStart info={info} />
      <div className="worktree-actions">
        <button
          className="btn small"
          disabled={selected.length === 0 || busy !== null || !!info.merging}
          onClick={() => setMode({ kind: 'commit' })}
          data-testid="worktree-commit"
        >
          {selected.length > 0
            ? t('worktreeCycle.commit.actionCount', { count: selected.length })
            : t('worktreeCycle.commit.action')}
        </button>
        {/* Fiche 176 : PR ouverte → « Pousser vers la PR », caché sans rien à pousser ; PR fusionnée → caché. */}
        {showPrButton && (
          <button
            className="btn small"
            disabled={!!prHint || busy !== null}
            aria-disabled={!!prHint || busy !== null}
            // Rien à proposer : l'explication reste en bulle (pas de ligne pour ce cas).
            title={prWhy === 'nothing' ? prHint : undefined}
            onClick={() =>
              openPr
                ? actions.openPr(openPr.title, '')
                : setMode({
                    kind: 'pr',
                    ...proposePr(info.title, info.commits, []),
                    ...(noun ? { noun } : {})
                  })
            }
            data-testid="worktree-pr"
          >
            <GitPullRequestArrow size={13} />
            {openPr
              ? busy === 'pr'
                ? t('worktreeCycle.pr.working', nounContext)
                : t('worktreeCycle.pr.pushToPr', nounContext)
              : t('worktreeCycle.pr.open', nounContext)}
          </button>
        )}
        <button
          className="btn small"
          disabled={!!mergeHint || busy !== null}
          title={mergeHint}
          onClick={async () =>
            showMerge((await run('merge', () => api.merge(conversationId)))?.value)
          }
          // Gros changement pas encore relu : l'astuce « Faire relire » (fiche 191).
          onMouseEnter={offerReview}
          onFocus={offerReview}
          data-testid="worktree-merge"
        >
          <GitMerge size={13} />
          {busy === 'merge'
            ? t('worktreeCycle.merge.working')
            : t('worktreeCycle.merge.action', { base: info.baseBranch })}
        </button>
        {(info.merged || prMerged) && (
          <button
            className="btn small"
            disabled={busy !== null}
            onClick={() => setMode({ kind: 'cleanup' })}
            data-testid="worktree-cleanup"
          >
            <Trash2 size={13} />
            {t('worktreeCycle.cleanup.action')}
          </button>
        )}
      </div>
      {tips?.current === 'review' && tips.review && (
        <TipTab
          id="review"
          placement="card"
          actions={[
            {
              label: t('review.action'),
              run: () => {
                tips.used('review')
                tips.review?.()
              },
              testId: 'tip-review'
            }
          ]}
          onNever={() => tips.never('review')}
          onClose={tips.close}
        >
          {t('tips.review.text')}
        </TipTab>
      )}
      {prLine && (
        <PrBlockerLine unknown={prWhy === 'unknownForge'} host={info.pr.host} hint={prHint} />
      )}
      <PrCard conversationId={conversationId} track={pr} onRefresh={onChanged} />
      {mode && (
        <WorktreeForm
          mode={mode}
          // 0.11, D4 : le message proposé suit les cases cochées tant qu'il n'est pas retouché.
          commitProposal={proposeCommitMessage(info.title, selected)}
          busy={busy}
          branch={info.branch}
          remoteToo={prMerged}
          actions={actions}
        />
      )}
      {mainDirty && (
        <MainDirtyCard
          dirty={mainDirty}
          busy={busy !== null}
          onCommit={async (message, files) => {
            if (!(await run('merge', () => api.commitMain(conversationId, { message, files })))) {
              return
            }
            showMerge((await run('merge', () => api.merge(conversationId)))?.value)
          }}
          onStash={async () => {
            setStashed(true)
            showMerge((await run('merge', () => api.merge(conversationId, { stash: true })))?.value)
          }}
        />
      )}
      {error && (
        <div className="browser-error git-error" data-testid="worktree-error">
          <CommandText text={error} />
        </div>
      )}
      {/* Le lien de la PR est sur la carte : la note ne le répète pas. */}
      {note && !(note.kind === 'pr' && pr?.status === 'found') && (
        <WorktreeNote note={note} busy={busy} onUndo={undo} />
      )}
    </div>
  )
}

/** D'où part le worktree, l'avertissement sur le dossier d'origine, et son état. */
function WorktreeStart({ info }: { info: WorktreeCycleView }) {
  const { t } = useTranslation()
  const date = info.baseDate
    ? new Date(info.baseDate).toLocaleString(currentLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : ''
  const state: string[] = []
  if (info.ahead > 0) state.push(t('worktreeCycle.state.ahead', { count: info.ahead }))
  if (info.behind > 0) {
    state.push(t('worktreeCycle.state.behind', { count: info.behind, base: info.baseBranch }))
  }
  if (info.dirty > 0) state.push(t('worktreeCycle.state.dirty', { count: info.dirty }))
  return (
    <>
      <div className="worktree-start" data-testid="worktree-start">
        <GitBranch size={13} />
        <span className="mono">{info.branch}</span>
        <span className="muted">
          {info.baseBranch
            ? t('worktreeCycle.start.from', { branch: info.baseBranch, hash: info.baseShort, date })
            : t('worktreeCycle.start.fromDetached', { hash: info.baseShort, date })}
          {info.baseSubject
            ? ` ${t('worktreeCycle.start.subject', { subject: info.baseSubject })}`
            : ''}
        </span>
      </div>
      {!!info.dirtyAtStart && (
        <div className="worktree-warning" data-testid="worktree-dirty-at-start">
          <TriangleExclamationPoint size={13} />
          {t('worktreeCycle.start.dirty', { count: info.dirtyAtStart })}
        </div>
      )}
      <div className="worktree-state muted" data-testid="worktree-state">
        {info.merging
          ? t('worktreeCycle.state.merging', { count: info.merging.files.length })
          : info.merged
            ? t('worktreeCycle.state.merged', { base: info.baseBranch })
            : state.join(' · ')}
      </div>
    </>
  )
}

/** Le formulaire ouvert : message de commit, PR, conflits, ou la question du nettoyage. */
function WorktreeForm({
  mode,
  commitProposal,
  busy,
  branch,
  remoteToo,
  actions
}: {
  mode: Mode
  /** Message de commit proposé pour les fichiers cochés en ce moment. */
  commitProposal: string
  busy: Busy
  branch: string
  /** PR fusionnée : la branche part aussi sur GitHub (0.9.1, D19). */
  remoteToo: boolean
  actions: Actions
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(mode)
  const current = draft.kind === mode.kind ? draft : mode
  const cancel = (
    <button className="btn small ghost" onClick={actions.close}>
      {t('worktreeCycle.commit.cancel')}
    </button>
  )
  switch (current.kind) {
    case 'commit':
      return (
        <CommitForm
          proposed={commitProposal}
          busy={busy !== null}
          testid="worktree-commit"
          onCommit={actions.commit}
          onCancel={actions.close}
        />
      )
    case 'pr':
      return (
        <div className="worktree-form" data-testid="worktree-pr-form">
          <label className="muted" htmlFor="worktree-pr-title">
            {t('worktreeCycle.pr.title')}
          </label>
          <input
            id="worktree-pr-title"
            value={current.title}
            autoFocus
            onChange={(e) => setDraft({ ...current, title: e.target.value })}
            data-testid="worktree-pr-title"
          />
          <label className="muted" htmlFor="worktree-pr-body">
            {t('worktreeCycle.pr.body')}
          </label>
          <textarea
            id="worktree-pr-body"
            value={current.body}
            rows={6}
            onChange={(e) => setDraft({ ...current, body: e.target.value })}
            data-testid="worktree-pr-body"
          />
          <div className="worktree-form-actions">
            {cancel}
            <button
              className="btn small primary"
              disabled={!current.title.trim() || busy !== null}
              onClick={() => actions.openPr(current.title, current.body)}
              data-testid="worktree-pr-confirm"
            >
              {busy === 'pr'
                ? t('worktreeCycle.pr.working', current.noun ? { context: current.noun } : {})
                : t('worktreeCycle.pr.confirm', current.noun ? { context: current.noun } : {})}
            </button>
          </div>
        </div>
      )
    case 'conflicts':
      return (
        <div className="worktree-form worktree-conflicts" data-testid="worktree-conflicts">
          <div>{t('worktreeCycle.merge.conflicts', { count: current.files.length })}</div>
          <ul className="mono">
            {current.files.map((file) => (
              <li key={file} data-testid="worktree-conflict-file">
                {file}
              </li>
            ))}
          </ul>
          <div className="worktree-form-actions">
            <button
              className="btn small ghost"
              disabled={busy !== null}
              onClick={actions.abort}
              data-testid="worktree-merge-abort"
            >
              {t('worktreeCycle.merge.abort')}
            </button>
            <button
              className="btn small"
              disabled={busy !== null}
              onClick={actions.retry}
              data-testid="worktree-merge-retry"
            >
              {t('worktreeCycle.merge.retry')}
            </button>
            <button
              className="btn small primary"
              disabled={busy !== null}
              onClick={actions.resolve}
              data-testid="worktree-merge-resolve"
            >
              {busy === 'resolve'
                ? t('worktreeCycle.merge.resolving')
                : t('worktreeCycle.merge.resolve')}
            </button>
          </div>
        </div>
      )
    case 'cleanup':
      return (
        <div className="worktree-form" data-testid="worktree-cleanup-ask">
          <span>
            <Trans
              t={t}
              i18nKey={remoteToo ? 'worktreeCycle.cleanup.askRemote' : 'worktreeCycle.cleanup.ask'}
              values={{ branch }}
              components={{ code: <code /> }}
            />
          </span>
          <div className="worktree-form-actions">
            <button className="btn small ghost" onClick={actions.close}>
              {t('worktreeCycle.cleanup.keep')}
            </button>
            <button
              className="btn small danger"
              disabled={busy !== null}
              onClick={actions.cleanup}
              data-testid="worktree-cleanup-confirm"
            >
              {t('worktreeCycle.cleanup.confirm')}
            </button>
          </div>
        </div>
      )
  }
}

/** Ce que la dernière action a donné ; un commit peut être défait tant qu'il est le dernier. */
function WorktreeNote({
  note,
  busy,
  onUndo
}: {
  note: Note
  busy: Busy
  onUndo: (hash: string) => void
}) {
  const { t } = useTranslation()
  const text = () => {
    switch (note.kind) {
      case 'committed':
        return t('worktreeCycle.commit.done', { hash: note.hash.slice(0, 7) })
      case 'undone':
        return t('worktreeCycle.commit.undone')
      case 'merged': {
        const merged = t(
          note.fastForward ? 'worktreeCycle.merge.fastForward' : 'worktreeCycle.merge.merge',
          { base: note.base }
        )
        return note.stash ? `${merged} ${stashSentence(note.stash)}` : merged
      }
      case 'nothing':
        return t('worktreeCycle.merge.nothing', { base: note.base })
      case 'dirty':
        return t('worktreeCycle.merge.dirty', { count: note.count })
      case 'aborted':
        return t('worktreeCycle.merge.aborted')
      case 'pr':
        return (
          <Trans
            t={t}
            i18nKey={
              note.noun
                ? note.existed
                  ? 'worktreeCycle.pr.existed_mr'
                  : 'worktreeCycle.pr.created_mr'
                : note.existed
                  ? 'worktreeCycle.pr.existed'
                  : 'worktreeCycle.pr.created'
            }
            values={{ name: requestRef(note.url) }}
            components={{
              anchor: (
                <a
                  href={note.url}
                  title={note.url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="worktree-pr-link"
                />
              )
            }}
          />
        )
    }
  }
  return (
    <div className="panel-note worktree-note" data-testid="worktree-note">
      <CircleCheck size={13} />
      <span>{text()}</span>
      {note.kind === 'committed' && (
        <button
          className="btn small ghost"
          disabled={busy !== null}
          onClick={() => onUndo(note.hash)}
          data-testid="worktree-commit-undo"
        >
          {t('worktreeCycle.commit.undo')}
        </button>
      )}
    </div>
  )
}

/** Raison sous les boutons : outil à installer ou connecter, ou forge inconnue (commande en code). */
function PrBlockerLine({
  unknown,
  host,
  hint
}: {
  unknown: boolean
  host: string | undefined
  hint: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className="worktree-hint muted" data-testid="worktree-pr-blocker">
      {unknown && !host ? (
        t('worktreeCycle.pr.unknownForge_nohost')
      ) : unknown ? (
        <Trans
          t={t}
          i18nKey="worktreeCycle.pr.unknownForge"
          values={{ host: host ?? '' }}
          components={{ code: <code /> }}
        />
      ) : (
        hint
      )}
    </div>
  )
}

/**
 * Issue unique de la barre (fiche 189) : rangée avec le worktree, l'état de la forge et le compteur
 * de « Actualiser » du moment où elle est posée (références suivies par le rendu : une réponse
 * tardive est rangée avec l'état du moment). `current()` : le worktree affiché maintenant.
 */
function useWorktreeOutcome(conversationId: string, info: WorktreeCycleView, reset: number) {
  const [stored, setStored] = useState<StoredOutcome<Note> | null>(null)
  const identity = identityKey(conversationId, info)
  const forge = forgeKey(info)
  const now = useRef({ identity, forge, reset })
  useEffect(() => {
    now.current = { identity, forge, reset }
  }, [identity, forge, reset])
  const shown = shownOutcome(stored, identity, forge, reset)
  const store = (value: Outcome<Note> | null, source: OutcomeSource) =>
    setStored(value ? { ...now.current, source, value } : null)
  return {
    note: shown?.kind === 'note' ? shown.note : null,
    error: shown?.kind === 'error' ? shown.text : null,
    setNote: (value: Note | null) =>
      store(value && { kind: 'note', note: value }, value?.kind === 'pr' ? 'forge' : 'git'),
    setError: (text: string | null, source: OutcomeSource = 'git') =>
      store(text ? { kind: 'error', text } : null, source),
    current: () => now.current.identity
  }
}
