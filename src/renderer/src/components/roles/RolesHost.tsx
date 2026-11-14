import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import { basename } from '../common/Menus'
import { closeRoleWizard, invokeRole, useRolesUi } from '../../roles/roles-store'
import { RoleWizard } from './RoleWizard'

/**
 * Assistant de création des rôles (fiche 223, `openRoleWizard`), monté une fois avec les
 * dialogues de l'app, quel que soit l'écran qui le demande. La conversation active donne le
 * projet ; « Créer et essayer » pose le jeton du rôle créé dans sa saisie (`invokeRole`).
 */
export function RolesHost({
  active,
  profiles
}: {
  active: ConversationSummary | null
  profiles: readonly ProfileSummary[]
}) {
  const ui = useRolesUi()
  // Une fille ou un relecteur ne confie pas de travail à un rôle ; une conversation vide non plus
  // (une fille se rattache à une conversation de l'historique).
  const canTry = !!active && !active.draft && !active.startedFrom && !active.reviewOf
  if (!ui.wizard) return null
  return (
    <RoleWizard
      key={ui.wizard.seq}
      prefill={ui.wizard.prefill}
      conversationId={active?.id}
      conversationProfileId={active?.profileId}
      project={active ? basename(active.project ?? active.workspace) : undefined}
      profiles={profiles}
      canTry={canTry}
      onClose={closeRoleWizard}
      onCreated={(name, tryIt) => {
        closeRoleWizard()
        if (tryIt) invokeRole(name)
      }}
    />
  )
}
