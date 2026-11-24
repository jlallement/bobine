/**
 * Rôles qu'on invoque (barre Équipe, mentions `@`) : activés, sauf le rôle fourni « Participant »
 * du tour de table (fiche 285), qui ne sert qu'aux participants et reste dans Réglages › Rôles
 * pour « Installer dans… ». Le marqueur explicite du moteur, quand il viendra, remplacera le nom.
 */
import { ROUNDTABLE_PARTICIPANT_ROLE } from '@shared/roundtable'

export const invocableRole = (role: { enabled: boolean; name: string; scope: string }): boolean =>
  role.enabled && !(role.scope === 'builtin' && role.name === ROUNDTABLE_PARTICIPANT_ROLE)
