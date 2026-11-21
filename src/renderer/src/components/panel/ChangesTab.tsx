import { FileDiff, FileText } from 'lucide-react'
import { CommandText } from '../common/CommandText'
import { diffFeedback, sameDiff, type DiffNote } from '@shared/diff-notes'
import { openOutcomeNote } from '@shared/file-links'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  changesSummary,
  conversationChanges,
  relativeTo,
  type GitChanges,
  type GitFileDiff,
  type RevertOutcome
} from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import { reviewerOfNote, useDiffNotes } from '../../diff-notes-store'
import type { DiffAnnotations } from '../thread/DiffView'
import { useTranslation } from 'react-i18next'
import { chosenView, rememberView } from '../../changes-view-memory'
import { ipcErrorText } from '../../ipc-errors'
import { useWorktreeCycle } from '../../useWorktreeCycle'
import { FolderCommitBar } from './FolderCommitBar'
import { WorktreeBar } from './WorktreeBar'
import { WorktreeCleaned, rememberCleaned, useCleanedNote } from './WorktreeCleaned'
import { ChangesFileList, GIT_BADGES, type Row } from './ChangesList'
import { ChangesViews, DiffNotesBar } from './ChangesBars'
import type { FileTarget } from '@shared/files'
import { noteTarget } from '../../file-notes'
import { ElsewhereNotes } from '../files/FilesParts'
import { useFileRootPaths, workDone } from '../files/useFilesTab'
import { ChildrenView, type ChildWorktreesMerge } from './ChildrenView'
import { ReviewNotes, useReviewImport } from './ReviewNotes'
import { ReviewFileDiff } from './ReviewFileDiff'
import type { DiffTarget } from '@shared/review'
import type { ChildRow } from '@shared/children-rows'
import { countText } from '@shared/i18n/format'

/** Ce que montre l'onglet : les modifications de l'agent, ou l'état du dépôt git. */
export type ChangesView = 'conversation' | 'git' | 'children'
/** … ou les worktrees des filles de la conversation (fiche 161). */
type View = ChangesView

/** Filles directes de la conversation (fiche 161) : la vue « Filles », seulement s'il y en a. */
export interface ChildWorktrees {
  rows: ChildRow[]
  /** Fusion des filles (fiche 120) : la vue dit « Fusionnée » comme la carte (fiche 258, D11). */
  merge?: ChildWorktreesMerge
  onOpen: (id: string) => void
  /** « Faire relire… » une fille (fiche 177). */
  onReview?: (id: string) => void
  /** « Parcourir les fichiers » d'une fille : sa conversation, onglet Fichiers (fiche 271, Q7). */
  onBrowse?: (id: string) => void
}

/** Pourquoi une modification n'a pas été annulée (le fil le dit aussi). */
const REVERT_FAILURES = ['conflict', 'outside', 'failed'] as const
const isRevertFailure = (outcome: RevertOutcome): outcome is (typeof REVERT_FAILURES)[number] =>
  (REVERT_FAILURES as readonly RevertOutcome[]).includes(outcome)

/** La ligne d'un fichier à montrer dans la vue Git (fiche 265). */
const lineFocus = (file: ReviewFileRequest | undefined, seq: number) =>
  file?.line ? { file: file.path, from: file.line, to: file.endLine ?? file.line, seq } : undefined

/** Fichier d'une remarque du Code reviewer à ouvrir (fiche 265). */
type ReviewFileRequest = DiffTarget

/**
 * Au-dessus des fichiers : les remarques en attente et leur envoi, celles d'une relecture
 * (fiche 177), et le diff d'une remarque d'une branche ou d'un commit relus (fiche 265).
 */
