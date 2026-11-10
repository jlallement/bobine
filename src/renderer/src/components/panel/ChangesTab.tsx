import { FileDiff } from 'lucide-react'
import { CommandText } from '../common/CommandText'
import { diffFeedback, sameDiff, type DiffNote } from '@shared/diff-notes'
import { openOutcomeNote } from '@shared/file-links'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  changesSummary,
  conversationChanges,
  relativeTo,
  type GitChanges,
  type GitFileChange,
  type GitFileDiff,
  type RevertOutcome
} from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import { useDiffNotes } from '../../diff-notes-store'
import type { DiffAnnotations } from '../thread/DiffView'
import { useTranslation } from 'react-i18next'
import { chosenView, rememberView } from '../../changes-view-memory'
import { ipcErrorText } from '../../ipc-errors'
import { useWorktreeCycle } from '../../useWorktreeCycle'
import { FolderCommitBar } from './FolderCommitBar'
import { WorktreeBar } from './WorktreeBar'
import { WorktreeCleaned, rememberCleaned, useCleanedNote } from './WorktreeCleaned'
import { ChangesFileList, type Row } from './ChangesList'
import { ChangesViews, DiffNotesBar } from './ChangesBars'
import { ChildrenView } from './ChildrenView'
import { ReviewNotes, useReviewImport } from './ReviewNotes'
import type { ChildRow } from '@shared/children-rows'
import { countText } from '@shared/i18n/format'

/** Ce que montre l'onglet : les modifications de l'agent, ou l'état du dépôt git. */
export type ChangesView = 'conversation' | 'git'
/** … ou les worktrees des filles de la conversation (fiche 161). */
type View = ChangesView | 'children'

/** Filles directes de la conversation (fiche 161) : la vue « Filles », seulement s'il y en a. */
export interface ChildWorktrees {
  rows: ChildRow[]
  onOpen: (id: string) => void
  /** « Faire relire… » une fille (fiche 177). */
  onReview?: (id: string) => void
}

/** Pourquoi une modification n'a pas été annulée (le fil le dit aussi). */
const REVERT_FAILURES = ['conflict', 'outside', 'failed'] as const
const isRevertFailure = (outcome: RevertOutcome): outcome is (typeof REVERT_FAILURES)[number] =>
  (REVERT_FAILURES as readonly RevertOutcome[]).includes(outcome)

/** Pastille d'un fichier dans la vue git ; son libellé : clé `changes.badge.<statut>`. */
const GIT_BADGES: Record<GitFileChange['status'], Omit<NonNullable<Row['badge']>, 'label'>> = {
  modified: { letter: 'M', tone: 'mod' },
  added: { letter: 'A', tone: 'add' },
  untracked: { letter: 'U', tone: 'add' },
  deleted: { letter: 'D', tone: 'del' },
  renamed: { letter: 'R', tone: 'mod' }
}

/**
 * Onglet « Modifications » (fiche 021), comme le panneau de diff de Claude Code Desktop : ce que
 * l'agent a modifié dans la conversation (diffs ACP), ou l'état du dépôt git par rapport au
 * dernier commit.
 */
