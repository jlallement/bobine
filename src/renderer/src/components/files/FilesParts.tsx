import * as Dropdown from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronsDownUp,
  EyeOff,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffNote } from '@shared/diff-notes'
import { nameAndDir, type FileRoot, type FileTarget } from '@shared/files'
import { countText } from '@shared/i18n/format'
import { SHORTCUTS, type MenuCommand } from '@shared/shortcuts'
import type { TreeSide } from '../../files-state'
import { isOrphanNote } from '../../file-notes'
import { platformFeatures } from '../../platform-features'
import { Tip } from '../common/Menus'
import type { FileActions } from './FileActions'
import { FileTree, type TreeRow } from './FileTree'
import type { FilesTabModel } from './useFilesTab'
import type { FilterHit } from './useFileFilter'

/** Touches d'un raccourci du menu, telles qu'affichées. */
export const shortcutKeys = (command: MenuCommand) =>
  SHORTCUTS.find((s) => s.command === command)?.keys ?? ''

/** Délai pendant lequel des remarques effacées peuvent revenir (point 7). */
export const UNDO_MS = 6000

/**
 * Filtre, barre d'outils et arbre (ou résultats du filtre). Le filtre est un champ de recherche
 * avec sa liste (`combobox`) : ↑ ↓ y choisissent un résultat, ↵ l'ouvre, ⌘↵ dans l'éditeur, ⇧↵ le
 * mentionne ; Échap efface, puis rend le clavier à la zone de saisie (point 17).
 */
export function TreePane(props: {
  model: FilesTabModel
  rows: TreeRow[]
  selected: string | undefined
  changed: ReadonlySet<string>
  actions: FileActions
  filter: RefObject<HTMLInputElement | null>
  /** Menu de vue de l'onglet, ici quand aucun fichier n'est affiché (point 4). */
  viewMenu: React.ReactNode
  onOpen: (target: FileTarget) => void
  onFocusComposer?: (() => void) | undefined
}) {
  const { model, actions, filter } = props
  const { t } = useTranslation()
  const search = model.filter
  const [active, setActive] = useState(0)
  const hits = search.hits ?? []
  const current = hits[Math.min(active, hits.length - 1)]
  const open = (hit: { root: number; path: string }) =>
    props.onOpen({ ...hit, ...(search.line ? { line: search.line } : {}) })
  // Un résultat : ↵ l'ouvre, ⌘↵ dans l'éditeur, ⇧↵ le mentionne (Q36, point 9).
  const act = (hit: { root: number; path: string }, event: KeyboardEvent) => {
    const item = { ...hit, kind: 'file' as const }
    if (event.metaKey || event.ctrlKey) actions.openInEditor?.(item, search.line)
    else if (event.shiftKey) actions.mention?.(item)
    else open(hit)
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (search.query) search.setQuery('')
      else props.onFocusComposer?.()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => Math.min(Math.max(i + delta, 0), Math.max(hits.length - 1, 0)))
      return
    }
    if (event.key === 'Enter' && current) {
      event.preventDefault()
      act(current, event)
    }
  }
  // Nouvelle saisie : le premier résultat est présélectionné (ajustement pendant le rendu).
  const [activeFor, setActiveFor] = useState(search.query)
  if (activeFor !== search.query) {
    setActiveFor(search.query)
    setActive(0)
  }
  return (
    <div className="files-tree-pane" data-testid="files-tree-pane">
      <div className="files-toolbar">
        <div className="files-filter">
          <Search size={13} />
          <input
            ref={filter}
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('files.filter')}
            aria-label={t('files.filterLabel')}
            role="combobox"
            aria-expanded={search.active}
            aria-controls="files-hits"
            aria-autocomplete="list"
            {...(search.active && current
              ? { 'aria-activedescendant': `files-hit-${current.root}-${current.path}` }
              : {})}
            data-testid="files-filter"
          />
          {search.query ? (
            <button
              className="icon-button small"
              aria-label={t('files.clearFilter')}
              onClick={() => search.setQuery('')}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="files-filter-kbd">{shortcutKeys('files')}</kbd>
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
        {props.viewMenu}
      </div>
      {search.active ? (
        <FilterResults
          hits={search.hits}
          searching={search.searching}
          active={current}
          roots={model.roots ?? []}
          exclusionFiles={model.exclusionFiles}
          onActive={(hit) => setActive(hits.indexOf(hit))}
          onOpen={open}
          onAct={act}
          onBack={() => filter.current?.focus()}
        />
      ) : (
        <FileTree
          rows={props.rows}
          selected={props.selected}
          changed={props.changed}
          exclusionFiles={model.exclusionFiles}
          actions={actions}
          onToggle={model.toggle}
          onCollapseDir={model.collapseDir}
          onOpen={(root, path) => props.onOpen({ root, path })}
          onType={(text) => {
            search.setQuery(text)
            filter.current?.focus()
          }}
        />
      )}
    </div>
  )
}