function NotesBars({
  conversationId,
  diffNotes,
  onSendNotes,
  onShowNote,
  fileAsked,
  seq,
  refresh,
  onOpenFile,
  rootsKey,
  done
}: {
  conversationId: string
  diffNotes: ReturnType<typeof useDiffNotes>
  onSendNotes: ChangesTabProps['onSendNotes']
  onShowNote: (note: DiffNote) => void
  onOpenFile: ChangesTabProps['onOpenFile']
  fileAsked: ReviewFileRequest | undefined
  seq: number
  /** État du dépôt relu (vue Git) : le diff d'une remarque relu avec lui (fiche 267, N2). */
  refresh: unknown
  rootsKey: string | undefined
  /** Outils finis : les dossiers sont relus à chaque fin, comme dans l'onglet Fichiers. */
  done: number
}) {
  const { t } = useTranslation()
  // Dossiers de la conversation, pour situer ses remarques sur des fichiers (onglet Fichiers).
  const fileNotes = diffNotes.notes.filter((n) => n.view === 'file')
  const hasFileNotes = fileNotes.length > 0
  const rootPaths = useFileRootPaths(conversationId, hasFileNotes, rootsKey, done)
  // Remarques d'une relecture envoyées d'ici : la carte du Code reviewer le sait (`about`) et ne
  // propose plus de les faire corriger une seconde fois (fiche 265, revue UX).
  const sendNotes = () => {
    if (!onSendNotes || diffNotes.notes.length === 0) return
    const reviewer = diffNotes.notes.map(reviewerOfNote).find(Boolean)
    onSendNotes(diffFeedback(diffNotes.notes), reviewer)
    diffNotes.clear()
  }
  return (
    <>
      {onSendNotes && diffNotes.notes.length > 0 && (
        <DiffNotesBar
          count={diffNotes.notes.length}
          fix={diffNotes.notes.every((n) => n.review)}
          onClear={diffNotes.clear}
          onSend={sendNotes}
        />
      )}
      {onSendNotes && fileNotes.length > 0 && (
        // Remarques sur des fichiers (onglet Fichiers) : comptées ici, donc montrées ici, même
        // avant de savoir où sont leurs dossiers (non situées) ; un clic ouvre le fichier à la
        // ligne (3e revue, 4 ; 4e revue, G2, G3).
        <div className="review-notes changes-file-notes" data-testid="changes-file-notes">
          <div className="review-notes-title">
            <FileText size={13} aria-hidden /> {t('files.notesOnFiles')}
          </div>
          <ElsewhereNotes
            notes={fileNotes}
            rootPaths={rootPaths}
            onDelete={diffNotes.remove}
            onOpen={
              onOpenFile &&
              ((note) => {
                const target = rootPaths && noteTarget(note, rootPaths)
                if (target) onOpenFile(target)
              })
            }
          />
        </div>
      )}
      {onSendNotes && (
        <ReviewNotes
          notes={diffNotes.notes.filter((n) => n.review)}
          onShow={onShowNote}
          onRemove={diffNotes.remove}
        />
      )}
      {fileAsked?.since && (
        <ReviewFileDiff
          conversationId={conversationId}
          path={fileAsked.path}
          since={fileAsked.since}
          until={fileAsked.until}
          refresh={refresh}
          focus={lineFocus(fileAsked, seq)}
        />
      )}
    </>
  )
}

interface ChangesTabProps {
  conversationId: string
  workspace?: string
  items: TranscriptItem[]
  /** Vue demandée à l'ouverture (puce de branche : `git`, fiche 049). */
  initialView?: ChangesView
  /** Numéro de la demande d'ouverture : une demande déjà servie n'impose plus sa vue. */
  initialViewSeq?: number
  /**
   * Fichier à ouvrir d'emblée, et sa ligne à montrer et mettre en avant si le diff la contient
   * (remarque du Code reviewer cliquée sur sa carte, fiche 265).
   */
  initialFile?: ReviewFileRequest
  /** Remarques sur les modifications (fiche 085) : envoie le message à l'agent. */
  onSendNotes?: (text: string, about?: string) => void
  /** Filles de la conversation (fiche 161) ; vue « Filles » seulement s'il y en a. */
  childWorktrees?: ChildWorktrees | undefined
  /** « Faire relire… » cette conversation (fiche 177) ; proposé seulement dans un dépôt git. */
  onReview?: (() => void) | undefined
  /** Une remarque sur un fichier cliquée : le fichier dans l'onglet Fichiers, à la ligne. */
  onOpenFile?: ((target: FileTarget) => void) | undefined
  /** Dossiers de la conversation (clé) : les remarques sur des fichiers sont resituées s'ils changent. */
  rootsKey?: string | undefined
}

