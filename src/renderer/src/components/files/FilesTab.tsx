import { X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject
} from 'react'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import { diffFeedback, type DiffNote } from '@shared/diff-notes'
import { parentDirs, type FileRoot, type FileTarget } from '@shared/files'
import type { TranscriptItem } from '@shared/transcript'
import { reviewerOfNote, useDiffNotes } from '../../diff-notes-store'
import { dirKey, FILE_GOTO_EVENT, TOGGLE_TREE_EVENT } from '../../files-state'
import { fileNoteKey } from '../../file-notes'
import type { OpenFileLink } from '../thread/FileLink'
import { useFileActions } from './FileActions'
import { treeRows } from './FileTree'
import { FileView } from './FileView'
import { NotesBar, TreePane, ViewMenu } from './FilesParts'
import { useFilesTab, type FilesRequest } from './useFilesTab'
import './files.css'

/** Largeur de l'onglet à partir de laquelle, agrandi, l'arbre se met à côté du fichier (Q58). */
export const SIDE_BY_SIDE_MIN = 900

interface Props {
  conversationId: string
  items: TranscriptItem[]
  maximized: boolean
  request?: FilesRequest | undefined
  /** Demande traitée : elle ne se rejoue plus (C1). */
  onRequestDone?: ((seq: number) => void) | undefined
  /** Liens d'un Markdown, page HTML : comme les liens du fil. */
  openLink: OpenFileLink
  onSendNotes?: ((text: string, about?: string) => void) | undefined
  onMention?: ((paths: string[]) => void) | undefined
  onShowDiff?: ((absolutePath: string) => void) | undefined
  /** « Voir » de la barre des remarques : l'onglet Modifications. */
  onShowChanges?: (() => void) | undefined
  /** Échap sur un filtre vide : le clavier revient à la zone de saisie. */
  onFocusComposer?: (() => void) | undefined
  /** Un fichier a été ouvert ou fermé : le titre de l'onglet suit (Q9). */
  onTitle?: () => void
  /** Ce que fait le ✕ de l'onglet : `true` si un fichier ouvert a été fermé (point 3). */
  closeRef?: MutableRefObject<(() => boolean) | null>
}

/** Chemins modifiés par la conversation, relatifs à la racine principale, et leurs dossiers (Q6). */
function changedPaths(items: readonly TranscriptItem[], root: FileRoot | undefined): Set<string> {
  const changed = new Set<string>()
  if (!root) return changed
  const base = root.path
    .replace(/[\\/]+$/, '')
    .split('\\')
    .join('/')
  for (const file of conversationChanges(items)) {
    const path = file.path.split('\\').join('/')
    const relative = path.startsWith(`${base}/`)
      ? path.slice(base.length + 1)
      : path.startsWith('/') || /^[a-z]:\//i.test(path)
        ? undefined
        : path.replace(/^\.\//, '')
    if (!relative) continue
    changed.add(relative)
    for (const dir of parentDirs(relative)) changed.add(dir)
  }
  return changed
}

/** Le fichier affiché est du texte (code, Markdown, SVG en source) : « Aller à la ligne… ». */
function showsText(content: ReturnType<typeof useFilesTab>['content']): boolean {
  return !!content && 'content' in content && content.content.kind !== 'binary'
}

/** Largeur d'un élément, suivie (le seuil du côte à côte, point 15). */
function useElementWidth(element: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = element.current
    // Le premier rappel arrive dès l'observation : la largeur de départ.
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [element])
  return width
}

/**
 * Onglet « Fichiers » du panneau (fiche 271, ADR-0065) : l'arbre du dossier de la conversation et
 * de ses autres dossiers, un filtre (⌘P y met le curseur), et le fichier ouvert, en lecture seule.
 * Panneau étroit : l'arbre ou le fichier (⇧⌘Y bascule) ; agrandi et assez large : côte à côte.
 */
