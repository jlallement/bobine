import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { openOutcomeNote } from '@shared/file-links'
import type { FileRoot } from '@shared/files'
import { useEditorAction } from '../../useEditor'
import { ipcErrorText } from '../../ipc-errors'
import { Tip } from '../common/Menus'

/** Un fichier ou un dossier de l'arbre, désigné par sa racine et son chemin relatif. */
export interface FileItem {
  root: number
  path: string
  kind: 'dir' | 'file'
  /** S'exécuterait si on l'ouvrait : pas d'« Ouvrir avec l'app par défaut ». */
  executable?: boolean | undefined
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

/** Entrées du menu d'un fichier ou d'un dossier (menu ⋮ et clic droit d'une ligne, Q50). */
export function FileActionItems({
  item,
  actions,
  changed,
  line,
  onCollapse
}: {
  item: FileItem
  actions: FileActions
  changed: boolean
  line?: number
  /** Dossier déplié : « Réduire » (lui et ses sous-dossiers). */
  onCollapse?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const entry = (label: string, run: () => void, testId: string) => (
    <Dropdown.Item className="menu-item" onSelect={run} data-testid={testId}>
      <span className="menu-text">{label}</span>
    </Dropdown.Item>
  )
  const { openInEditor, mention, showDiff } = actions
  const file = item.kind === 'file'
  return (
    <>
      {openInEditor &&
        actions.editorName &&
        entry(
          t('editor.open', { editor: actions.editorName }),
          () => openInEditor(item, line),
          'file-action-editor'
        )}
      {/* Un exécutable ne s'ouvre jamais avec l'app par défaut (fiche 052, point 14). */}
      {file &&
        !item.executable &&
        entry(t('files.openDefault'), () => actions.openDefault(item), 'file-action-default')}
      {entry(t('files.reveal'), () => actions.reveal(item), 'file-action-reveal')}
      {mention && file && entry(t('files.mention'), () => mention(item), 'file-action-mention')}
      {onCollapse && entry(t('files.collapse'), onCollapse, 'file-action-collapse')}
      <Dropdown.Separator className="menu-separator" />
      {entry(t('files.copyRelative'), () => actions.copyRelative(item), 'file-action-copy')}
      {entry(t('files.copyAbsolute'), () => actions.copyAbsolute(item), 'file-action-copy-abs')}
      {showDiff &&
        changed &&
        file &&
        item.root === 0 &&
        entry(t('files.showDiff'), () => showDiff(item), 'file-action-diff')}
    </>
  )
}

/** Bouton ⋮ d'un fichier ou d'un dossier : ses actions (le menu … de l'onglet règle la vue). */
export function FileActionsMenu({
  label,
  children,
  className = 'icon-button small',
  testId = 'file-actions'
}: {
  label: string
  children: ReactNode
  className?: string
  testId?: string
}) {
  return (
    <Dropdown.Root modal={false}>
      <Tip label={label}>
        <Dropdown.Trigger className={className} aria-label={label} data-testid={testId}>
          <MoreVertical size={14} />
        </Dropdown.Trigger>
      </Tip>
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

/** Où ouvrir le menu contextuel : au pointeur, ou sous la ligne (Maj+F10, touche Menu). */
export interface ContextAt {
  x: number
  y: number
}

/**
 * Menu contextuel de l'arbre (point 17) : ouvert au pointeur par un clic droit, ou sous la ligne
 * au clavier. Un ancrage invisible, posé à cet endroit, sert de déclencheur au menu.
 */
export function FileContextMenu({
  at,
  onClose,
  onCloseFocus,
  children
}: {
  at: ContextAt | null
  onClose: () => void
  /** Où rendre le clavier à la fermeture (la ligne), plutôt qu'à l'ancrage invisible. */
  onCloseFocus?: () => void
  children: ReactNode
}) {
  return (
    <Dropdown.Root modal={false} open={!!at} onOpenChange={(open) => !open && onClose()}>
      {/* L'ancrage vit dans `body` : ses coordonnées sont celles de la fenêtre, quel que soit le
          panneau (agrandi, animé). */}
      {createPortal(
        <Dropdown.Trigger asChild>
          <span
            className="file-context-anchor"
            aria-hidden="true"
            style={{ left: at?.x ?? 0, top: at?.y ?? 0 }}
          />
        </Dropdown.Trigger>,
        document.body
      )}
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu"
          align="start"
          side="bottom"
          sideOffset={2}
          collisionPadding={12}
          data-testid="file-context-menu"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onCloseFocus?.()
          }}
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
