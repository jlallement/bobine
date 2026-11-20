import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronsDownUp, MoreHorizontal, Search, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject
} from 'react'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import { diffFeedback, type DiffNote } from '@shared/diff-notes'
import { parentDirs, type FileRoot, type FileTarget } from '@shared/files'
import type { TranscriptItem } from '@shared/transcript'
import { reviewerOfNote, useDiffNotes } from '../../diff-notes-store'
import { dirKey, TOGGLE_TREE_EVENT, type TreeSide } from '../../files-state'
import { fileNoteKey } from '../../file-notes'
import { Tip } from '../common/Menus'
import { SHORTCUTS, type MenuCommand } from '@shared/shortcuts'
import { DiffNotesBar } from '../panel/ChangesBars'
import type { OpenFileLink } from '../thread/FileLink'
import { useFileActions } from './FileActions'
import { FileTree, treeRows } from './FileTree'
import { FileView } from './FileView'
import { useFilesTab, type FilesRequest } from './useFilesTab'
import './files.css'

/** Largeur à partir de laquelle, agrandi, l'arbre se met à côté du fichier (Q58). */
const SIDE_BY_SIDE_MIN = 900

interface Props {
  conversationId: string
  items: TranscriptItem[]
  maximized: boolean
  request?: FilesRequest | undefined
  /** Liens d'un Markdown, page HTML : comme les liens du fil. */
  openLink: OpenFileLink
  onSendNotes?: ((text: string, about?: string) => void) | undefined
  onMention?: ((paths: string[]) => void) | undefined
  onShowDiff?: ((absolutePath: string) => void) | undefined
  /** Nom du fichier ouvert, pour le titre de l'onglet (Q9) ; `undefined` : « Fichiers ». */
  onTitle?: (title: string | undefined) => void
}

