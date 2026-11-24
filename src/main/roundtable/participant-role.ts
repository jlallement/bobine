/**
 * Rôle d'un participant de tour de table (fiche 285, décision C3), figé par le code : le rôle
 * fourni « Participant » (libellé et description dans la langue de l'interface), avec sa consigne
 * anglaise `PARTICIPANT_BRIEF`, en lecture seule et sans famille d'outils de Bobine, quoi qu'un rôle
 * personnel ou du projet du même nom dise. C'est aussi ce que « Installer dans… » écrit : un mode
 * natif installé ainsi correspond (pas d'avis « installation périmée »).
 */
import { ROUNDTABLE_PARTICIPANT_ROLE } from '@shared/roundtable'
import { PARTICIPANT_BRIEF } from '@shared/roundtable-prompts'
import { roleSnapshot, type RoleSnapshot } from '@shared/roles'
import { builtinRoles } from '../roles/builtin'

export function participantRole(): RoleSnapshot {
  const builtin = builtinRoles().find((r) => r.name === ROUNDTABLE_PARTICIPANT_ROLE)
  if (!builtin) throw new Error('Rôle fourni « participant » absent')
  return roleSnapshot({
    ...builtin,
    prompt: PARTICIPANT_BRIEF,
    readOnly: true,
    mcp: [],
    scope: 'builtin'
  })
}
