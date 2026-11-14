/**
 * Agent et modèle d'un rôle pour `start_child` (fiche 223) : repris quand le profil le permet,
 * sinon laissés de côté avec une note pour l'agent de la mère. Ce qu'il passe lui-même (`agent`,
 * `model`) l'emporte ; tout reste une suggestion confirmée sur la carte (fiche 160).
 */
import type { RoleDefinition } from '@shared/roles'
import type { ChildChoices } from '../conversations/children'

export interface RoleDefaults {
  agent?: string
  model?: string
  /** Ce qui n'a pas pu être repris, en anglais pour l'agent. */
  notes: string[]
  /** Les mêmes, pour l'interface : agent ou modèle du rôle laissés de côté. */
  missing: { agent?: string; model?: string }
}

export function roleDefaults(choices: ChildChoices, role: RoleDefinition): RoleDefaults {
  const notes: string[] = []
  const missing: RoleDefaults['missing'] = {}
  let agent: string | undefined
  if (role.agent) {
    const wanted = role.agent.toLowerCase()
    const found =
      choices.profiles.find((p) => p.id.toLowerCase() === wanted) ??
      choices.profiles.find((p) => p.label.toLowerCase() === wanted)
    if (found?.available) {
      if (found.id !== choices.profileId) agent = found.id
    } else {
      notes.push(
        `The role's agent "${role.agent}" is not available here: the child uses your agent instead.`
      )
      missing.agent = role.agent
    }
  }
  if (!role.model) return { ...(agent ? { agent } : {}), notes, missing }
  const wanted = role.model.toLowerCase()
  const known =
    !agent &&
    choices.model?.options.some(
      (o) => o.value.toLowerCase() === wanted || o.name.toLowerCase() === wanted
    )
  if (known) return { ...(agent ? { agent } : {}), model: role.model, notes, missing }
  notes.push(
    `The role's model "${role.model}" cannot be chosen for this child (agent profile or model list): the agent takes its own model.`
  )
  missing.model = role.model
  return { ...(agent ? { agent } : {}), notes, missing }
}
