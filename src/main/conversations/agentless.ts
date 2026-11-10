/**
 * Conversations sans agent, et ce que l'interface montre à sa place.
 *
 * - Agent retiré (profil plus proposé, ex. Codex) : conversation en lecture seule.
 * - Pas de dossier (fiche 093) : tant que l'utilisateur n'en a pas choisi (premier lancement,
 *   dossier mémorisé disparu), aucun agent ne démarre. Le brouillon garde un dossier vide et montre
 *   le blocage « dossier à choisir ». Une conversation sans dossier ne reçoit aucun message : elle
 *   n'entre jamais dans l'historique.
 */
import type { AgentSnapshot } from '@shared/agent'
import { t } from 'i18next'
import type { AgentProfile } from '../agent/profiles'

const NOTHING = {
  controls: [],
  commands: [],
  promptCapabilities: { image: false, embeddedContext: false },
  queued: []
} satisfies Partial<AgentSnapshot>

/** Conversation consultable, que son agent retiré ne peut plus reprendre. */
export function retiredSnapshot(profileId: string, workspace: string): AgentSnapshot {
  return {
    status: 'read-only',
    detail: t('conversations.retired.detail', { agent: profileId }),
    info: { profileId, profileLabel: profileId, workspace },
    ...NOTHING
  }
}

/** Dossier d'une conversation tant qu'aucun n'est choisi. */
export const NO_FOLDER = ''

export function hasFolder(workspace: string): boolean {
  return workspace !== NO_FOLDER
}

/** Ce que l'interface montre à la place d'un agent : la carte « Choisissez le dossier… ». */
export function folderNeededSnapshot(profile: AgentProfile): AgentSnapshot {
  return {
    status: 'needs-action',
    info: {
      profileId: profile.id,
      profileLabel: profile.label,
      workspace: NO_FOLDER,
      ...(profile.welcomeHint ? { welcomeHint: profile.welcomeHint } : {})
    },
    ...NOTHING,
    blocker: { kind: 'workspace' }
  }
}

/**
 * Dossier d'une conversation tant qu'aucun n'est choisi : `BOBINE_DEFAULT_WORKSPACE` s'il est donné
 * (vide : aucun) ; sinon, pour les essais (dossier de données imposé), le dossier neutre, comme
 * avant la fiche 093, pour que l'agent factice démarre sans dialogue ; sinon aucun : l'app attend
 * le choix de l'utilisateur.
 */
export function defaultWorkspaceFor(
  env: NodeJS.ProcessEnv,
  testRun: boolean,
  neutralFolder: string
): string | undefined {
  const imposed = env['BOBINE_DEFAULT_WORKSPACE']
  if (imposed !== undefined) return imposed || undefined
  return testRun ? neutralFolder : undefined
}
