import { Ban, Check, ChevronRight, Layers, LoaderCircle, ShieldX, X } from 'lucide-react'
import { memo, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import type { TerminalState } from '@shared/terminal-output'
import { toolGroupState, toolGroupSummary, type ToolItem } from '@shared/tool-groups'
import { ToolCall, ToolImages, WorkspaceContext, type RespondPermission } from './ToolCall'
import { appToolText } from '@shared/app-tools'
import { toolText } from '@shared/tool-label'

/**
 * Outils consécutifs regroupés (fiche 047) : une ligne de résumé, les cartes au dépliage. L'outil en
 * cours reste nommé, et les dernières captures restent visibles sans déplier.
 */
export const ToolGroup = memo(
  function ToolGroup({
    items,
    terminals,
    onRespond
  }: {
    items: ToolItem[]
    terminals: Record<string, TerminalState>
    onRespond: RespondPermission
  }) {
    const workspace = useContext(WorkspaceContext)
    const { running, failed, refused, cancelled } = toolGroupState(items)
    const images = items.findLast((item) => item.images?.length)?.images
    return (
      <div className="tool-group" data-testid="tool-group" data-count={items.length}>
        <details className="tool">
          <summary className="tool-row">
            <Layers size={15} className="tool-icon" />
            <span className="tool-title" data-testid="tool-group-summary">
              {toolGroupSummary(items)}
              {running && (
                <span className="tool-group-current">
                  {' — '}
                  {running.appTool ? appToolText(running.appTool) : toolText(running, workspace)}
                </span>
              )}
            </span>
            <GroupState
              running={!!running}
              failed={failed}
              refused={refused}
              cancelled={cancelled}
            />
            <ChevronRight size={14} className="chevron tool-icon" />
          </summary>
          <div className="tool-group-items">
            {items.map((item) => (
              <ToolCall
                key={item.id}
                item={item}
                terminal={item.terminalId ? terminals[item.terminalId] : undefined}
                onRespond={onRespond}
                hideImages
              />
            ))}
          </div>
        </details>
        {images && <ToolImages images={images} />}
      </div>
    )
  },
  // Même groupe tant que ses outils, leurs terminaux et la réponse aux autorisations sont les mêmes.
  (a, b) =>
    a.onRespond === b.onRespond &&
    a.items.length === b.items.length &&
    a.items.every(
      (item, i) =>
        item === b.items[i] &&
        (!item.terminalId || a.terminals[item.terminalId] === b.terminals[item.terminalId])
    )
)

function GroupState({
  running,
  failed,
  refused,
  cancelled
}: {
  running: boolean
  failed: number
  refused: number
  cancelled: number
}) {
  const { t } = useTranslation()
  if (running) {
    return (
      <span className="tool-state" aria-label={t('toolGroup.running')}>
        <LoaderCircle size={14} className="spin" />
      </span>
    )
  }
  if (failed > 0) {
    return (
      <span className="tool-state failed">
        <X size={14} /> {t('toolGroup.failed', { count: failed })}
      </span>
    )
  }
  if (refused > 0) {
    return (
      <span className="tool-state refused">
        <ShieldX size={14} /> {t('toolGroup.refused', { count: refused })}
      </span>
    )
  }
  if (cancelled > 0) {
    return (
      <span className="tool-state cancelled">
        <Ban size={13} /> {t('toolGroup.cancelled', { count: cancelled })}
      </span>
    )
  }
  return (
    <span className="tool-state completed" aria-label={t('toolGroup.completed')}>
      <Check size={15} />
    </span>
  )
}
