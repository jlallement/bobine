import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { basename } from '../common/Menus'
import {
  closeRoleChild,
  closeRoleWizard,
  openRoleChild,
  useRolesListing,
  useRolesUi
} from '../../roles/roles-store'
import { RoleChildDialog } from './RoleChildDialog'
import { RoleWizard } from './RoleWizard'

/**
 * Dialogues des rôles (fiche 223, phase 3A), montés une fois avec ceux de l'app : l'assistant de
 * création (`openRoleWizard`) et « Confier à <rôle> » (`openRoleChild`), quel que soit l'écran
 * qui les demande. La conversation active donne le projet et la mère de la fille.
 */
export function RolesHost({
  active,
  profiles
}: {
  active: ConversationSummary | null
  profiles: readonly ProfileSummary[]
}) {
  const ui = useRolesUi()
  const { listing } = useRolesListing(ui.child ? active?.id : null)
  const childRole = ui.child ? listing?.roles.find((r) => r.name === ui.child?.role) : undefined
  return (
    <>
      {ui.wizard && (
        <RoleWizard
          key={ui.wizard.seq}
          prefill={ui.wizard.prefill}
          conversationId={active?.id}
          conversationProfileId={active?.profileId}
          project={active ? basename(active.project ?? active.workspace) : undefined}
          profiles={profiles}
          canTry={!!active && !active.draft}
          onClose={closeRoleWizard}
          onCreated={(name, tryIt) => {
            closeRoleWizard()
            if (tryIt) openRoleChild(name)
          }}
        />
      )}
      {ui.child && childRole && (
        <RoleChildDialog
          key={ui.child.seq}
          role={childRole}
          mother={active}
          onClose={closeRoleChild}
        />
      )}
    </>
  )
}
