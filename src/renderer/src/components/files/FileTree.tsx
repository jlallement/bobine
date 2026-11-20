import { Ban, ChevronDown, ChevronRight, EyeOff, Folder } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import type { FileEntry, FileRoot } from '@shared/files'
import { countText } from '@shared/i18n/format'
import { dirKey } from '../../files-state'
import { Tip } from '../common/Menus'
import {
  FileActionItems,
  FileActionsMenu,
  FileContextMenu,
  type ContextAt,
  type FileActions,
  type FileItem
} from './FileActions'
import { EntryIcon } from './file-icons'
import type { Listing } from './useFilesTab'
import { endTreeDrag, FILE_DRAG_TYPE, startTreeDrag } from '../../useFileDrop'

/** Une ligne affichée de l'arbre. */
export type TreeRow =
  | { kind: 'root'; key: string; root: FileRoot; depth: 0; open: boolean }
  | { kind: 'entry'; key: string; root: number; entry: FileEntry; depth: number; open: boolean }
  | {
      kind: 'note'
      key: string
      depth: number
      text: 'empty' | 'loading' | 'more' | 'error'
      more?: number
      error?: string
    }

/**
 * Lignes de l'arbre, dans l'ordre : avec une seule racine, son contenu directement ; avec
 * plusieurs (fiche 179), une ligne par racine, la principale dépliée.
 */
export function treeRows(
  roots: readonly FileRoot[],
  listings: Readonly<Record<string, Listing>>,
  expanded: ReadonlySet<string>
): TreeRow[] {
  const rows: TreeRow[] = []
  const visit = (root: number, dir: string, depth: number) => {
    const key = dirKey(root, dir)
    const found = listings[key]
    if (!found) {
      rows.push({ kind: 'note', key: `${key}#loading`, depth, text: 'loading' })
      return
    }
    if ('error' in found) {
      rows.push({ kind: 'note', key: `${key}#error`, depth, text: 'error', error: found.error })
      return
    }
    if (found.listing.entries.length === 0) {
      rows.push({ kind: 'note', key: `${key}#empty`, depth, text: 'empty' })
    }
    for (const entry of found.listing.entries) {
      const childKey = dirKey(root, entry.path)
      const open = entry.kind === 'dir' && entry.link !== 'outside' && expanded.has(childKey)
      rows.push({ kind: 'entry', key: childKey, root, entry, depth, open })
      if (open) visit(root, entry.path, depth + 1)
    }
    if (found.listing.more > 0) {
      rows.push({ kind: 'note', key: `${key}#more`, depth, text: 'more', more: found.listing.more })
    }
  }
  if (roots.length === 1) {
    visit(0, '', 0)
    return rows
  }
  for (const root of roots) {
    const key = dirKey(root.index, '')
    const open = root.index === 0 || expanded.has(key)
    rows.push({ kind: 'root', key, root, depth: 0, open })
    if (open) visit(root.index, '', 1)
  }
  return rows
}

interface Props {
  rows: TreeRow[]
  /** Ligne du fichier ouvert (surlignée). */
  selected?: string | undefined
  /** Fichiers modifiés par la conversation, et leurs dossiers (Q6). */
  changed: ReadonlySet<string>
  /** Ce qui rend un fichier invisible pour l'agent (`.bobignore`…), pour l'infobulle. */
  exclusionFiles: readonly string[]
  actions: FileActions
  onToggle: (root: number, path: string, open?: boolean) => void
  onOpen: (root: number, path: string) => void
  /** « Réduire » un dossier et ses sous-dossiers. */
  onCollapseDir: (root: number, path: string) => void
  /** Une lettre tapée dans l'arbre : elle part au filtre (point 17). */
  onType: (text: string) => void
}

/** Ce que désigne une ligne, pour ses actions. */
function itemOf(row: Exclude<TreeRow, { kind: 'note' }>): FileItem {
  if (row.kind === 'root') return { root: row.root.index, path: '', kind: 'dir' }
  return {
    root: row.root,
    path: row.entry.path,
    kind: row.entry.kind,
    executable: row.entry.executable === true,
    special: row.entry.special === true
  }
}

/**
 * Arbre des fichiers (Q21 à Q32) : `role="tree"`, une ligne focalisable à la fois ; ↑ ↓ parcourent,
 * → déplie ou entre, ← replie ou remonte, ↵ ouvre, Début / Fin ; une lettre part au filtre. Menu
 * contextuel au pointeur (clic droit), ou sous la ligne (Maj+F10, touche Menu). Une ligne de
 * fichier se glisse sur la zone de saisie (mention).
 */
