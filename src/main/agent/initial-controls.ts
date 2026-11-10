/**
 * Réglages appliqués à l'ouverture d'une session (sortis de `agent-host.ts`, fiche 142) : ceux
 * retenus pour le profil (préférences, sinon défauts du profil), puis le mode de départ choisi
 * dans les réglages. Un réglage inapplicable est signalé dans le fil sans bloquer la session.
 */
import { RequestError } from '../../shared/acp-sdk.mts'
import type { AgentEvent, ControlValue, SessionControl } from '@shared/agent'
import { executionMode, isPlanMode } from '@shared/plan-doc'
import { log } from '../log'
import { errorMessage } from './process-utils'
import type { AgentProfile } from './profiles'

export interface InitialControlsInput {
  /** Réglages de la session, relus après chaque changement. */
  controls: () => SessionControl[]
  /** Envoie un réglage à l'agent. */
  apply: (id: string, value: ControlValue) => Promise<void>
  /** Rejetée si l'agent meurt pendant l'ouverture. */
  failed: Promise<never>
  emit: (event: AgentEvent) => void
  /** Réglages retenus pour le profil (préférences, sinon défauts du profil). */
  initialControls?: Record<string, ControlValue> | undefined
  /** Mode de départ (réglage « Nouvelle conversation ») ; absent à la réouverture d'une session. */
  initialMode?: 'plan' | 'execute' | undefined
}

/** Réglages retenus, puis mode de départ. */
export async function applyInitialSettings(input: InitialControlsInput): Promise<void> {
  await applyInitialControls(input, input.initialControls ?? {})
  await applyInitialMode(input, input.initialMode)
}

/** Applique les réglages initiaux ; un réglage inapplicable est signalé sans bloquer la session. */
async function applyInitialControls(
  input: InitialControlsInput,
  wanted: Record<string, ControlValue>
): Promise<void> {
  for (const [id, value] of Object.entries(wanted)) {
    const control = input.controls().find((c) => c.id === id)
    if (control?.currentValue === value) continue
    try {
      await Promise.race([input.apply(id, value), input.failed])
    } catch (error) {
      input.emit({
        type: 'notice',
        level: 'warning',
        message: {
          key: 'agentHost.notice.controlFailed',
          params: { name: control?.name ?? id, value: String(value), error: errorMessage(error) }
        }
      })
    }
  }
}

/** Mode de départ choisi dans les réglages, s'il diffère du mode courant. */
async function applyInitialMode(
  input: InitialControlsInput,
  wanted: 'plan' | 'execute' | undefined
): Promise<void> {
  const control = input.controls().find((c) => c.category === 'mode' && c.type === 'select')
  if (!wanted || control?.type !== 'select') return
  const value =
    wanted === 'plan'
      ? control.options.find((o) => isPlanMode({ id: o.value, name: o.name }))?.value
      : executionMode([], control.options)
  if (!value || value === control.currentValue) return
  await Promise.race([input.apply(control.id, value), input.failed]).catch((error: unknown) => {
    input.emit({
      type: 'notice',
      level: 'warning',
      message: { key: 'agentHost.notice.modeFailed', params: { error: errorMessage(error) } }
    })
  })
}

/**
 * Ouvre la session avec le mode de départ dans `_meta` quand le profil le permet (fiche 163 ;
 * Bob : `bob/mode`). Mode refusé par l'agent (`invalidParams`) : session ouverte sans, le mode
 * étant ensuite appliqué par `applyInitialSettings`, comme pour tout agent.
 */
export async function openWithStartMode<T>(
  open: (meta?: Record<string, string>) => Promise<T>,
  modeMeta: AgentProfile['initialModeMeta'],
  wanted: 'plan' | 'execute' | undefined
): Promise<T> {
  if (!modeMeta || !wanted) return open()
  try {
    return await open({ [modeMeta.key]: modeMeta.ids[wanted] })
  } catch (error) {
    if ((error as { code?: unknown }).code !== RequestError.invalidParams().code) throw error
    log.warn(`Mode de départ refusé à l'ouverture (${modeMeta.key}) : ${errorMessage(error)}`)
    return open()
  }
}
