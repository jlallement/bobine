/**
 * Contrôles de session : traduit les modes et options de configuration ACP en un modèle unique
 * pour l'UI. Fonctions pures, testées sans agent.
 */
import type { SessionConfigOption, SessionModeState } from '../../shared/acp-sdk.mts'
import type { ControlValue, SessionControl } from '@shared/agent'
import { modelControl } from './models-seen'

/** Identifiant du contrôle construit à partir des modes ACP. */
export const MODE_CONTROL_ID = 'mode'

export function buildControls(
  modes: SessionModeState | null | undefined,
  configOptions: SessionConfigOption[] | null | undefined
): SessionControl[] {
  const controls: SessionControl[] = (configOptions ?? []).flatMap((option) =>
    fromConfigOption(option)
  )
  // Les modes ne sont montrés que si aucune option ne joue déjà ce rôle (Codex expose les deux).
  const modeAlreadyShown = controls.some((c) => c.category === 'mode' || c.id === MODE_CONTROL_ID)
  if (modes && modes.availableModes.length > 0 && !modeAlreadyShown) {
    controls.unshift({
      id: MODE_CONTROL_ID,
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: modes.currentModeId,
      options: modes.availableModes.map((m) => ({
        value: m.id,
        name: m.name,
        description: m.description ?? undefined
      }))
    })
  }
  return controls
}

function fromConfigOption(option: SessionConfigOption): SessionControl[] {
  const base = {
    id: option.id,
    name: option.name,
    description: option.description ?? undefined,
    category: option.category ?? undefined
  }
  if (option.type === 'boolean' && typeof option.currentValue === 'boolean') {
    return [{ ...base, type: 'boolean', currentValue: option.currentValue, options: [] }]
  }
  if (option.type === 'select' && 'options' in option && typeof option.currentValue === 'string') {
    const options = option.options.flatMap((entry) =>
      'group' in entry
        ? entry.options.map((o) => ({
            value: o.value,
            name: o.name,
            description: o.description ?? undefined,
            group: entry.name
          }))
        : [{ value: entry.value, name: entry.name, description: entry.description ?? undefined }]
    )
    return [{ ...base, type: 'select', currentValue: option.currentValue, options }]
  }
  return [] // Type futur ou inconnu : ignoré.
}

/** La valeur est-elle acceptable pour ce contrôle ? */
export function isValidValue(control: SessionControl, value: unknown): value is ControlValue {
  if (control.type === 'boolean') return typeof value === 'boolean'
  return typeof value === 'string' && control.options.some((o) => o.value === value)
}

/** Mode de la session au moment d'un message, montré avec lui dans le fil (fiche 040). */
export function currentMode(
  controls: readonly SessionControl[]
): { id: string; name: string } | undefined {
  return chosen(controls.find((c) => c.category === 'mode' && c.type === 'select'))
}

/** Option choisie d'un contrôle `select`, en `{ id, name }`. */
function chosen(control: SessionControl | undefined): { id: string; name: string } | undefined {
  if (control?.type !== 'select') return undefined
  const option = control.options.find((o) => o.value === control.currentValue)
  return option ? { id: option.value, name: option.name } : undefined
}

/** Modèle de la session au moment d'un message (réglage de catégorie `model`, fiche 130). */
export const currentModel = (
  controls: readonly SessionControl[]
): { id: string; name: string } | undefined => chosen(modelControl(controls))

/** Mode et modèle à l'envoi d'un message, à joindre à l'évènement `user-message`. */
export function sessionChoices(controls: readonly SessionControl[]): {
  mode?: { id: string; name: string }
  model?: { id: string; name: string }
} {
  const mode = currentMode(controls)
  const model = currentModel(controls)
  return { ...(mode ? { mode } : {}), ...(model ? { model } : {}) }
}