/**
 * Résultats du filtre : liste plate, nom puis dossier (Q33, Q34). Pendant une recherche, les
 * derniers résultats restent (ou « Lecture… ») ; « aucun » n'est dit qu'après la réponse.
 */
function FilterResults({
  hits,
  searching,
  active,
  roots,
  exclusionFiles,
  onActive,
  onOpen,
  onAct,
  onBack
}: {
  hits: FilterHit[] | null
  searching: boolean
  active: { root: number; path: string } | undefined
  roots: readonly FileRoot[]
  exclusionFiles: readonly string[]
  onActive: (hit: { root: number; path: string }) => void
  onOpen: (hit: { root: number; path: string }) => void
  onAct: (hit: { root: number; path: string }, event: KeyboardEvent) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  // Exclu pour l'agent : marqué comme dans l'arbre (M6).
  const excluded = exclusionFiles.length
    ? t('files.excluded', { name: exclusionFiles.join(', ') })
    : t('files.excludedPlain')
  const move = (event: KeyboardEvent<HTMLButtonElement>, delta: number) => {
    event.preventDefault()
    const all = [
      ...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[data-testid="files-hit"]'
      ) ?? [])
    ]
    const next = all[all.indexOf(event.currentTarget) + delta]
    if (next) next.focus()
    else if (delta < 0) onBack()
  }
  return (
    <div
      className={`files-hits${searching ? ' searching' : ''}`}
      id="files-hits"
      role="listbox"
      aria-busy={searching}
      data-testid="files-hits"
    >
      {!hits && <div className="file-tree-note">{t('files.loading')}</div>}
      {hits && hits.length === 0 && !searching && (
        <div className="file-tree-note" data-testid="files-no-match">
          {t('files.noMatch')}
        </div>
      )}
      {hits?.map((hit) => {
        const { name, dir } = nameAndDir(hit.path)
        const rootName = roots.length > 1 ? roots[hit.root]?.name : undefined
        const selected = active?.root === hit.root && active.path === hit.path
        return (
          <button
            key={`${hit.root}:${hit.path}`}
            id={`files-hit-${hit.root}-${hit.path}`}
            role="option"
            aria-selected={selected}
            className={`files-hit${selected ? ' active' : ''}`}
            onClick={() => onOpen(hit)}
            onFocus={() => onActive(hit)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') move(e, 1)
              else if (e.key === 'ArrowUp') move(e, -1)
              else if (e.key === 'Enter') {
                e.preventDefault()
                onAct(hit, e)
              }
            }}
            data-testid="files-hit"
            data-path={hit.path}
            {...(hit.excluded ? { 'aria-description': excluded } : {})}
          >
            <span className="files-hit-name">{name}</span>
            <span className="files-hit-dir">{[rootName, dir].filter(Boolean).join('/')}</span>
            {hit.excluded && (
              <Tip label={excluded}>
                <span className="file-row-mark files-hit-mark" data-testid="files-hit-excluded">
                  <EyeOff size={12} />
                </span>
              </Tip>
            )}
          </button>
        )
      })}
      <div className="file-tree-note small">{t('files.ignoredNotSearched')}</div>
    </div>
  )
}

/**
 * Menu de vue de l'onglet (Q38, R4 sans les réglages d'éditeur ; un seul, point 4) : filtrer,
 * arborescence et son côté, réduire, retour à la ligne, aller à la ligne, relire.
 */
