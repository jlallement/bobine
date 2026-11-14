/**
 * Lancement d'une fille avec un rôle (fiche 223) : son mode natif si l'agent l'a, sinon la
 * consigne du rôle en tête du premier message (ACP ne permet pas de poser un prompt système) ; la
 * lecture seule toujours dite à l'agent, et dite à l'utilisateur quand elle n'est que demandée.
 */
import type { ConversationSummary, SessionControl } from '@shared/agent'
import { roleOpening, type ReadOnlyLevel, type RoleDefinition, type RoleScope } from '@shared/roles'
import { log } from '../log'
import type { ConversationManager } from '../conversations/manager'

export type RoleLaunchHost = Pick<
  ConversationManager,
  'view' | 'setControl' | 'settingsView' | 'post'
>

/** Mode de la session dont la valeur ou le nom est celui du rôle (casse ignorée). */
export function nativeMode(
  controls: readonly SessionControl[],
  wanted: string | undefined
): { controlId: string; value: string } | undefined {
  if (!wanted) return undefined
  const key = wanted.trim().toLowerCase()
  for (const control of controls) {
    if (control.category !== 'mode' || control.type !== 'select') continue
    const option =
      control.options.find((o) => o.value.toLowerCase() === key) ??
      control.options.find((o) => o.name.toLowerCase() === key)
    if (option) return { controlId: control.id, value: option.value }
  }
  return undefined
}

/**
 * Lecture seule d'une fille : imposée (refus de Bobine) quand l'agent demande avant d'écrire ;
 * seulement demandée pour un agent qui écrit sans demander, **même** dans un mode natif : rien ne
 * prouve que ce mode interdise l'écriture (`mode: build` chez OpenCode écrit).
 */
export function readOnlyLevel(
  role: RoleDefinition,
  writesWithoutAsking: boolean,
  /** Mode installé par Bobine en lecture seule (phase 4) : les droits de l'agent la tiennent. */
  heldByAgent = false
): ReadOnlyLevel | undefined {
  if (!role.readOnly) return undefined
  return writesWithoutAsking && !heldByAgent ? 'requested' : 'enforced'
}

/** Mode installé par Bobine pour ce rôle et cet agent (phase 4, « lancer dans ce mode »). */
export interface InstalledMode {
  id: string
  /** Installé en lecture seule : les droits du mode interdisent d'écrire. */
  readOnly: boolean
}

/**
 * Agent de la fille prêt : son mode natif posé si le rôle en nomme un que la session connaît —
 * sinon, sans `mode`, celui que Bobine a installé pour ce rôle dans cet agent (`installed`, phase
 * 4) s'il est dans les modes de la session —, puis le premier message. Ce qui n'a pas pu se faire
 * est dit dans le fil de la fille.
 */
export async function roleFirstMessage(
  host: RoleLaunchHost,
  child: ConversationSummary,
  role: RoleDefinition & { scope?: RoleScope; hides?: RoleScope[] },
  task: string,
  installed?: InstalledMode
): Promise<string> {
  // Rôle du projet qui en remplace un fourni ou personnel du même nom : dit, le dépôt décide.
  if (role.scope === 'project' && role.hides?.length) {
    host.post(child.id, {
      type: 'notice',
      level: 'warning',
      message: { key: 'roles.notice.projectOverrides', params: { name: role.name } }
    })
  }
  const controls = host.view(child.id).snapshot?.controls ?? []
  const fromInstall = !role.mode && installed ? installed : undefined
  const mode = nativeMode(controls, role.mode ?? fromInstall?.id)
  let native = false
  if (mode) {
    const current = controls.find((c) => c.id === mode.controlId)
    native =
      (current?.type === 'select' && current.currentValue === mode.value) ||
      (await host
        .setControl(child.id, mode.controlId, mode.value, { remember: false })
        .then(() => true)
        .catch((error: unknown) => {
          log.warn(`Mode natif du rôle ${role.name} non posé :`, error)
          return false
        }))
  }
  if (role.mode && !native) {
    host.post(child.id, {
      type: 'notice',
      level: 'info',
      message: { key: 'roles.notice.modeMissing', params: { mode: role.mode } }
    })
  }
  const profile = host.settingsView().profiles.find((p) => p.id === child.profileId)
  const readOnly = readOnlyLevel(
    role,
    !!profile?.writesWithoutAsking,
    native && fromInstall?.readOnly === true
  )
  if (native && fromInstall) log.info(`Rôle ${role.name} : mode installé ${fromInstall.id} posé`)
  if (readOnly === 'requested') {
    host.post(child.id, {
      type: 'notice',
      level: 'warning',
      message: {
        key: 'roles.notice.readOnlyRequested',
        params: { agent: profile?.label ?? child.profileLabel }
      }
    })
  }
  return roleOpening(role, task, readOnly ? { readOnly } : {})
}