/** Chemins modifiés par la conversation, relatifs à la racine principale, et leurs dossiers (Q6). */
function changedPaths(items: readonly TranscriptItem[], root: FileRoot | undefined): Set<string> {
  const changed = new Set<string>()
  if (!root) return changed
  const base = root.path.replace(/[\\/]+$/, '')
  for (const file of conversationChanges(items)) {
    const path = file.path.split('\\').join('/')
    const relative = path.startsWith(`${base.split('\\').join('/')}/`)
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

/**
 * Onglet « Fichiers » du panneau (fiche 271, ADR-0065) : l'arbre du dossier de la conversation et
 * de ses autres dossiers, un filtre (⌘P y met le curseur), et le fichier ouvert, en lecture seule.
 * Panneau étroit : l'arbre ou le fichier (⇧⌘Y bascule) ; agrandi : côte à côte.
 */
export function FilesTab(props: Props) {
  const { conversationId, items, maximized, request } = props
  const { t } = useTranslation()
  const model = useFilesTab(conversationId, items)
  const { state, roots, preferences } = model
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
  // Panneau étroit : l'arbre ou le fichier ouvert (Q18).
  const [narrowView, setNarrowView] = useState<'tree' | 'file'>(state.open ? 'file' : 'tree')
  const filter = useRef<HTMLInputElement>(null)
  const width = useWidth()
  const side: TreeSide = preferences.side
  const sideBySide = maximized && preferences.tree && !!state.open && width >= SIDE_BY_SIDE_MIN
  const showTree = sideBySide || !state.open || narrowView === 'tree'
  const showFile = !!state.open && (sideBySide || narrowView === 'file')

  // Demandes : ⌘P (curseur dans le filtre), lien du fil (fichier à la ligne).
  // Ajustement pendant le rendu : la vue suit la demande ; le curseur va au filtre ensuite.
  const [seenRequest, setSeenRequest] = useState(0)
  if (request && request.seq !== seenRequest) {
    setSeenRequest(request.seq)
    if (request.target) {
      model.show(request.target)
      setNarrowView('file')
    } else if (request.focusFilter) setNarrowView('tree')
  }
  const focusSeq = request?.focusFilter ? request.seq : 0
  useEffect(() => {
    if (!focusSeq) return
    const frame = requestAnimationFrame(() => {
      filter.current?.focus()
      filter.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [focusSeq])
  const { onTitle } = props
  const title = state.open ? state.open.path.split('/').at(-1) : undefined
  useEffect(() => {
    onTitle?.(title)
  }, [onTitle, title])
  useEffect(() => () => onTitle?.(undefined), [onTitle])
  // ⇧⌘Y (Q18) : agrandi, l'arbre à côté ou non ; étroit, l'arbre ou le fichier.
  const toggleTree = useCallback(() => {
    if (maximized) model.setPreferences({ tree: !preferences.tree })
    else setNarrowView((view) => (view === 'tree' && state.open ? 'file' : 'tree'))
  }, [maximized, model, preferences.tree, state.open])
  useEffect(() => {
    const onToggle = () => toggleTree()
    window.addEventListener(TOGGLE_TREE_EVENT, onToggle)
    return () => window.removeEventListener(TOGGLE_TREE_EVENT, onToggle)
  }, [toggleTree])

  const open = (target: FileTarget) => {
    model.show(target)
    setNarrowView('file')
    model.setQuery('')
  }
  const diffNotes = useDiffNotes(conversationId)
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
  const selected = state.open ? dirKey(state.open.root, state.open.path) : undefined
  const target = state.open
  const root = target ? roots?.[target.root] : undefined
  const fileKey = target ? fileNoteKey(target.root, target.path) : ''
  const fileNotes = diffNotes.notes.filter((n) => n.view === 'file' && n.file === fileKey)
  // Remarque sur un autre dossier (fiche 179) : son chemin absolu, l'agent le connaît ainsi.
  const notePath = target ? (target.root === 0 ? target.path : actions.absolute(target)) : ''

  const tree = (
    <TreePane
      model={model}
      rows={rows}
      selected={selected}
      changed={changed}
      actions={actions}
      filter={filter}
      treeChecked={preferences.tree || !maximized}
      onToggleTree={toggleTree}
      onOpen={open}
    />
  )
  return (
    <div
      className={`files-tab${sideBySide ? ` side-by-side tree-${side === 'left' ? 'left' : 'right'}` : ''}`}
      data-testid="files-tab"
    >
      {props.onSendNotes && diffNotes.notes.length > 0 && (
        <DiffNotesBar
          count={diffNotes.notes.length}
          fix={diffNotes.notes.every((n) => n.review)}
          onClear={diffNotes.clear}
          onSend={sendNotes}
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
        {showTree && tree}
        {showFile && target && (
          <FileView
            root={root}
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
            onClose={() => {
              model.close()
              setNarrowView('tree')
            }}
            onRevealDir={(path) => {
              model.reveal(target.root, path)
              if (!sideBySide) setNarrowView('tree')
            }}
            onScroll={model.saveScroll}
            initialScroll={state.scroll}
          />
        )}
      </div>
    </div>
  )
}

/** Filtre, barre d'outils et arbre (ou résultats du filtre). */
function TreePane({
  model,
  rows,
  selected,
  changed,
  actions,
  filter,
  treeChecked,
  onToggleTree,
  onOpen
}: {
  model: ReturnType<typeof useFilesTab>
  rows: ReturnType<typeof treeRows>
  selected: string | undefined
  changed: ReadonlySet<string>
  actions: ReturnType<typeof useFileActions>
  filter: RefObject<HTMLInputElement | null>
  treeChecked: boolean
  onToggleTree: () => void
  onOpen: (target: FileTarget) => void
}) {
  const { t } = useTranslation()
  const { preferences } = model
  const open = onOpen
  return (
    <div className="files-tree-pane" data-testid="files-tree-pane">
      <div className="files-toolbar">
        <div className="files-filter">
          <Search size={13} />
          <input
            ref={filter}
            value={model.query}
            onChange={(e) => model.setQuery(e.target.value)}
            onKeyDown={(e) => onFilterKey(e, model, open, actions)}
            placeholder={t('files.filter')}
            aria-label={t('files.filterLabel')}
            data-testid="files-filter"
          />
          {model.query && (
            <button
              className="icon-button small"
              aria-label={t('files.clearFilter')}
              onClick={() => model.setQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <Tip label={t('files.collapseAll')}>
          <button
            className="icon-button small"
            onClick={model.collapse}
            aria-label={t('files.collapseAll')}
            data-testid="files-collapse"
          >
            <ChevronsDownUp size={14} />
          </button>
        </Tip>
        <FilesMenu
          wrap={preferences.wrap}
          side={preferences.side}
          tree={treeChecked}
          onFilter={() => filter.current?.focus()}
          onTree={onToggleTree}
          onSide={(next) => model.setPreferences({ side: next })}
          onCollapse={model.collapse}
          onWrap={() => model.setPreferences({ wrap: !preferences.wrap })}
          onReload={model.reload}
        />
      </div>
      {model.hits ? (
        <FilterResults
          hits={model.hits}
          roots={model.roots ?? []}
          onOpen={(hit) =>
            open({ ...hit, ...(model.filterLine ? { line: model.filterLine } : {}) })
          }
        />
      ) : (
        <FileTree
          rows={rows}
          selected={selected}
          changed={changed}
          actions={actions}
          onToggle={model.toggle}
          onOpen={(rootIndex, path) => open({ root: rootIndex, path })}
        />
      )}
    </div>
  )
}

/** ↑ ↓ ↵ dans le filtre (Q36) : parcourir et ouvrir ; Échap efface, puis rend la main. */
function onFilterKey(
  event: KeyboardEvent<HTMLInputElement>,
  model: ReturnType<typeof useFilesTab>,
  open: (target: FileTarget) => void,
  actions: ReturnType<typeof useFileActions>
) {
  const list = event.currentTarget
    .closest('.files-tree-pane')
    ?.querySelectorAll<HTMLElement>('[data-testid="files-hit"]')
  if (event.key === 'Escape') {
    if (model.query) {
      event.preventDefault()
      event.stopPropagation()
      model.setQuery('')
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    list?.[0]?.focus()
    return
  }
  const first = model.hits?.[0]
  if (event.key !== 'Enter' || !first) return
  event.preventDefault()
  const item = { ...first, kind: 'file' as const }
  if (event.metaKey || event.ctrlKey) actions.openInEditor?.(item, model.filterLine)
  else if (event.shiftKey) actions.mention?.(item)
  else open({ ...first, ...(model.filterLine ? { line: model.filterLine } : {}) })
}

/** Résultats du filtre : liste plate, nom puis dossier (Q33, Q34). */
function FilterResults({
  hits,
  roots,
  onOpen
}: {
  hits: { root: number; path: string }[]
  roots: readonly FileRoot[]
  onOpen: (hit: { root: number; path: string }) => void
}) {
  const { t } = useTranslation()
  const move = (event: KeyboardEvent<HTMLButtonElement>, delta: number) => {
    const all = [
      ...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[data-testid="files-hit"]'
      ) ?? [])
    ]
    const index = all.indexOf(event.currentTarget)
    const next = all[index + delta]
    if (next) next.focus()
    else if (delta < 0) {
      event.currentTarget.closest('.files-tree-pane')?.querySelector<HTMLElement>('input')?.focus()
    }
  }
  return (
    <div className="files-hits" role="listbox" data-testid="files-hits">
      {hits.length === 0 && <div className="file-tree-note">{t('files.noMatch')}</div>}
      {hits.map((hit) => {
        const name = hit.path.split('/').at(-1) ?? hit.path
        const dir = hit.path.slice(0, hit.path.length - name.length - 1)
        const rootName = roots.length > 1 ? roots[hit.root]?.name : undefined
        return (
          <button
            key={`${hit.root}:${hit.path}`}
            role="option"
            aria-selected={false}
            className="files-hit"
            onClick={() => onOpen(hit)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                move(e, 1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                move(e, -1)
              }
            }}
            data-testid="files-hit"
            data-path={hit.path}
          >
            <span className="files-hit-name">{name}</span>
            <span className="files-hit-dir">{[rootName, dir].filter(Boolean).join('/')}</span>
          </button>
        )
      })}
      <div className="file-tree-note small">{t('files.ignoredNotSearched')}</div>
    </div>
  )
}

/** Menu … de l'onglet (Q38, R4 sans les réglages d'éditeur). */
function FilesMenu(props: {
  wrap: boolean
  side: TreeSide
  tree: boolean
  onFilter: () => void
  onTree: () => void
  onSide: (side: TreeSide) => void
  onCollapse: () => void
  onWrap: () => void
  onReload: () => void
}) {
  const { t } = useTranslation()
  const check = (on: boolean) =>
    on ? <Check size={14} className="menu-check" /> : <span className="menu-check-space" />
  return (
    <Dropdown.Root modal={false}>
      <Tip label={t('files.more')}>
        <Dropdown.Trigger
          className="icon-button small"
          aria-label={t('files.more')}
          data-testid="files-menu"
        >
          <MoreHorizontal size={14} />
        </Dropdown.Trigger>
      </Tip>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu"
          align="end"
          sideOffset={4}
          collisionPadding={12}
          data-testid="files-menu-content"
        >
          <Dropdown.Item className="menu-item" onSelect={props.onFilter}>
            {check(false)}
            <span className="menu-text">{t('files.filterLabel')}</span>
            <span className="menu-value">{shortcutKeys('files')}</span>
          </Dropdown.Item>
          <Dropdown.Separator className="menu-separator" />
          <Dropdown.Item
            className="menu-item"
            onSelect={props.onTree}
            data-testid="files-menu-tree"
          >
            {check(props.tree)}
            <span className="menu-text">{t('files.showTree')}</span>
            <span className="menu-value">{shortcutKeys('files-tree')}</span>
          </Dropdown.Item>
          <div className="menu-label">{t('files.side.label')}</div>
          {(['auto', 'left', 'right'] as const).map((value) => (
            <Dropdown.Item
              key={value}
              className="menu-item"
              onSelect={() => props.onSide(value)}
              data-testid={`files-side-${value}`}
            >
              {check(props.side === value)}
              <span className="menu-text">{t(`files.side.${value}`)}</span>
            </Dropdown.Item>
          ))}
          <Dropdown.Separator className="menu-separator" />
          <Dropdown.Item className="menu-item" onSelect={props.onCollapse}>
            {check(false)}
            <span className="menu-text">{t('files.collapseAll')}</span>
          </Dropdown.Item>
          <Dropdown.Separator className="menu-separator" />
          <Dropdown.Item
            className="menu-item"
            onSelect={props.onWrap}
            data-testid="files-menu-wrap"
          >
            {check(props.wrap)}
            <span className="menu-text">{t('files.wrap')}</span>
          </Dropdown.Item>
          <Dropdown.Item
            className="menu-item"
            onSelect={props.onReload}
            data-testid="files-menu-reload"
          >
            {check(false)}
            <span className="menu-text">{t('files.reload')}</span>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

/** Touches d'un raccourci du menu, telles qu'affichées. */
const shortcutKeys = (command: MenuCommand) =>
  SHORTCUTS.find((s) => s.command === command)?.keys ?? ''

/** Largeur de la fenêtre, suivie. */
function useWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