export function FileTree(props: Props) {
  const { rows, selected, changed, actions, onToggle, onOpen } = props
  const { t } = useTranslation()
  const items = rows.filter((row) => row.kind !== 'note')
  const [focused, setFocused] = useState<string | null>(null)
  const [menu, setMenuState] = useState<{ key: string; at: ContextAt } | null>(null)
  // Ligne du dernier menu ouvert : le clavier y revient à sa fermeture.
  const lastMenu = useRef<string | null>(null)
  const setMenu = (next: { key: string; at: ContextAt } | null) => {
    if (next) lastMenu.current = next.key
    setMenuState(next)
  }
  const box = useRef<HTMLDivElement>(null)
  const current = items.find((row) => row.key === focused) ?? items.find((r) => r.key === selected)
  const tabStop = current?.key ?? items[0]?.key
  // Fichier ouvert révélé : sa ligne à l'écran (Q31).
  useEffect(() => {
    if (!selected) return
    box.current
      ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(selected)}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, rows.length])

  const rowElement = (key: string) =>
    box.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
  const focusRow = (key: string | undefined) => {
    if (!key) return
    setFocused(key)
    rowElement(key)?.focus()
  }
  const activate = (row: TreeRow) => {
    if (row.kind === 'root') onToggle(row.root.index, '', !row.open)
    else if (row.kind === 'entry') {
      // Lien qui sort, FIFO, socket, périphérique : jamais ouvert (B1).
      if (row.entry.link === 'outside' || row.entry.special) return
      if (row.entry.kind === 'dir') onToggle(row.root, row.entry.path)
      else onOpen(row.root, row.entry.path)
    }
  }
  const menuUnder = (key: string) => {
    const box = rowElement(key)?.getBoundingClientRect()
    setMenu({ key, at: { x: (box?.left ?? 0) + 24, y: box?.bottom ?? 0 } })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((row) => row.key === (focused ?? tabStop))
    const row = items[index]
    if (!row) return
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault()
      menuUnder(row.key)
      return
    }
    if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault()
      props.onType(event.key)
      return
    }
    const parent = () => {
      for (let i = index - 1; i >= 0; i--) {
        const candidate = items[i]
        if (candidate && candidate.depth < row.depth) return candidate.key
      }
      return undefined
    }
    const isDir = row.kind === 'root' || (row.kind === 'entry' && row.entry.kind === 'dir')
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusRow(items[index + 1]?.key),
      ArrowUp: () => focusRow(items[index - 1]?.key),
      Home: () => focusRow(items[0]?.key),
      End: () => focusRow(items.at(-1)?.key),
      ArrowRight: () => {
        if (isDir && !row.open) activate(row)
        else if (isDir) focusRow(items[index + 1]?.key)
      },
      ArrowLeft: () => {
        if (isDir && row.open) activate(row)
        else focusRow(parent())
      },
      Enter: () => activate(row),
      ' ': () => activate(row)
    }
    const run = keys[event.key]
    if (!run) return
    event.preventDefault()
    run()
  }
  const onDragStart = (event: DragEvent<HTMLDivElement>, root: number, path: string) => {
    event.dataTransfer.setData(FILE_DRAG_TYPE, startTreeDrag(actions.absolute({ root, path })))
    event.dataTransfer.setData('text/plain', path)
    event.dataTransfer.effectAllowed = 'copy'
  }
  const menuRow = menu ? items.find((row) => row.key === menu.key) : undefined
  const menuItems = (row: Exclude<TreeRow, { kind: 'note' }>) => {
    const item = itemOf(row)
    return (
      <FileActionItems
        item={item}
        actions={actions}
        changed={item.root === 0 && changed.has(item.path)}
        {...(item.kind === 'dir' && row.open && row.kind === 'entry'
          ? { onCollapse: () => props.onCollapseDir(item.root, item.path) }
          : {})}
      />
    )
  }

  return (
    <div
      className="file-tree"
      role="tree"
      aria-label={t('files.treeLabel')}
      ref={box}
      onKeyDown={onKeyDown}
      data-testid="file-tree"
    >
      {rows.map((row) =>
        row.kind === 'note' ? (
          <TreeNote key={row.key} row={row} />
        ) : (
          <FileRow
            key={row.key}
            row={row}
            selected={row.key === selected}
            menuOpen={row.key === menu?.key}
            tabStop={row.key === tabStop}
            changed={changed}
            exclusionFiles={props.exclusionFiles}
            menuItems={menuItems(row)}
            onContextMenu={(event) => {
              event.preventDefault()
              setFocused(row.key)
              setMenu({ key: row.key, at: { x: event.clientX, y: event.clientY } })
            }}
            onFocus={() => setFocused(row.key)}
            onActivate={() => {
              setFocused(row.key)
              activate(row)
            }}
            onDragStart={onDragStart}
          />
        )
      )}
      <FileContextMenu
        at={menuRow ? (menu?.at ?? null) : null}
        onClose={() => setMenu(null)}
        onCloseFocus={() => {
          if (lastMenu.current) rowElement(lastMenu.current)?.focus()
        }}
      >
        {menuRow && menuItems(menuRow)}
      </FileContextMenu>
    </div>
  )
}

