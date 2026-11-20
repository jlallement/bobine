import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { openOutcomeNote } from '@shared/file-links'
import type { FileRoot } from '@shared/files'
import { useEditorAction } from '../../useEditor'
import { ipcErrorText } from '../../ipc-errors'

/** Un fichier ou un dossier de l'arbre, désigné par sa racine et son chemin relatif. */
export interface FileItem {
  root: number
  path: string
  kind: 'dir' | 'file'
}

/** Ce que l'onglet sait faire d'un fichier (Q50) ; les avis passent par `notify`. */
export interface FileActions {
  editorName?: string
  openInEditor?: (item: FileItem, line?: number) => void
  openDefault: (item: FileItem) => void
  reveal: (item: FileItem) => void
  mention?: (item: FileItem) => void
  copyRelative: (item: FileItem) => void
  copyAbsolute: (item: FileItem) => void
  showDiff?: (item: FileItem) => void
  /** Chemin absolu (copie, mention, liens d'un Markdown). */
  absolute: (item: Pick<FileItem, 'root' | 'path'>) => string
}

/** Chemin absolu d'un chemin relatif d'une racine (séparateur du système de la racine). */
export function absoluteIn(root: FileRoot | undefined, path: string): string {
  if (!root) return path
  const sep = root.path.includes('\\') && !root.path.includes('/') ? '\\' : '/'
  return path ? `${root.path.replace(/[\\/]+$/, '')}${sep}${path.split('/').join(sep)}` : root.path
}

/**
 * Actions de l'onglet Fichiers : éditeur (dossier de la conversation seulement, fiche 156), app par
 * défaut et Finder (vérifiés par le main), mention dans la saisie, copie du chemin, diff.
 */
export function useFileActions(options: {
  conversationId: string
  roots: readonly FileRoot[]
  notify: (message: string) => void
  onMention?: (paths: string[]) => void
  onShowDiff?: (absolutePath: string) => void
  /** Fichiers modifiés par la conversation (chemins relatifs à la racine 0). */
  changed: ReadonlySet<string>
}): FileActions {
  const { conversationId, roots, notify, onMention, onShowDiff, changed } = options
  const editor = useEditorAction(conversationId, { info: notify, warn: notify })
  const api = window.api.fileTree
  const absolute = useCallback(
    (item: Pick<FileItem, 'root' | 'path'>) => absoluteIn(roots[item.root], item.path),
    [roots]
  )
  const fail = useCallback((e: unknown) => notify(ipcErrorText(e)), [notify])
  return useMemo(
    () => ({
      ...(editor
        ? {
            editorName: editor.name,
            openInEditor: (item: FileItem, line?: number) =>
              item.root === 0
                ? editor.open(item.path || '.', line ? { line } : {})
                : editor.open(absolute(item), line ? { line } : {})
          }
        : {}),
      openDefault: (item: FileItem) =>
        void api
          .open(conversationId, item.root, item.path)
          .then((outcome) => {
            const note = openOutcomeNote(outcome)
            if (note) notify(note)
          })
          .catch(fail),
      reveal: (item: FileItem) => void api.reveal(conversationId, item.root, item.path).catch(fail),
      ...(onMention ? { mention: (item: FileItem) => onMention([absolute(item)]) } : {}),
      copyRelative: (item: FileItem) => void navigator.clipboard.writeText(item.path).catch(fail),
      copyAbsolute: (item: FileItem) =>
        void navigator.clipboard.writeText(absolute(item)).catch(fail),
      ...(onShowDiff
        ? {
            showDiff: (item: FileItem) => {
              if (item.root === 0 && changed.has(item.path)) onShowDiff(absolute(item))
            }
          }
        : {}),
      absolute
    }),
    [editor, api, conversationId, notify, fail, onMention, onShowDiff, changed, absolute]
  )
}

/** Entrées du menu d'un fichier ou d'un dossier (menu … et clic droit d'une ligne, Q50). */
export function FileActionItems({
  item,
  actions,
  changed,
  line
}: {
  item: FileItem
  actions: FileActions
  changed: boolean
  line?: number
}) {
  const { t } = useTranslation()
  const entry = (label: string, run: () => void, testId: string) => (
    <Dropdown.Item className="menu-item" onSelect={run} data-testid={testId}>
      {label}
    </Dropdown.Item>
  )
  const { openInEditor, mention, showDiff } = actions
  return (
    <>
      {openInEditor &&
        actions.editorName &&
        entry(
          t('editor.open', { editor: actions.editorName }),
          () => openInEditor(item, line),
          'file-action-editor'
        )}
      {item.kind === 'file' &&
        entry(t('files.openDefault'), () => actions.openDefault(item), 'file-action-default')}
      {entry(t('files.reveal'), () => actions.reveal(item), 'file-action-reveal')}
      {mention &&
        item.kind === 'file' &&
        entry(t('files.mention'), () => mention(item), 'file-action-mention')}
      <Dropdown.Separator className="menu-separator" />
      {entry(t('files.copyRelative'), () => actions.copyRelative(item), 'file-action-copy')}
      {entry(t('files.copyAbsolute'), () => actions.copyAbsolute(item), 'file-action-copy-abs')}
      {showDiff &&
        changed &&
        item.root === 0 &&
        entry(t('files.showDiff'), () => showDiff(item), 'file-action-diff')}
    </>
  )
}

/** Bouton … d'un fichier ou d'un dossier, ouvert aussi par un clic droit sur sa ligne. */
export function FileActionsMenu({
  label,
  open,
  onOpenChange,
  children,
  className = 'icon-button small',
  testId = 'file-actions'
}: {
  label: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
  testId?: string
}) {
  return (
    <Dropdown.Root
      modal={false}
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <Dropdown.Trigger className={className} aria-label={label} title={label} data-testid={testId}>
        <MoreHorizontal size={14} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu"
          align="end"
          sideOffset={4}
          collisionPadding={12}
          data-testid="file-actions-menu"
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
