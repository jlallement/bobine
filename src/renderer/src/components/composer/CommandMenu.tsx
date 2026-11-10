import { useEffect, useRef } from 'react'
import type { AgentCommand } from '@shared/agent'
import { useMenuPlacement } from './menu-placement'
import { useTranslation } from 'react-i18next'

interface Props {
  items: AgentCommand[]
  active: number
  /** Agent de la conversation : badge de ses propres commandes. */
  agentLabel: string
  /** Agents installés : badges des commandes de l'app, valables avec chacun. */
  agentLabels: readonly string[]
  onHover: (index: number) => void
  onPick: (command: AgentCommand) => void
}

/**
 * Liste des commandes « / » contre la zone de saisie, comme dans Claude Code : au-dessus, ou en
 * dessous quand il y a plus de place (écran d'accueil), sans jamais déborder de la fenêtre.
 */
export function CommandMenu({ items, active, agentLabel, agentLabels, onHover, onPick }: Props) {
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
      data-testid="command-menu"
    >
      <div className="menu-label">{t('commandMenu.title')}</div>
      <div className="command-list" ref={list}>
        {items.length === 0 ? (
          <div className="command-empty">{t('commandMenu.empty')}</div>
        ) : (
          items.map((command, i) => (
            <button
              key={command.name}
              type="button"
              role="option"
              aria-selected={i === active}
              data-index={i}
              className={`command-item${i === active ? ' active' : ''}`}
              // mousedown : garde le focus dans la zone de saisie.
              onMouseDown={(e) => {
                e.preventDefault()
                onPick(command)
              }}
              onMouseMove={() => onHover(i)}
              data-testid="command-item"
            >
              <span className="command-name">
                /{command.name}
                {command.hint && <span className="command-hint"> {command.hint}</span>}
              </span>
              <span className="command-description">{command.description}</span>
              {/* Hors de la description (coupée si elle est longue) : toujours visibles. Commande
                  de l'app : valable avec chaque agent, d'où un badge par agent installé. */}
              <span
                className="command-sources"
                {...(command.source === 'app' ? { title: t('commandMenu.appCommand') } : {})}
              >
                {command.source === 'app' ? (
                  agentLabels.map((label) => (
                    <span key={label} className="command-source from-app">
                      {label}
                    </span>
                  ))
                ) : (
                  <span
                    className={`command-source${command.source ? ` from-${command.source}` : ''}`}
                  >
                    {command.source === 'user'
                      ? t('commandMenu.source.user')
                      : command.source === 'project'
                        ? t('commandMenu.source.project')
                        : agentLabel}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="command-footer">{t('commandMenu.keys')}</div>
    </div>
  )
}
