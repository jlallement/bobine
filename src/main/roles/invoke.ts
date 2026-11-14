/**
 * `@rôle …` envoyé depuis la saisie (fiche 223, phase 3B) : une conversation fille par rôle cité,
 * avec le même texte, lancées l'une après l'autre (chacune son worktree, ou le même dossier en
 * lecture seule) et qui travaillent ensuite en parallèle.
 *
 * Pas de carte d'accord : c'est l'utilisateur qui le demande, en toutes lettres. L'agent et le
 * modèle du rôle sont repris quand le profil le permet, comme pour `start_child` (`roleDefaults`) ;
 * sinon la fille prend l'agent de la mère. Un rôle qui ne part pas (inconnu, désactivé, plafond
 * des filles atteint) n'empêche pas les autres : il est rendu avec sa raison.
 */
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import type { Message } from '@shared/i18n/message'
import {
  MAX_ROLES_PER_MESSAGE,
  type RolesStartRequest,
  type RolesStartResult
} from '@shared/roles-ipc'
import type { ChildConversations } from '../conversations/children'
import { resolveChoice } from '../mcp/children-tools'
import { roleDefaults } from './choice'

export type RoleInvokeHost = Pick<ChildConversations, 'start' | 'choices' | 'findRole'>

/* Les arguments viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */
export function parseRolesStartRequest(value: unknown): RolesStartRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { roles, text } = value as Record<string, unknown>
  if (typeof text !== 'string' || !text.trim()) throw new Error(t('children.error.emptyPrompt'))
  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.length > MAX_ROLES_PER_MESSAGE ||
    !roles.every((r) => typeof r === 'string' && r.trim())
  ) {
    throw new Error('Paramètre invalide : roles')
  }
  const names = [...new Set((roles as string[]).map((r) => r.trim().replace(/^@/, '')))]
  return { roles: names, text: text.trim() }
}

/** Lance les filles, une par rôle ; rend celles parties et les refus. */
export async function startRoleChildren(
  host: RoleInvokeHost,
  motherId: string,
  request: RolesStartRequest
): Promise<RolesStartResult> {
  const result: RolesStartResult = { started: [], failed: [] }
  // L'une après l'autre : deux `git worktree add` à la fois dans le même dépôt peuvent se gêner,
  // et le plafond des filles se compte juste. Chaque lancement rend la main dès la fille créée.
  for (const name of request.roles) {
    try {
      const role = host.findRole(motherId, name)
      const choices = host.choices(motherId)
      const defaults = roleDefaults(choices, role)
      const choice = resolveChoice(choices, defaults.agent, defaults.model)
      // Agent ou modèle du rôle laissés de côté : une ligne dans le fil de la fille.
      const notices: Message[] = [
        ...(defaults.missing.agent
          ? [
              {
                key: 'roles.notice.agentMissing' as const,
                params: { agent: defaults.missing.agent }
              }
            ]
          : []),
        ...(defaults.missing.model
          ? [
              {
                key: 'roles.notice.modelMissing' as const,
                params: { model: defaults.missing.model }
              }
            ]
          : [])
      ]
      const child = await host.start(motherId, {
        text: request.text,
        role: role.name,
        ...(notices.length ? { notices } : {}),
        // Agent ou modèle du rôle introuvables ici : la fille prend ceux de la mère.
        ...(typeof choice === 'string' ? {} : choice)
      })
      result.started.push({ role: role.name, childId: child.id })
    } catch (error) {
      result.failed.push({ role: name, error: messageOf(error) })
    }
  }
  return result
}
