import i18next from 'i18next'
import type {
  AgentBlocker,
  AgentSettingsView,
  AgentSnapshot,
  AgentStatus,
  QueuedMessageView,
  SessionControl
} from '@shared/agent'
import { isPlanMode } from '@shared/plan-doc'
import { nextOption } from './composer-keys'

/** Ce que la zone de saisie tire de l'état de l'agent (sorti de `Composer`, fiche 089). */
export interface ComposerView {
  status: AgentStatus
  busy: boolean
  /**
   * Un message peut partir : agent prêt, en réponse (file d'attente, fiche 020), arrêté ou en échec
   * (relancé d'abord, fiche 041).
   */
  canSendNow: boolean
  /** Réponse ou démarrage en cours : ni agent ni dossier à changer. */
  locked: boolean
  queued: QueuedMessageView[]
  controls: SessionControl[]
  modeControl: SessionControl | undefined
  /** Réglage du modèle (catégorie `model`), en puce à droite de la barre (fiche 090). */
  modelControl: SessionControl | undefined
  /** Nom de l'agent dans les phrases (« L'agent » à défaut). */
  agentName: string
  /** Nom de l'agent dans la barre et ses menus (« Agent » à défaut). */
  agentLabel: string
  /** Badges du menu « / » : le profil de l'agent, et les agents installés (commandes de l'app). */
  profileLabel: string
  installedAgents: string[]
  /** Action requise par l'agent (connexion, dossier) : son panneau passe au-dessus de la saisie. */
  blocker: AgentBlocker | undefined
  /** Le mode courant est un mode plan (`isPlanMode`) : la zone de saisie le montre (fiche 098). */
  planMode: boolean
  /** Mode où mène Maj+Tab depuis un mode plan, s'il n'en est pas un lui-même (ligne de rappel). */
  nextModeName: string | undefined
}

/** Mode plan courant, et le mode suivant (Maj+Tab) s'il permet d'en sortir. */
function planState(
  mode: SessionControl | undefined
): Pick<ComposerView, 'planMode' | 'nextModeName'> {
  const option = (value: unknown) => mode?.options.find((o) => o.value === value)
  const current = option(mode?.currentValue)
  const planMode =
    !!mode && isPlanMode({ id: String(mode.currentValue), name: current?.name ?? '' })
  const next = planMode && mode ? option(nextOption(mode)) : undefined
  const leaves = next && !isPlanMode({ id: next.value, name: next.name })
  return { planMode, nextModeName: leaves ? next.name : undefined }
}

export function composerView(
  snapshot: AgentSnapshot | null,
  settings: AgentSettingsView | null
): ComposerView {
  const status = snapshot?.status ?? 'idle'
  const busy = status === 'busy'
  const controls = snapshot?.controls ?? []
  const modeControl = controls.find((c) => c.category === 'mode' && c.type === 'select')
  const named = snapshot?.info.agentName ?? snapshot?.info.profileLabel
  const agentLabel = named ?? i18next.t('composer.agent')
  const profileLabel = snapshot?.info.profileLabel ?? agentLabel
  const installed = settings?.profiles.filter((p) => p.available).map((p) => p.label) ?? []
  return {
    status,
    busy,
    canSendNow: status === 'ready' || busy || status === 'exited' || status === 'error',
    locked: busy || status === 'starting',
    queued: snapshot?.queued ?? [],
    controls,
    modeControl,
    modelControl: controls.find((c) => c.category === 'model' && c.type === 'select'),
    agentName: named ?? i18next.t('composer.theAgent'),
    agentLabel,
    profileLabel,
    installedAgents: installed.length > 0 ? installed : [profileLabel],
    blocker: status === 'needs-action' ? snapshot?.blocker : undefined,
    ...planState(modeControl)
  }
}