export function ViewMenu(props: {
  wrap: boolean
  side: TreeSide
  tree: boolean
  /** Un fichier de code est affiché : « Aller à la ligne… ». */
  canGoTo: boolean
  onFilter: () => void
  onTree: () => void
  onSide: (side: TreeSide) => void
  onCollapse: () => void
  onWrap: () => void
  onGoTo: () => void
  onReload: () => void
}) {
  const { t } = useTranslation()
  const check = (on: boolean) =>
    on ? <Check size={14} className="menu-check" /> : <span className="menu-check-space" />
  const item = (
    label: string,
    run: () => void,
    testId: string,
    options: { on?: boolean; keys?: string; disabled?: boolean } = {}
  ) => (
    <Dropdown.Item
      className="menu-item"
      onSelect={run}
      disabled={options.disabled}
      data-testid={testId}
    >
      {check(options.on === true)}
      <span className="menu-text">{label}</span>
      {options.keys && <span className="menu-value">{options.keys}</span>}
    </Dropdown.Item>
  )
  // ⌃G n'est un raccourci que sur le Mac (ailleurs, Ctrl+G est « suivant » de la recherche).
  const gotoKeys = platformFeatures().appMenu ? '⌃G' : undefined
  return (
    <Dropdown.Root modal={false}>
      <Tip label={t('files.viewMenu')}>
        <Dropdown.Trigger
          className="icon-button small"
          aria-label={t('files.viewMenu')}
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
          {item(t('files.filterLabel'), props.onFilter, 'files-menu-filter', {
            keys: shortcutKeys('files')
          })}
          <Dropdown.Separator className="menu-separator" />
          {item(t('files.showTree'), props.onTree, 'files-menu-tree', {
            on: props.tree,
            keys: shortcutKeys('files-tree')
          })}
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
          {item(t('files.collapseAll'), props.onCollapse, 'files-menu-collapse')}
          <Dropdown.Separator className="menu-separator" />
          {item(t('files.wrap'), props.onWrap, 'files-menu-wrap', { on: props.wrap })}
          {item(t('files.goToLine'), props.onGoTo, 'files-menu-goto', {
            disabled: !props.canGoTo,
            ...(gotoKeys ? { keys: gotoKeys } : {})
          })}
          <Dropdown.Separator className="menu-separator" />
          {item(t('files.reload'), props.onReload, 'files-menu-reload')}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

/**
 * Barre des remarques en attente (point 7) : combien, et où (ce fichier, d'autres, des diffs) ;
 * « Voir » ouvre Modifications ; la corbeille efface, et « Annuler » les rend quelques secondes.
 */
export function NotesBar({
  notes,
  fileKey,
  rootPaths,
  onSend,
  onShow,
  onClear,
  onRestore,
  onDelete,
  onOpenNote
}: {
  notes: DiffNote[]
  /** Fichier affiché (`fileNoteKey`), pour compter ses remarques. */
  fileKey: string
  /** Racines actuelles : une remarque sur un dossier retiré se montre ici (jamais comptée seule). */
  rootPaths: readonly string[]
  onSend: () => void
  onShow?: (() => void) | undefined
  onClear: () => void
  onRestore: (notes: DiffNote[]) => void
  onDelete: (id: string) => void
  /** Ouvre le fichier d'une remarque (absent pour une remarque dont le dossier n'existe plus). */
  onOpenNote?: ((note: DiffNote) => void) | undefined
}) {
  const { t } = useTranslation()
  const [cleared, setCleared] = useState<DiffNote[] | null>(null)
  useEffect(() => {
    if (!cleared) return
    const timer = setTimeout(() => setCleared(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [cleared])
  if (cleared && notes.length === 0) {
    return (
      <div className="diff-notes-bar" role="status" data-testid="files-notes-cleared">
        <span className="grow">
          {t('files.notesCleared', { count: cleared.length, n: countText(cleared.length) })}
        </span>
        <button
          className="btn small ghost"
          onClick={() => {
            onRestore(cleared)
            setCleared(null)
          }}
          data-testid="files-notes-undo"
        >
          {t('files.undo')}
        </button>
      </div>
    )
  }
  if (notes.length === 0) return null
  const here = notes.filter((n) => n.view === 'file' && n.file === fileKey).length
  const orphans = notes.filter((n) => isOrphanNote(n, rootPaths))
  const files = notes.filter((n) => n.view === 'file').length - here - orphans.length
  const diffs = notes.length - here - files - orphans.length
  const lost = orphans.length
  const where = [
    here ? t('files.notesHere', { count: here, n: countText(here) }) : '',
    files ? t('files.notesOther', { count: files, n: countText(files) }) : '',
    diffs ? t('files.notesDiff', { count: diffs, n: countText(diffs) }) : '',
    lost ? t('files.notesOrphan', { count: lost, n: countText(lost) }) : ''
  ].filter(Boolean)
  return (
    <>
      <div className="diff-notes-bar files-notes-bar" data-testid="diff-notes-bar">
        <MessageSquare size={14} />
        <span className="files-notes-count" data-testid="files-notes-count">
          {t('diffNotes.count', { count: notes.length })}
          {where.length > 0 && (
            <span className="files-notes-where">{` · ${where.join(', ')}`}</span>
          )}
        </span>
        <span className="grow" />
        {onShow && (
          <Tip label={t('files.notesShowTip')}>
            <button className="btn small ghost" onClick={onShow} data-testid="files-notes-show">
              {t('files.notesShow')}
            </button>
          </Tip>
        )}
        <Tip label={t('diffNotes.clear')}>
          <button
            className="icon-button small"
            aria-label={t('diffNotes.clear')}
            onClick={() => {
              setCleared(notes)
              onClear()
            }}
            data-testid="diff-notes-clear"
          >
            <Trash2 size={13} />
          </button>
        </Tip>
        <button className="btn small primary" onClick={onSend} data-testid="diff-notes-send">
          <Send size={13} />
          {t('diffNotes.send')}
        </button>
      </div>
      <ElsewhereNotes
        notes={notes.filter((n) => n.view === 'file' && n.file !== fileKey)}
        rootPaths={rootPaths}
        onDelete={onDelete}
        onOpen={onOpenNote}
      />
    </>
  )
}

/**
 * Remarques sur d'autres fichiers que celui affiché : listées sous la barre, jamais comptées sans
 * être montrées. Un clic ouvre le fichier à la ligne ; une remarque dont le dossier n'est plus
 * parmi ceux de la conversation se lit et se supprime ici.
 */
function ElsewhereNotes({
  notes,
  rootPaths,
  onDelete,
  onOpen
}: {
  notes: DiffNote[]
  rootPaths: readonly string[]
  onDelete: (id: string) => void
  onOpen?: ((note: DiffNote) => void) | undefined
}) {
  const { t } = useTranslation()
  if (notes.length === 0) return null
  return (
    <ul className="files-notes-orphans" aria-label={t('files.notesElsewhereList')}>
      {notes.map((note) => {
        const orphan = isOrphanNote(note, rootPaths)
        const text = (
          <>
            <span className="files-note-orphan-path">{note.path}</span>
            <span className="files-note-orphan-comment">{note.comment}</span>
          </>
        )
        return (
          <li
            key={note.id}
            className={`files-note-orphan${orphan ? ' orphan' : ''}`}
            data-testid="files-note-elsewhere"
            data-orphan={orphan || undefined}
          >
            {!orphan && onOpen ? (
              <button
                className="files-note-orphan-text"
                onClick={() => onOpen(note)}
                data-testid="files-note-elsewhere-open"
              >
                {text}
              </button>
            ) : (
              <span className="files-note-orphan-text">
                {text}
                {orphan && (
                  <span className="files-note-orphan-gone">{t('files.notesFolderGone')}</span>
                )}
              </span>
            )}
            <Tip label={t('diffNotes.delete')}>
              <button
                className="icon-button small"
                aria-label={t('diffNotes.delete')}
                onClick={() => onDelete(note.id)}
                data-testid="files-note-elsewhere-delete"
              >
                <Trash2 size={13} />
              </button>
            </Tip>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Dossier de la conversation disparu ou démonté (Q19) : dit en clair, avec « Choisir un
 * dossier… » (le choix de dossier existant de la conversation).
 */
export function FolderMissing({ onChoose }: { onChoose?: (() => void) | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="file-view-note files-folder-missing" data-testid="files-folder-missing">
      <p>{t('files.folderMissing')}</p>
      {onChoose && (
        <button className="btn small" onClick={onChoose} data-testid="files-choose-folder">
          {t('files.chooseFolder')}
        </button>
      )}
    </div>
  )
}