function TreeNote({ row }: { row: Extract<TreeRow, { kind: 'note' }> }) {
  const { t } = useTranslation()
  const text =
    row.text === 'more'
      ? t('files.moreEntries', { count: row.more ?? 0, n: countText(row.more ?? 0) })
      : row.text === 'error'
        ? row.error
        : t(row.text === 'empty' ? 'files.empty' : 'files.loading')
  return (
    <div
      className={`file-tree-note${row.text === 'error' ? ' error' : ''}`}
      style={{ paddingLeft: 10 + row.depth * 14 }}
      data-testid={`file-tree-${row.text}`}
    >
      {text}
    </div>
  )
}

/** Classes d'une ligne : ignorée, lien qui sort, spéciale, choisie, menu ouvert, racine. */
function rowClasses(
  row: Exclude<TreeRow, { kind: 'note' }>,
  state: { selected: boolean; menuOpen: boolean }
): string[] {
  const entry = row.kind === 'entry' ? row.entry : undefined
  return [
    'file-row',
    entry?.ignored ? 'ignored' : '',
    entry?.link === 'outside' ? 'outside' : '',
    entry?.special ? 'special' : '',
    state.selected ? 'selected' : '',
    state.menuOpen ? 'menu-open' : '',
    row.kind === 'root' ? 'root' : ''
  ]
}

/** Marques d'une ligne : fichier spécial (B1), exclu pour l'agent (fiche 155). */
function RowMarks({ special, excluded }: { special: boolean; excluded: string | undefined }) {
  const { t } = useTranslation()
  return (
    <>
      {special && (
        <Tip label={t('files.special')}>
          <span className="file-row-mark" data-testid="file-row-special">
            <Ban size={12} />
          </span>
        </Tip>
      )}
      {excluded && (
        <Tip label={excluded}>
          <span className="file-row-mark" data-testid="file-row-excluded">
            <EyeOff size={12} />
          </span>
        </Tip>
      )}
    </>
  )
}

function FileRow({
  row,
  selected,
  menuOpen,
  tabStop,
  changed,
  exclusionFiles,
  menuItems,
  onContextMenu,
  onFocus,
  onActivate,
  onDragStart
}: {
  row: Exclude<TreeRow, { kind: 'note' }>
  selected: boolean
  /** Son menu contextuel est ouvert : la ligne visée reste marquée. */
  menuOpen: boolean
  tabStop: boolean
  changed: ReadonlySet<string>
  exclusionFiles: readonly string[]
  menuItems: React.ReactNode
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void
  onFocus: () => void
  onActivate: () => void
  onDragStart: (event: DragEvent<HTMLDivElement>, root: number, path: string) => void
}) {
  const { t } = useTranslation()
  const entry = row.kind === 'entry' ? row.entry : undefined
  const name = entry ? entry.name : row.kind === 'root' ? row.root.name : ''
  const path = entry?.path ?? ''
  const root = row.kind === 'root' ? row.root.index : row.root
  const isDir = !entry || entry.kind === 'dir'
  const outside = entry?.link === 'outside'
  const special = entry?.special === true
  // Fichier modifié par la conversation ; dossier replié qui en contient (Q6).
  const marked = root === 0 && changed.has(path) && !!entry && (!isDir || !row.open)
  const excluded = exclusionFiles.length
    ? t('files.excluded', { name: exclusionFiles.join(', ') })
    : t('files.excludedPlain')
  // Ce que la ligne dit à un lecteur d'écran (pas d'infobulle native, point 22).
  const label = [
    name,
    entry?.ignored ? t('files.ignored') : '',
    entry?.excluded ? excluded : '',
    outside ? t('files.linkOutside') : '',
    special ? t('files.special') : '',
    marked ? t('files.modified') : ''
  ]
  const classes = rowClasses(row, { selected, menuOpen })
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-label={label.filter(Boolean).join(', ')}
      {...(isDir ? { 'aria-expanded': row.open } : {})}
      tabIndex={tabStop ? 0 : -1}
      data-key={row.key}
      data-path={path}
      data-testid="file-row"
      style={{ paddingLeft: 6 + row.depth * 14 }}
      onClick={onActivate}
      onFocus={onFocus}
      onContextMenu={onContextMenu}
      draggable={!isDir && !outside && !special}
      onDragStart={(event) => onDragStart(event, root, path)}
      onDragEnd={endTreeDrag}
    >
      <span className="file-row-chevron">
        {isDir && !outside && (row.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
      </span>
      <span className="file-row-icon">
        {entry ? <EntryIcon entry={entry} open={row.open} /> : <Folder size={14} />}
      </span>
      <span className="file-row-name">{name}</span>
      <RowMarks special={special} excluded={entry?.excluded ? excluded : undefined} />
      {marked && (
        <Tip label={t('files.modified')}>
          <span className="file-row-dot" data-testid="file-row-modified" />
        </Tip>
      )}
      {!outside && (
        <span className="file-row-menu" onClick={(event) => event.stopPropagation()}>
          <FileActionsMenu
            label={t('files.actions', { name })}
            className="icon-button small file-row-more"
            testId="file-row-actions"
          >
            {menuItems}
          </FileActionsMenu>
        </span>
      )}
    </div>
  )
}
