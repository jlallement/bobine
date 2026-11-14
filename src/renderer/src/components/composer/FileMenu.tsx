import { FileText } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { WorkspaceFile } from '@shared/attachments'
import type { ContextMention } from '@shared/context-mentions'
import { ContextIcon } from './ContextIcon'
import { useMenuPlacement } from './menu-placement'
import { useTranslation } from 'react-i18next'
import {
  RoleMenuFooterActions,
  RoleMenuRow,
  RolesInvite,
  type RoleMenuEntry
} from '../roles/RoleMenu'

/**
 * Entrée du menu `@` : un rôle (fiche 223), une mention de contexte (fiche 057) ou un fichier du
 * dossier.
 */
export type MentionEntry =
  | RoleMenuEntry
  | { kind: 'context'; mention: ContextMention }
  | { kind: 'file'; file: WorkspaceFile }

const isRoleEntry = (entry: MentionEntry): entry is RoleMenuEntry =>
  entry.kind === 'role' || entry.kind === 'role-more' || entry.kind === 'role-new'
/**
 * Rôles de la section en tête (trouvés par leur nom ou leur libellé). Les rôles trouvés par leur
 * seule description et « + Nouveau rôle » sont en fin de menu, après les fichiers (derniers au
 * clavier) : Entrée après `@git`, `@test` ou `@src` prend la mention ou le fichier.
 */
const isRoleSection = (entry: MentionEntry): boolean =>
  (entry.kind === 'role' && !entry.byDescription) || entry.kind === 'role-more'
const isLateRole = (entry: MentionEntry): boolean =>
  (entry.kind === 'role' && !!entry.byDescription) || entry.kind === 'role-new'

/** Rôles dans le menu (fiche 223) : invitation sans rôle, création et gestion si l'app les ouvre. */
export interface RoleMenuOptions {
  /** Aucun rôle actif et invitation pas écartée : elle remplace la section des rôles. */
  invite?: { onHide: () => void }
  onCreate?: () => void
  onManage?: () => void
}

interface Props {
  items: MentionEntry[]
  active: number
  workspaceName: string
  onHover: (index: number) => void
  onPick: (entry: MentionEntry) => void
  roles?: RoleMenuOptions
}

/**
 * Mention `@` en cours de saisie : les rôles (fiche 223), `@git-changes`, `@terminal` (fiche 057),
 * puis les fichiers du dossier (placé comme `CommandMenu`).
 */
export function FileMenu({ items, active, workspaceName, onHover, onPick, roles }: Props) {
  const { t } = useTranslation()
  const menu = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const placement = useMenuPlacement(menu)

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div
      ref={menu}
      className={`command-menu ${placement.side}`}
      style={{ maxHeight: placement.maxHeight }}
      role="listbox"
      data-placement={placement.side}
      data-testid="file-menu"
    >
      <div className="command-list" ref={list}>
        {roles?.invite && <RolesInvite onCreate={roles.onCreate} onHide={roles.invite.onHide} />}
        {items.some(isRoleSection) && (
          <div className="menu-label role-menu-label">
            <span>{t('roleWork.menu.title')}</span>
            <span className="role-menu-hint">{t('roleWork.menu.hint')}</span>
          </div>
        )}
        {items.map((entry, i) =>
          isRoleEntry(entry) && isRoleSection(entry) ? (
            <RoleMenuRow
              key={entry.kind === 'role' ? `role:${entry.role.name}` : entry.kind}
              entry={entry}
              index={i}
              active={i === active}
              onHover={onHover}
              onPick={() => onPick(entry)}
            />
          ) : null
        )}
        <div className="menu-label">{t('fileMenu.title', { workspace: workspaceName })}</div>
        {!items.some((entry) => !isRoleEntry(entry)) ? (
          <div className="command-empty">{t('fileMenu.empty')}</div>
        ) : (
          items.map((entry, i) => {
            if (isRoleEntry(entry)) return null
            if (entry.kind === 'context') {
              const { mention } = entry
              return (
                <button
                  key={`@${mention.name}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className={`command-item file-item${i === active ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onPick(entry)
                  }}
                  onMouseMove={() => onHover(i)}
                  data-testid="context-item"
                >
                  <span className="file-item-icon">
                    <ContextIcon source={mention.source} />
                  </span>
                  <span className="file-item-name">@{mention.name}</span>
                  <span className="command-description">{mention.description}</span>
                </button>
              )
            }
            const { file } = entry
            const slash = file.relative.lastIndexOf('/')
            return (
              <button
                key={file.path}
                type="button"
                role="option"
                aria-selected={i === active}
                data-index={i}
                className={`command-item file-item${i === active ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(entry)
                }}
                onMouseMove={() => onHover(i)}
                data-testid="file-item"
              >
                <FileText size={14} className="file-item-icon" />
                <span className="file-item-name">{file.relative.slice(slash + 1)}</span>
                {slash > 0 && (
                  <span className="command-description">{file.relative.slice(0, slash)}</span>
                )}
              </button>
            )
          })
        )}
        {items.some((entry) => entry.kind === 'role' && entry.byDescription) && (
          <div className="menu-label role-menu-label" data-testid="role-menu-by-description">
            <span>{t('roleWork.menu.byDescription')}</span>
          </div>
        )}
        {items.map((entry, i) =>
          isRoleEntry(entry) && isLateRole(entry) ? (
            <RoleMenuRow
              key={entry.kind === 'role' ? `role:${entry.role.name}` : entry.kind}
              entry={entry}
              index={i}
              active={i === active}
              onHover={onHover}
              onPick={() => onPick(entry)}
            />
          ) : null
        )}
      </div>
      <div className="command-footer role-menu-footer">
        <span>{t('fileMenu.keys')}</span>
        <RoleMenuFooterActions onCreate={roles?.onCreate} onManage={roles?.onManage} />
      </div>
    </div>
  )
}
