/**
 * Ce que la fenêtre principale montre du plan et de l'agent (sorti d'`App.tsx`) : le plan en
 * cours, la liste épinglée pendant le tour (fiche 077), les comptes des onglets du panneau
 * (fiche 082) et ce que fait l'agent quand le panneau est agrandi.
 */
import type { AgentSnapshot } from '@shared/agent'
import type { PanelTab } from '@shared/panel'
import { executionMode, planExecution, planFeedback, type PlanNote } from '@shared/plan-doc'
import type { TranscriptItem } from '@shared/transcript'
import { lastPlan, pinnedPlanOf } from './components/thread/PlanList'

export function planBadges(
  items: TranscriptItem[],
  busy: boolean,
  changedFiles: number,
  request: boolean
) {
  const plan = lastPlan(items)
  const planDone = plan?.entries.filter((e) => e.status === 'completed').length ?? 0
  const panelCounts: Partial<Record<PanelTab, string>> = {
    ...(changedFiles > 0 ? { changes: String(changedFiles) } : {}),
    ...(plan && plan.entries.length > 0 ? { tasks: `${planDone}/${plan.entries.length}` } : {})
  }
  // Une demande passe avant le travail en cours.
  const agentStatus: 'request' | 'busy' | undefined = request
    ? 'request'
    : busy
      ? 'busy'
      : undefined
  return { plan, planDone, pinnedPlan: pinnedPlanOf(items, busy), panelCounts, agentStatus }
}

/**
 * Actions d'un plan annoté (fiche 040) : remarques renvoyées à l'agent, ou retour en mode
 * d'exécution (le mode choisi d'après le fil) puis l'ordre d'exécuter.
 */
export function planActionsFor(
  conversationId: string | null,
  snapshot: AgentSnapshot | null,
  items: TranscriptItem[],
  send: (text: string) => unknown
) {
  if (!conversationId) return undefined
  const execute = async (path?: string) => {
    const control = snapshot?.controls.find(
      (ctl) => ctl.category === 'mode' && ctl.type === 'select'
    )
    if (control?.type === 'select') {
      const mode = executionMode(items, control.options)
      if (mode && mode !== control.currentValue) {
        await window.api.agent.setControl(conversationId, control.id, mode).catch(() => {})
      }
    }
    send(planExecution(path))
  }
  return {
    busy: snapshot?.status !== 'ready',
    conversationId,
    onSendNotes: (notes: PlanNote[], path?: string) => send(planFeedback(notes, path)),
    onExecute: (path?: string) => void execute(path)
  }
}
