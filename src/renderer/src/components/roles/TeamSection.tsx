import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import { useProfileStatus } from '../common/Profile'
import { SidebarSection } from '../sidebar/SidebarSection'
import { invokeRole, openRoleWizard, useRolesListing } from '../../roles/roles-store'
import { RoleAvatar } from './RoleAvatar'

/**
 * Section « Équipe » de la barre latérale (fiche 223, décision 1, maquette 01-0) : les rôles
 * actifs pour le projet de la conversation affichée, en avatars. Un clic pose le jeton `@rôle`
 * dans la saisie de cette conversation (le même chemin que le menu `@`) ; « + » ouvre l'assistant
 * de création. Repliable comme les autres sections.
 */
export function TeamSection({
  conversationId,
  folded,
  onToggle,
  onShowConversation
}: {
  conversationId: string | null
  folded: boolean
  onToggle: () => void
  /**
   * Aucune saisie à l'écran (page « Mon activité »…) : ramène la conversation affichée, dont la
   * saisie reçoit alors le jeton (`invokeRole` le garde un instant).
   */
  onShowConversation: () => void
}) {
  const { t } = useTranslation()
  const { readOnly } = useProfileStatus()
  const { listing } = useRolesListing(conversationId)
  if (!listing) return null
  const roles = listing.roles.filter((role) => role.enabled)
  const add = (
    <Tip label={t('team.new')}>
      <button
        className="icon-button small team-add"
        aria-label={t('team.new')}
        onClick={() => openRoleWizard()}
        disabled={readOnly}
        data-testid="team-new"
      >
        <Plus size={14} />
      </button>
    </Tip>
  )
  return (
    <SidebarSection
      id="team"
      label={t('team.title')}
      folded={folded}
      onToggle={onToggle}
      tools={add}
      testId="team-section"
    >
      <div className="team-avatars" role="list" aria-label={t('team.title')}>
        {roles.length === 0 && <span className="team-empty">{t('team.empty')}</span>}
        {roles.map((role) => (
          <span role="listitem" key={role.name}>
            <Tip
              label={`${role.label}\n${role.description}`}
              side="right"
              className="history-tooltip"
            >
              <button
                className="team-avatar"
                aria-label={t('team.assign', { label: role.label })}
                onClick={() => invokeRole(role.name) || onShowConversation()}
                data-testid="team-role"
                data-role={role.name}
              >
                <RoleAvatar role={role} size={32} />
              </button>
            </Tip>
          </span>
        ))}
      </div>
    </SidebarSection>
  )
}
