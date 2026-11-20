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
import { randomUUID } from 'node:crypto'
import { messageOf } from '@shared/errors'
import { MAX_PASTED_TEXT_CHARS } from '@shared/attachments'
import { parseUncommittedChoice } from '@shared/launch-folder'
import type { Message } from '@shared/i18n/message'
import {
  MAX_ROLES_PER_MESSAGE,
  type RolesReplyRequest,
  type RolesStartRequest,
  type RolesStartResult
} from '@shared/roles-ipc'
import type { ChildConversations } from '../conversations/children'
import { REVIEWER_ROLE, type ChildReviews } from '../conversations/children-review'
import { resolveChoice } from '../mcp/children-tools'
import { roleDefaults } from './choice'
import type { RoleRequest } from '@shared/role-request'

export type RoleInvokeHost = Pick<
  ChildConversations,
  'start' | 'choices' | 'findRole' | 'reply'
> & {
  /** Relectures (fiche 265) : `@code-reviewer` passe par « Faire relire ». */
  reviews?: Pick<ChildReviews, 'start'>
}

/* « Répondre à <rôle> » (fiche 263) : arguments du renderer, vérifiés. */
export function parseRolesReplyRequest(value: unknown): RolesReplyRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { childId, text } = value as Record<string, unknown>
  if (typeof childId !== 'string' || !childId) throw new Error('Paramètre invalide : childId')
  if (typeof text !== 'string' || !text.trim()) throw new Error(t('children.error.emptyPrompt'))
  // Même borne qu'un texte collé dans la saisie (`MAX_PASTED_TEXT_CHARS`).
  if (text.length > MAX_PASTED_TEXT_CHARS) throw new Error(t('workCard.error.tooLong'))
  return { childId, text: text.trim() }
}

/* Les arguments viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */
export function parseRolesStartRequest(value: unknown): RolesStartRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { roles, text, uncommitted } = value as Record<string, unknown>
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
  const choice = parseUncommittedChoice(uncommitted)
  return { roles: names, text: text.trim(), ...(choice ? { uncommitted: choice } : {}) }
}

/** Lance les filles, une par rôle ; rend celles parties et les refus. */
export async function startRoleChildren(
  host: Omit<RoleInvokeHost, 'reply'>,
  motherId: string,
  request: RolesStartRequest,
  /**
   * Appelé une fois, juste avant la première fille : une conversation encore vide entre dans
   * l'historique (titrée d'après la demande, sans message à son agent) pour que ses filles s'y
   * rattachent. Rien si aucun rôle ne part.
   */
  beforeFirst?: () => void
): Promise<RolesStartResult> {
  const result: RolesStartResult = { started: [], failed: [] }
  // Une bulle « @Rôle … » pour tout le message (fiche 263) : posée au premier travail parti,
  // complétée des suivants (`start` y ajoute chaque travail parti) ; un rôle refusé n'y paraît pas.
  const ask: RoleRequest = {
    requestId: randomUUID(),
    text: request.text,
    works: [],
    at: Date.now()
  }
  let ready = false
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
      if (!ready) {
        beforeFirst?.()
        ready = true
      }
      // Code reviewer (fiche 265) : un seul chemin de relecture, `report_findings` et notes de
      // diff ; portée choisie d'office, le texte tapé devient les points à surveiller.
      if (role.name === REVIEWER_ROLE && host.reviews) {
        const reviewer = await host.reviews.start(motherId, {
          focus: request.text,
          ask,
          ...(typeof choice === 'string' ? {} : choice)
        })
        result.started.push({ role: role.name, childId: reviewer.id })
        continue
      }
      const child = await host.start(motherId, {
        text: request.text,
        role: role.name,
        ask,
        ...(notices.length ? { notices } : {}),
        ...(request.uncommitted ? { uncommitted: request.uncommitted } : {}),
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