export function FilesTab(props: Props) {
  const { conversationId, items, maximized, request } = props
  const { t } = useTranslation()
  const filter = useRef<HTMLInputElement>(null)
  const focusFilter = useCallback(() => {
    requestAnimationFrame(() => {
      filter.current?.focus()
      filter.current?.select()
    })
  }, [])
  const model = useFilesTab(conversationId, items, {
    request,
    onRequestDone: props.onRequestDone,
    onFocusFilter: focusFilter
  })
  const { state, roots, preferences, view: narrowView, setView: setNarrowView } = model
  const [notice, setNotice] = useState<string | null>(null)
  const changed = useMemo(() => changedPaths(items, roots?.[0]), [items, roots])
  const actions = useFileActions({
    conversationId,
    roots: roots ?? [],
    notify: setNotice,
    ...(props.onMention ? { onMention: props.onMention } : {}),
    ...(props.onShowDiff ? { onShowDiff: props.onShowDiff } : {}),
    changed
  })
  const box = useRef<HTMLDivElement>(null)
  const width = useElementWidth(box)
  const sideBySide = maximized && preferences.tree && !!state.open && width >= SIDE_BY_SIDE_MIN
  const showTree = sideBySide || !state.open || narrowView === 'tree'
  const showFile = !!state.open && (sideBySide || narrowView === 'file')

  // Titre de l'onglet : le fichier ouvert (Q9).
  const { onTitle } = props
  const openPath = state.open ? `${state.open.root}:${state.open.path}` : ''
  useEffect(() => onTitle?.(), [onTitle, openPath])
  // ✕ de l'onglet (point 3) : un fichier ouvert revient d'abord à l'arbre.
  const { closeRef } = props
  const close = useCallback(() => {
    model.close()
    setNarrowView('tree')
  }, [model, setNarrowView])
  useEffect(() => {
    if (!closeRef) return
    closeRef.current = () => {
      if (!state.open) return false
      close()
      return true
    }
    return () => {
      closeRef.current = null
    }
  }, [closeRef, close, state.open])
  // ⇧⌘Y (Q18) : agrandi, l'arbre à côté ou non ; étroit, l'arbre ou le fichier.
  const toggleTree = useCallback(() => {
    if (maximized) model.setPreferences({ tree: !preferences.tree })
    else setNarrowView((view) => (view === 'tree' && state.open ? 'file' : 'tree'))
  }, [maximized, model, preferences.tree, state.open, setNarrowView])
  useEffect(() => {
    const onToggle = () => toggleTree()
    window.addEventListener(TOGGLE_TREE_EVENT, onToggle)
    return () => window.removeEventListener(TOGGLE_TREE_EVENT, onToggle)
  }, [toggleTree])

  const open = (target: FileTarget) => {
    model.show(target)
    setNarrowView('file')
    model.filter.setQuery('')
  }
  const diffNotes = useDiffNotes(conversationId)
  // Dossiers actuels : une remarque dont la cible est introuvable se montre dans la barre.
  const rootPaths = useMemo(() => (roots ?? []).map((r) => r.path), [roots])
  const sendNotes = () => {
    if (!props.onSendNotes || diffNotes.notes.length === 0) return
    props.onSendNotes(
      diffFeedback(diffNotes.notes),
      diffNotes.notes.map(reviewerOfNote).find(Boolean)
    )
    diffNotes.clear()
  }

  if (model.rootsError) {
    return (
      <div className="files-tab" data-testid="files-tab">
        <div className="file-view-note error" data-testid="files-error">
          {model.rootsError}
        </div>
      </div>
    )
  }
  const expanded = new Set([dirKey(0, ''), ...state.expanded])
  const rows = roots ? treeRows(roots, model.listings, expanded) : []
  const target = state.open
  const rootPath = target ? roots?.[target.root]?.path : undefined
  const fileKey = target && rootPath ? fileNoteKey(rootPath, target.path) : ''
  const fileNotes = diffNotes.notes.filter((n) => n.view === 'file' && n.file === fileKey)
  // Remarque sur un autre dossier (fiche 179) : son chemin absolu, l'agent le connaît ainsi.
  const notePath = target ? (target.root === 0 ? target.path : actions.absolute(target)) : ''
  const codeShown = showFile && showsText(model.content)
  // Un seul menu de vue (point 4) : dans l'en-tête du fichier s'il est affiché, sinon sur l'arbre.
  const viewMenu = (
    <ViewMenu
      wrap={preferences.wrap}
      side={preferences.side}
      tree={showTree}
      canGoTo={!!codeShown}
      onFilter={() => {
        setNarrowView('tree')
        requestAnimationFrame(() => filter.current?.focus())
      }}
      onTree={toggleTree}
      onSide={(next) => model.setPreferences({ side: next })}
      onCollapse={model.collapse}
      onWrap={() => model.setPreferences({ wrap: !preferences.wrap })}
      onGoTo={() => window.dispatchEvent(new Event(FILE_GOTO_EVENT))}
      onReload={model.reload}
    />
  )
  const side = preferences.side === 'left' ? 'left' : 'right'
  return (
    <div
      className={`files-tab${sideBySide ? ` side-by-side tree-${side}` : ''}`}
      ref={box}
      data-testid="files-tab"
    >
      {props.onSendNotes && (
        <NotesBar
          notes={diffNotes.notes}
          fileKey={fileKey}
          rootPaths={rootPaths}
          onSend={sendNotes}
          onShow={props.onShowChanges}
          onClear={diffNotes.clear}
          onRestore={diffNotes.addAll}
          onDelete={diffNotes.remove}
          onOpenNote={(note) => {
            const root = rootPaths.findIndex((r) => note.file.startsWith(`${r}::`))
            if (root < 0) return
            const path = note.file.slice((rootPaths[root] ?? '').length + 2)
            open({ root, path, line: note.from })
          }}
        />
      )}
      {notice && (
        <div className="file-view-banner notice" role="status" data-testid="files-notice">
          <span className="grow">{notice}</span>
          <button
            className="icon-button small"
            onClick={() => setNotice(null)}
            aria-label={t('files.dismiss')}
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="files-body">
        {showTree && (
          <TreePane
            model={model}
            rows={rows}
            selected={target ? dirKey(target.root, target.path) : undefined}
            changed={changed}
            actions={actions}
            filter={filter}
            viewMenu={showFile ? null : viewMenu}
            onOpen={open}
            onFocusComposer={props.onFocusComposer}
          />
        )}
        {showFile && target && (
          <FileView
            root={roots?.[target.root]}
            showRoot={(roots?.length ?? 0) > 1}
            target={target}
            content={model.content}
            wrap={preferences.wrap}
            actions={actions}
            changed={target.root === 0 && changed.has(target.path)}
            notes={
              props.onSendNotes && {
                notes: fileNotes,
                anchor: { view: 'file', file: fileKey, path: notePath },
                onSave: (note: DiffNote) => diffNotes.save(note),
                onDelete: diffNotes.remove
              }
            }
            openLink={props.openLink}
            canBack={state.back.length > 0}
            canForward={state.forward.length > 0}
            treeShown={sideBySide}
            onToggleTree={toggleTree}
            onStep={model.step}
            onRevealDir={(path) => {
              model.reveal(target.root, path)
              if (!sideBySide) setNarrowView('tree')
            }}
            onScroll={model.saveScroll}
            initialScroll={state.scroll}
            viewMenu={viewMenu}
          />
        )}
      </div>
    </div>
  )
}
