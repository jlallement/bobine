import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  File,
  FileCode2,
  FileImage,
  FileJson,
  FileSymlink,
  FileText,
  Folder,
  FolderOpen
} from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { extensionOf, imageType, type FileEntry, type FileRoot } from '@shared/files'
import { countText } from '@shared/i18n/format'
import { dirKey } from '../../files-state'
import { FileActionItems, FileActionsMenu, type FileActions } from './FileActions'
import type { Listing } from './useFilesTab'
import { FILE_DRAG_TYPE } from '../../useFileDrop'

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

const CODE = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'vue',
  'svelte',
  'sql',
  'yml',
  'yaml',
  'toml',
  'xml',
  'lua',
  'r',
  'pl',
  'm',
  'mm'
])

/** Icône d'une entrée selon son type (Q23). */
function EntryIcon({ entry, open }: { entry: FileEntry; open: boolean }) {
  if (entry.kind === 'dir') return open ? <FolderOpen size={14} /> : <Folder size={14} />
  if (entry.link) return <FileSymlink size={14} />
  const extension = extensionOf(entry.name)
  if (imageType(entry.name)) return <FileImage size={14} />
  if (extension === 'json' || extension === 'jsonc') return <FileJson size={14} />
  if (CODE.has(extension)) return <FileCode2 size={14} />
  if (['md', 'mdx', 'markdown', 'txt', 'pdf', 'rst'].includes(extension)) {
    return <FileText size={14} />
  }
  return <File size={14} />
}

interface Props {
  rows: TreeRow[]
  /** Ligne du fichier ouvert (surlignée). */
  selected?: string | undefined
  /** Fichiers modifiés par la conversation, et leurs dossiers (Q6). */
  changed: ReadonlySet<string>
  /** Nom du fichier d'exclusions de l'agent, pour l'infobulle (fiche 155). */
  actions: FileActions
  onToggle: (root: number, path: string, open?: boolean) => void
  onOpen: (root: number, path: string) => void
}

/**
 * Arbre des fichiers (Q21 à Q32) : `role="tree"`, une ligne focalisable à la fois ; ↑ ↓ parcourent,
 * → déplie ou entre, ← replie ou remonte, ↵ ouvre, Début / Fin. Clic droit sur une ligne : son menu
 * d'actions. Une ligne de fichier se glisse sur la zone de saisie (mention).
 */
export function FileTree({ rows, selected, changed, actions, onToggle, onOpen }: Props) {
  const { t } = useTranslation()
  const items = rows.filter((row) => row.kind !== 'note')
  const [focused, setFocused] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
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

  const focusRow = (key: string | undefined) => {
    if (!key) return
    setFocused(key)
    box.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus()
  }
  const activate = (row: TreeRow) => {
    if (row.kind === 'root') onToggle(row.root.index, '', !row.open)
    else if (row.kind === 'entry') {
      if (row.entry.link === 'outside') return
      if (row.entry.kind === 'dir') onToggle(row.root, row.entry.path)
      else onOpen(row.root, row.entry.path)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((row) => row.key === (focused ?? tabStop))
    const row = items[index]
    if (!row) return
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
    const absolute = actions.absolute({ root, path })
    event.dataTransfer.setData(FILE_DRAG_TYPE, absolute)
    event.dataTransfer.setData('text/plain', path)
    event.dataTransfer.effectAllowed = 'copy'
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
            tabStop={row.key === tabStop}
            changed={changed}
            actions={actions}
            menuOpen={menuFor === row.key}
            onMenu={(open) => setMenuFor(open ? row.key : null)}
            onFocus={() => setFocused(row.key)}
            onActivate={() => {
              setFocused(row.key)
              activate(row)
            }}
            onDragStart={onDragStart}
          />
        )
      )}
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

/** Une ligne de dossier, de fichier ou de racine. */
function FileRow({
  row,
  selected,
  tabStop,
  changed,
  actions,
  menuOpen,
  onMenu,
  onFocus,
  onActivate,
  onDragStart
}: {
  row: Exclude<TreeRow, { kind: 'note' }>
  selected: boolean
  tabStop: boolean
  changed: ReadonlySet<string>
  actions: FileActions
  menuOpen: boolean
  onMenu: (open: boolean) => void
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
  // Fichier modifié par la conversation ; dossier replié qui en contient (Q6).
  const marked = root === 0 && changed.has(path) && !!entry && (!isDir || !row.open)
  const title = [
    row.kind === 'root' ? row.root.path : path,
    entry?.ignored ? t('files.ignored') : '',
    entry?.excluded ? t('files.excludedPlain') : '',
    outside ? t('files.linkOutside') : '',
    marked ? t('files.modified') : ''
  ]
  const classes = [
    'file-row',
    entry?.ignored ? 'ignored' : '',
    outside ? 'outside' : '',
    selected ? 'selected' : '',
    row.kind === 'root' ? 'root' : ''
  ]
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      {...(isDir ? { 'aria-expanded': row.open } : {})}
      tabIndex={tabStop ? 0 : -1}
      data-key={row.key}
      data-path={path}
      data-testid="file-row"
      title={title.filter(Boolean).join(' · ')}
      style={{ paddingLeft: 6 + row.depth * 14 }}
      onClick={onActivate}
      onFocus={onFocus}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu(true)
      }}
      draggable={!isDir && !outside}
      onDragStart={(event) => onDragStart(event, root, path)}
    >
      <span className="file-row-chevron">
        {isDir && !outside && (row.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
      </span>
      <span className="file-row-icon">
        {entry ? <EntryIcon entry={entry} open={row.open} /> : <Folder size={14} />}
      </span>
      <span className="file-row-name">{name}</span>
      {entry?.excluded && (
        <EyeOff size={12} className="file-row-mark" aria-label={t('files.excludedPlain')} />
      )}
      {marked && (
        <span
          className="file-row-dot"
          aria-label={t('files.modified')}
          data-testid="file-row-modified"
        />
      )}
      {!outside && (
        <span className="file-row-menu" onClick={(event) => event.stopPropagation()}>
          <FileActionsMenu
            label={t('files.actions', { name })}
            open={menuOpen}
            onOpenChange={onMenu}
            className="icon-button small file-row-more"
            testId="file-row-actions"
          >
            <FileActionItems
              item={{ root, path, kind: isDir ? 'dir' : 'file' }}
              actions={actions}
              changed={root === 0 && changed.has(path)}
            />
          </FileActionsMenu>
        </span>
      )}
    </div>
  )
}
