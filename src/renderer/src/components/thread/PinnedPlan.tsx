import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import type { PlanEntry } from '../../../../shared/acp-sdk.mts'
import { currentEntry, PlanIcon, PlanList } from './PlanList'

/** État replié, retenu d'une conversation à l'autre (comme le panneau). */
const COLLAPSED_KEY = 'bobine.pinnedPlan.collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  } catch {
    // Stockage indisponible : la liste repartira dépliée.
  }
}

/**
 * Liste de tâches de l'agent épinglée juste au-dessus de la zone de saisie pendant le tour
 * (fiche 077) : toujours visible, repliable sur une ligne (tâche en cours et progression).
 */
export function PinnedPlan({ entries }: { entries: PlanEntry[] }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  useEffect(() => saveCollapsed(collapsed), [collapsed])
  const bodyId = useId()
  const body = useRef<HTMLDivElement>(null)
  const done = entries.filter((e) => e.status === 'completed').length
  const current = currentEntry(entries)

  // Liste plus haute que sa place : la tâche en cours reste visible, sans faire défiler le fil.
  useLayoutEffect(() => {
    const list = body.current
    const step = list?.querySelector<HTMLElement>('[aria-current]')
    if (!list || !step) return
    if (step.offsetTop < list.scrollTop) list.scrollTop = step.offsetTop
    else if (step.offsetTop + step.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = step.offsetTop + step.offsetHeight - list.clientHeight
    }
  }, [entries, collapsed])

  const progress = (
    <span className="pinned-plan-count">
      <span aria-hidden="true">
        {done} / {entries.length}
      </span>
      <span className="sr-only">{t('sidePanel.progress', { done, count: entries.length })}</span>
    </span>
  )
  return (
    <section
      className={`pinned-plan${collapsed ? ' collapsed' : ''}`}
      aria-label={t('pinnedPlan.label')}
      data-testid="pinned-plan"
    >
      <button
        className="pinned-plan-head"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={() => setCollapsed((c) => !c)}
        data-testid="pinned-plan-toggle"
      >
        {collapsed && current ? (
          <>
            <span className={`pinned-plan-icon ${current.status}`}>
              <PlanIcon status={current.status} live />
            </span>
            <span className="pinned-plan-current" data-testid="pinned-plan-current">
              {current.content}
            </span>
            {progress}
            <ChevronUp size={15} className="pinned-plan-chevron" />
          </>
        ) : (
          <>
            <ListChecks size={15} />
            <span className="pinned-plan-title">{t('pinnedPlan.title')}</span>
            {progress}
            <span className="grow" />
            <ChevronDown size={15} className="pinned-plan-chevron" />
          </>
        )}
      </button>
      <div className="pinned-plan-body" id={bodyId} ref={body} hidden={collapsed}>
        <PlanList entries={entries} live />
      </div>
    </section>
  )
}
