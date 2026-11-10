/**
 * Point d'extension des règles d'approbation globales d'un agent (fiche 215, ADR-0011) : le
 * profil déclare son format (`approvalRules`), implémenté dans le module de l'agent
 * (`bob-approval-rules.ts`). Le reste de l'app ne connaît que ces interfaces.
 */
import type {
  ApprovalRulesChange,
  ApprovalRulesRead,
  ApprovalRulesResult
} from '@shared/approval-rules'
import type { McpLocations } from './mcp-files'

/** Accès au fichier, remplaçable dans les essais (écriture concurrente simulée). */
export interface ApprovalRulesHooks {
  /** Appelé après le calcul d'un changement, juste avant la relecture qui précède l'écriture. */
  beforeWrite?: () => void
}

/** Les règles d'un fichier : lecture, et changement sûr sur une action explicite. */
export interface ApprovalRulesStore {
  read(): ApprovalRulesRead
  change(change: ApprovalRulesChange): ApprovalRulesResult
}

/** Format de règles d'approbation déclaré par un profil. */
export interface ApprovalRulesSource {
  /** Repère du format, pour la ligne de Réglages › Agents (un par format, comme les coûts). */
  id: 'bob-settings'
  /** Fichier des règles, dans le dossier personnel donné (jamais le vrai dans les essais). */
  file: (loc: Pick<McpLocations, 'home'>) => string
  /** Lecteur de ce fichier ; `displayFile` : son chemin affiché (`~`). */
  open: (
    file: string,
    profileId: string,
    displayFile: string,
    hooks?: ApprovalRulesHooks
  ) => ApprovalRulesStore
}
