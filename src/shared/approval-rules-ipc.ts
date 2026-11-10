/**
 * Canaux IPC des règles d'approbation globales d'un agent (fiche 215), à part du contrat
 * principal (`ipc.ts`, taille bornée) : `IpcInvokeContract` les reprend, `IPC_CHANNELS` aussi.
 */
import type { ApprovalRulesChange, ApprovalRulesRead, ApprovalRulesResult } from './approval-rules'

export interface ApprovalRulesIpcContract {
  /**
   * Règles globales de l'agent de ce profil (Bob : `~/.bob/settings/settings.json`), ou pourquoi
   * elles ne se lisent pas (`unsupported` : le profil n'en déclare pas).
   */
  'approvalRules:get': { args: [profileId: string]; result: ApprovalRulesRead }
  /**
   * Change une règle, sur une action explicite de l'utilisateur (ADR-0044). Rend les règles à jour
   * et ce que l'interface doit dire (préfixe d'un seul mot, groupe `execute` permis la première
   * fois), ou une erreur typée : rien n'est alors écrit.
   */
  'approvalRules:change': {
    args: [profileId: string, change: ApprovalRulesChange]
    result: ApprovalRulesResult
  }
  /** « Ouvrir le fichier » : le fichier des règles de ce profil, dans l'app par défaut. */
  'approvalRules:open': { args: [profileId: string]; result: undefined }
}

export const APPROVAL_RULES_CHANNELS = [
  'approvalRules:get',
  'approvalRules:change',
  'approvalRules:open'
] as const