export function ChangesTab({
  conversationId,
  workspace,
  title,
  items,
  initialView,
  initialViewSeq,
  onSendNotes,
  childWorktrees,
  onReview
}: {
  conversationId: string
  workspace?: string
  /** Titre de la conversation : message de commit proposé hors worktree (fiche 123). */
  title?: string | undefined
  items: TranscriptItem[]
  /** Vue demandée à l'ouverture (puce de branche : `git`, fiche 049). */
  initialView?: ChangesView
  /** Numéro de la demande d'ouverture : une demande déjà servie n'impose plus sa vue. */
  initialViewSeq?: number
  /** Remarques sur les modifications (fiche 085) : envoie le message à l'agent. */
  onSendNotes?: (text: string) => void
  /** Filles de la conversation (fiche 161) ; vue « Filles » seulement s'il y en a. */
  childWorktrees?: ChildWorktrees | undefined
  /** « Faire relire… » cette conversation (fiche 177) ; proposé seulement dans un dépôt git. */
  onReview?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const conversation = useMemo(() => conversationChanges(items), [items])
  const [git, setGit] = useState<GitChanges | null | undefined>(undefined)
  const [gitError, setGitError] = useState<string | null>(null)
  // « Actualiser » : compteur passé à la barre du worktree, qui efface sa dernière issue (fiche 189).
  const [resets, setResets] = useState(0)
  // Vue choisie, gardée par conversation (fiche 185, F5) : le panneau replié faute de place puis
  // rouvert revient sur la même vue.
  // Une demande d'ouverture (puce de branche…) ne vaut qu'une fois : remonté ensuite, l'onglet
  // revient sur le dernier choix.
  const [chosen, setChosenState] = useState<View | null>(() => {
    const remembered = chosenView<View>(conversationId)
    const seq = initialViewSeq ?? 0
    if (initialView && seq > (remembered?.seq ?? 0)) {
      rememberView(conversationId, { view: initialView, seq })
      return initialView
    }
    return remembered?.view ?? null
  })
  const setChosen = (next: View) => {
    rememberView(conversationId, {
      view: next,
      seq: chosenView<View>(conversationId)?.seq ?? initialViewSeq ?? 0
    })
    setChosenState(next)
  }
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [gitDiffs, setGitDiffs] = useState<Record<string, GitFileDiff | { error: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Worktree nettoyé après une PR fusionnée : la branche distante (0.9.1, D19).
  const cleaned = useCleanedNote(conversationId)
  // « Annuler cette modification » (fiche 043) : confirmation en place, puis fichiers remis en état.
  const [reverting, setReverting] = useState<string | null>(null)
  const [reverted, setReverted] = useState<Set<string>>(new Set())
  // Remarques sur les lignes des diffs (fiche 085), gardées par conversation jusqu'à l'envoi.
  const diffNotes = useDiffNotes(conversationId)
  const annotationsFor = (anchor: DiffAnnotations['anchor']): DiffAnnotations | undefined =>
    onSendNotes
      ? {
          anchor,
          notes: diffNotes.notes.filter((n) => sameDiff(n, anchor)),
          onSave: diffNotes.save,
          onDelete: diffNotes.remove
        }
      : undefined
  // Remarques des relectures de ce travail (fiche 177), reprises une fois en remarques de diff.
  useReviewImport(items, diffNotes.addAll, !!onSendNotes)
  const reviewNotes = diffNotes.notes.filter((n) => n.review)
  const sendNotes = () => {
    if (!onSendNotes || diffNotes.notes.length === 0) return
    onSendNotes(diffFeedback(diffNotes.notes))
    diffNotes.clear()
  }
  // Vue par défaut : la conversation si l'agent a modifié quelque chose, sinon git. La vue des
  // filles se ferme d'elle-même quand la dernière fille disparaît.
  const fallback: View = conversation.length === 0 && git ? 'git' : 'conversation'
  const childCount = childWorktrees?.rows.length ?? 0
  const view: View = chosen === 'children' && childCount === 0 ? fallback : (chosen ?? fallback)

  // Outils terminés : l'état du dépôt a pu changer.
  const finished = items.filter((i) => i.kind === 'tool' && i.status === 'completed').length
  // Conversation en worktree (fiche 110) : barre du cycle ; sinon « Committer » seul (fiche 123).
  // Fichiers à cocher dans la vue git, dans les deux cas.
  const cycle = useWorktreeCycle(conversationId, finished)
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  /**
   * État du dépôt relu : les diffs lus avant ne valent plus, ni ceux encore en route (0.11, M2).
   * Chaque relecture change de génération ; une réponse d'une génération passée est jetée.
   */
  const generation = useRef(0)
  const refresh = useCallback(() => {
    window.api.changes
      .git(conversationId)
      .then((next) => {
        generation.current++
        setGit(next)
        setGitError(null)
        setGitDiffs({})
      })
      .catch((e: unknown) => {
        setGit(null)
        setGitError(ipcErrorText(e))
      })
  }, [conversationId])
  useEffect(() => refresh(), [refresh, finished])

  const rows: Row[] =
    view !== 'git'
      ? conversation.map((file) => {
          const path = relativeTo(workspace, file.path)
          return {
            key: file.path,
            path,
            ...(path !== file.path || !file.path.startsWith('/') ? { openable: file.path } : {}),
            ...(file.created
              ? { badge: { letter: 'A', label: t('changes.badge.created'), tone: 'add' as const } }
              : {}),
            added: file.added,
            removed: file.removed
          }
        })
      : (git?.files ?? []).map((file) => ({
          key: file.path,
          path: file.from ? `${file.from} → ${file.path}` : file.path,
          ...(file.status !== 'deleted' ? { openable: file.path } : {}),
          badge: { ...GIT_BADGES[file.status], label: t(`changes.badge.${file.status}`) },
          added: file.added,
          removed: file.removed
        }))
  const summary = changesSummary(rows)
  const checked = (git?.files ?? []).filter((f) => !unchecked.has(f.path))
  const check = (path: string, on: boolean) =>
    setUnchecked((all) => {
      const next = new Set(all)
      if (on) next.delete(path)
      else next.add(path)
      return next
    })

  /**
   * Diff git de chaque fichier déplié de la vue Git, lu une fois par état du dépôt : déplié, ou
   * encore déplié quand le dépôt est relu (un fichier écrit par l'agent, « Actualiser »). Avant,
   * seul le clic le lisait : un diff déplié pendant une relecture restait sur « Chargement… »
   * jusqu'à être replié et redéplié (0.11, M2).
   */
  const asked = useRef(new Set<string>())
  useEffect(() => {
    if (view !== 'git' || !git) return
    const at = generation.current
    for (const key of open) {
      const file = git.files.find((f) => f.path === key)
      const ask = `${at}\u0000${key}`
      if (!file || gitDiffs[key] || asked.current.has(ask)) continue
      asked.current.add(ask)
      const keep = (diff: GitFileDiff | { error: string }) => {
        asked.current.delete(ask)
        // Réponse d'avant une relecture : jetée, la génération en cours a sa propre demande.
        if (generation.current === at) setGitDiffs((all) => ({ ...all, [key]: diff }))
      }
      window.api.changes
        .gitFile(conversationId, file.path, file.from)
        .then(keep)
        .catch((e: unknown) => keep({ error: ipcErrorText(e) }))
    }
  }, [view, git, open, gitDiffs, conversationId])

  const toggle = (row: Row) => {
    const next = new Set(open)
    if (next.has(row.key)) next.delete(row.key)
    else next.add(row.key)
    setOpen(next)
  }

  /** Remarque de relecture : son fichier ouvert en vue Git (s'il y a des modifications non commitées). */
  const showNote = (note: DiffNote) => {
    setChosen('git')
    setOpen((all) => new Set(all).add(note.file))
  }

  const act = (action: 'open' | 'reveal', path: string) => {
    setError(null)
    setNote(null)
    if (action === 'reveal') {
      window.api.changes
        .reveal(conversationId, path)
        .catch((e: unknown) => setError(ipcErrorText(e)))
      return
    }
    // Un fichier qui peut s'exécuter est montré dans le Finder au lieu d'être ouvert (fiche 071).
    window.api.changes
      .open(conversationId, path)
      .then((outcome) => setNote(openOutcomeNote(outcome) ?? null))
      .catch((e: unknown) => setError(ipcErrorText(e)))
  }

  const revert = (path: string) => {
    setReverting(null)
    setError(null)
    window.api.changes
      .revert(conversationId, path)
      .then((outcome) => {
        if (outcome === 'restored' || outcome === 'unchanged') {
          setReverted((all) => new Set(all).add(path))
        } else setError(isRevertFailure(outcome) ? t(`changes.revertFailed.${outcome}`) : outcome)
        refresh()
      })
      .catch((e: unknown) => setError(ipcErrorText(e)))
  }

  return (
    <div className="changes-tab" data-testid="changes-tab">
      <ChangesViews
        view={view}
        conversationCount={conversation.length}
        {...(git ? { git } : {})}
        childCount={childCount}
        onChoose={setChosen}
        onRefresh={() => {
          // « Actualiser » relit aussi la barre du worktree (fiche 176, D15).
          refresh()
          cycle.refresh(true)
          setResets((n) => n + 1)
        }}
        onReview={onReview}
      />
      {view === 'children' && childWorktrees ? (
        <ChildrenView
          rows={childWorktrees.rows}
          onOpen={childWorktrees.onOpen}
          onReview={childWorktrees.onReview}
        />
      ) : (
        <>
          {onSendNotes && diffNotes.notes.length > 0 && (
            <DiffNotesBar
              count={diffNotes.notes.length}
              onClear={diffNotes.clear}
              onSend={sendNotes}
            />
          )}
          {onSendNotes && (
            <ReviewNotes notes={reviewNotes} onShow={showNote} onRemove={diffNotes.remove} />
          )}
          {error && (
            <div className="browser-error">
              <CommandText text={error} />
            </div>
          )}
          {note && (
            <div className="panel-note" data-testid="changes-note">
              {note}
            </div>
          )}
          {gitError && view === 'git' && (
            <div className="browser-error">
              <CommandText text={gitError} />
            </div>
          )}
          {view === 'git' && cycle.error && <div className="browser-error">{cycle.error}</div>}
          {view === 'git' && cycle.info && (
            <WorktreeBar
              conversationId={conversationId}
              info={cycle.info}
              selected={checked.map((f) => ({ path: f.path, status: f.status }))}
              onChanged={() => {
                refresh()
                cycle.refresh()
              }}
              onCleaned={(branch, remote) => rememberCleaned({ branch, remote })}
              resetKey={resets}
            />
          )}
          {cleaned.cleaned && <WorktreeCleaned {...cleaned.cleaned} onDismiss={cleaned.dismiss} />}
          {view === 'git' && git && cycle.known && !cycle.info && (
            <FolderCommitBar
              title={title ?? ''}
              selected={checked.map((f) => ({ path: f.path, status: f.status }))}
              commit={(message, files) =>
                window.api.changes.commit(conversationId, { message, files })
              }
              undo={(hash) => window.api.changes.undoCommit(conversationId, hash)}
              onChanged={refresh}
            />
          )}

          {rows.length === 0 ? (
            <div className="side-panel-empty" data-testid="changes-empty">
              <FileDiff size={22} />
              <p>
                {view === 'conversation'
                  ? git
                    ? t('changes.empty.conversation')
                    : t('changes.empty.conversationNoGit')
                  : t('changes.empty.git')}
              </p>
            </div>
          ) : (
            <>
              <div className="changes-summary" data-testid="changes-summary">
                {t('changes.files', { count: summary.files })}{' '}
                <span className="diff-added">+{countText(summary.added)}</span>{' '}
                <span className="diff-removed">−{countText(summary.removed)}</span>
                {view === 'git' && <span className="muted"> {t('changes.sinceLastCommit')}</span>}
              </div>
              <ChangesFileList
                view={view === 'git' ? 'git' : 'conversation'}
                rows={rows}
                open={open}
                onToggle={toggle}
                unchecked={unchecked}
                onCheck={check}
                reverted={reverted}
                reverting={reverting}
                setReverting={setReverting}
                onRevert={revert}
                onAct={act}
                conversation={conversation}
                gitDiffs={gitDiffs}
                annotationsFor={annotationsFor}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
