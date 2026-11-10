/**
 * Ce que l'hôte d'agent fait de la version annoncée à `initialize` (fiche 198) : refus expliqué
 * (protocole ACP inconnu, plancher documenté du profil), ou avis une fois dans la conversation
 * (version plus récente ou plus ancienne que celles essayées). Générique : tout vient du profil.
 */
import { t } from 'i18next'
import type { AgentEvent } from '@shared/agent'
import { log } from '../log'
import type { AgentProfile } from './profiles'
import {
  formatVersion,
  incompatibleProtocol,
  parseVersion,
  SUPPORTED_PROTOCOLS,
  versionVerdict
} from './agent-version'

/** Démarrage refusé : le message est déjà une explication, sans sortie d'erreur de l'agent. */
export class AgentIncompatible extends Error {}

export interface VersionCheck {
  /** Raison du refus, pour l'utilisateur. */
  refused?: string
  /** Raison technique, pour le journal. */
  logged?: string
  /** Avis à montrer une fois : `key` dit « déjà montré » (retenu dans les réglages). */
  notice?: { key: string; event: Extract<AgentEvent, { type: 'notice' }> }
}

type VersionProfile = Pick<AgentProfile, 'label' | 'testedVersions' | 'minVersion'>

/**
 * Hôte d'agent, juste après `initialize` : lève `AgentIncompatible` (expliqué) quand le protocole
 * ou la version sont refusés ; le Diagnostic le montre de même.
 */
export function refuseIncompatible(profile: VersionProfile, init: Announced, scope: string): void {
  const check = versionCheck(profile, init)
  if (check.logged) log.warn(`Version de l'agent ${scope} : ${check.logged}`)
  if (check.refused) throw new AgentIncompatible(check.refused)
}

/**
 * Avis de version de la conversation (plus récente ou plus ancienne que celles essayées), à
 * montrer une fois : `key` dit « déjà montré ». Le Diagnostic ne s'en sert pas.
 */
export function versionNotice(
  profile: VersionProfile,
  version: string | undefined
): VersionCheck['notice'] {
  return versionCheck(profile, { agentInfo: { version: version ?? null } }).notice
}

/** Ce qui compte de la réponse à `initialize` ; sans `protocolVersion` : non vérifié. */
type Announced = {
  protocolVersion?: unknown
  agentInfo?: { version?: string | null } | null
}

export function versionCheck(
  profile: VersionProfile,
  init: Announced,
  supported: readonly number[] = SUPPORTED_PROTOCOLS
): VersionCheck {
  const agent = profile.label
  const raw = init.agentInfo?.version || undefined
  // Version normalisée et bornée : jamais le texte brut de l'agent à l'écran ni au journal.
  const parsed = parseVersion(raw)
  const named = parsed ? `${agent} ${formatVersion(parsed)}` : agent
  const protocol = incompatibleProtocol(init.protocolVersion, supported)
  if (protocol) {
    // Un protocole plus ancien que ceux de l'app : l'agent est à mettre à jour ; plus récent (ou
    // illisible, donc inconnu) : c'est l'app.
    const known = supported.join(', ')
    return {
      refused: t(protocol.tooOld ? 'agentHost.protocol.tooOld' : 'agentHost.protocol.tooNew', {
        named,
        agent,
        announced: protocol.announced,
        supported: known
      }),
      logged: `protocole ACP ${protocol.announced} annoncé, l'app connaît ${known}`
    }
  }
  const verdict = versionVerdict(profile, raw)
  switch (verdict.kind) {
    case 'below-floor':
      return {
        refused: t('agentHost.version.belowFloor', { named, agent, floor: verdict.floor }),
        logged: `version ${verdict.version} sous le plancher ${verdict.floor} : ${verdict.reason}`
      }
    case 'newer': {
      // Par version majeure.mineure : pas d'avis pour un correctif (2.2.6 quand 2.2.5 est
      // essayée), un seul par nouvelle branche (2.3.0, pas 2.3.1 ensuite).
      const [major = 0, minor = 0] = parseVersion(verdict.version)?.numbers ?? []
      const [newMajor = 0, newMinor = 0] = parseVersion(verdict.newest)?.numbers ?? []
      if (major === newMajor && minor === newMinor) return {}
      return {
        notice: {
          key: `newer:${major}.${minor}`,
          event: {
            type: 'notice',
            level: 'info',
            message: { key: 'agentHost.version.newer', params: { named, newest: verdict.newest } },
            link: 'diagnostics'
          }
        }
      }
    }
    case 'older':
      return {
        notice: {
          key: `older:${verdict.version}`,
          event: {
            type: 'notice',
            level: 'warning',
            message: {
              key: 'agentHost.version.older',
              params: { named, agent, oldest: verdict.oldest }
            }
          }
        }
      }
    default:
      return {}
  }
}