/**
 * Onglet « Modifications » (fiche 021), comme le panneau de diff de Claude Code Desktop : ce que
 * l'agent a modifié dans la conversation (diffs ACP), ou l'état du dépôt git par rapport au
 * dernier commit.
 */
export function ChangesTab({
  conversationId,
  workspace,
  items,
  initialView,
  initialViewSeq,
  initialFile,
  onSendNotes,
  childWorktrees,
  onReview,
  onOpenFile,
  rootsKey
}: ChangesTabProps) {
  const { t } = useTranslation()
  const conversation = useMemo(() => conversationChanges(items), [items])
  const toolsDone = workDone(items)
  const [git, setGit] = useState<GitChanges | null | undefined>(undefined)
  const [gitError, setGitError] = useState<string | null>(null)
  // « Actualiser » : compteur passé à la barre du worktree, qui efface sa dernière issue (fiche 189).
  const [resets, setResets] = useState(0)
  // Vue choisie, gardée par conversation (fiche 185, F5) : le panneau replié faute de place puis
  // rouvert revient sur la même vue.
  // Une demande d'ouverture (puce de branche…) ne vaut qu'une fois : remonté ensuite, l'onglet
  // revient sur le dernier choix.
  // Fichier demandé (remarque du Code reviewer, fiche 265) : une fois par demande, pas à chaque
  // remontage de l'onglet (revue QA).
  const [fileAsked] = useState(() =>
    initialFile && (initialViewSeq ?? 0) > (chosenView<View>(conversationId)?.seq ?? 0)
      ? initialFile
      : undefined
  )
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
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(fileAsked && !fileAsked.since ? [fileAsked.path] : [])
  )
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
  // Remarques des relectures de ce travail (fiche 177), reprises une fois en remarques de diff ;
  // pas celles d'un travail relu affichées dans ce fil (fiche 265).
  useReviewImport(items, diffNotes.addAll, !!onSendNotes, conversationId)
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
  // Fiche 246, D4 : un commit ou une fusion faits par Bobine hors de ce panneau (carte du fil,
  // barre d'une autre conversation du même dépôt) : l'état du dépôt est relu, sans « Actualiser ».
  const cycleRefresh = cycle.refresh
  useEffect(
    () =>
      window.api.changes.onGitChanged?.(({ conversationIds }) => {
        if (!conversationIds.includes(conversationId)) return
        refresh()
        cycleRefresh()
      }),
    [conversationId, refresh, cycleRefresh]
  )

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
        <ChildrenView {...childWorktrees} />
      ) : (
        <>
          <NotesBars
            conversationId={conversationId}
            diffNotes={diffNotes}
            onSendNotes={onSendNotes}
            onShowNote={showNote}
            fileAsked={fileAsked}
            seq={initialViewSeq ?? 0}
            refresh={git}
            onOpenFile={onOpenFile}
            rootsKey={rootsKey}
            done={toolsDone}
          />
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
              conversationId={conversationId}
              selected={checked.map((f) => ({ path: f.path, status: f.status }))}
              commit={(message, files) =>
                window.api.changes.commit(conversationId, { message, files })
              }
              undo={(hash) => window.api.changes.undoCommit(conversationId, hash)}
              onChanged={refresh}
            />
          )}

          {rows.length === 0 ? (
            <ChangesEmpty view={view} git={!!git} compact={view === 'git' && !!fileAsked?.since} />
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
                focus={fileAsked?.since ? undefined : lineFocus(fileAsked, initialViewSeq ?? 0)}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Rien à montrer dans la vue ; `compact` : un diff relu est affiché au-dessus (fiche 267, revue
 * UX), l'état vide tient en une ligne discrète.
 */
function ChangesEmpty({ view, git, compact }: { view: View; git: boolean; compact: boolean }) {
  const { t } = useTranslation()
  if (compact) {
    return (
      <p className="changes-caption changes-empty-line" data-testid="changes-empty">
        {t('changes.empty.git')}
      </p>
    )
  }
  return (
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
  )
}
