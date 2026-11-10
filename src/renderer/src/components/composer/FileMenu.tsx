import { FileText } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { WorkspaceFile } from '@shared/attachments'
import type { ContextMention } from '@shared/context-mentions'
import { ContextIcon } from './ContextIcon'
import { useMenuPlacement } from './menu-placement'
import { useTranslation } from 'react-i18next'

/** Entrée du menu `@` : une mention de contexte (fiche 057) ou un fichier du dossier. */
export type MentionEntry =
  { kind: 'context'; mention: ContextMention } | { kind: 'file'; file: WorkspaceFile }

interface Props {
  items: MentionEntry[]
  active: number
  workspaceName: string
  onHover: (index: number) => void
  onPick: (entry: MentionEntry) => void
}

/**
 * Mention `@` en cours de saisie : `@git-changes`, `@terminal` (fiche 057), puis les fichiers du
 * dossier (placé comme `CommandMenu`).
 */
export function FileMenu({ items, active, workspaceName, onHover, onPick }: Props) {
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
      <div className="menu-label">{t('fileMenu.title', { workspace: workspaceName })}</div>
      <div className="command-list" ref={list}>
        {items.length === 0 ? (
          <div className="command-empty">{t('fileMenu.empty')}</div>
        ) : (
          items.map((entry, i) => {
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
      </div>
      <div className="command-footer">{t('fileMenu.keys')}</div>
    </div>
  )
}
