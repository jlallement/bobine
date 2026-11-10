/**
 * Règles d'approbation globales des agents (fiche 215) : un lecteur par profil qui en déclare le
 * format (`approvalRules`, ADR-0011), et les canaux IPC de l'interface (carte de commande,
 * Réglages › Agents › <agent> › Approbations). Les arguments viennent du renderer : vérifiés ici.
 */
import type { IpcHandlers } from '@shared/ipc'
import {
  deniedPart,
  parseApprovalRulesChange,
  type ApprovalRulesChange,
  type ApprovalRulesRead,
  type ApprovalRulesResult
} from '@shared/approval-rules'
import type { AgentProfile } from '../agent/profiles'
import type { ApprovalRulesHooks, ApprovalRulesStore } from './approval-rules'
import type { McpLocations } from './mcp-files'

/** Chemin affiché : `~` pour le dossier personnel. */
function display(file: string, home: string): string {
  const root = home.replace(/\/+$/, '')
  return file.startsWith(`${root}/`) ? `~${file.slice(root.length)}` : file
}

export class ApprovalRulesSettings {
  private readonly rules = new Map<string, ApprovalRulesStore>()
  private readonly files = new Map<string, string>()

  constructor(
    profiles: readonly Pick<AgentProfile, 'id' | 'approvalRules'>[],
    locations: Pick<McpLocations, 'home'>,
    hooks: ApprovalRulesHooks = {}
  ) {
    for (const profile of profiles) {
      if (!profile.approvalRules) continue
      const file = profile.approvalRules.file(locations)
      this.files.set(profile.id, file)
      this.rules.set(
        profile.id,
        profile.approvalRules.open(file, profile.id, display(file, locations.home), hooks)
      )
    }
  }

  get(profileId: string): ApprovalRulesRead {
    const rules = this.rules.get(profileId)
    return rules ? rules.read() : { ok: false, error: { code: 'unsupported' } }
  }

  /** Fichier des règles de ce profil (« Ouvrir le fichier ») ; jamais un chemin du renderer. */
  file(profileId: string): string | undefined {
    return this.files.get(profileId)
  }

  change(profileId: string, change: ApprovalRulesChange): ApprovalRulesResult {
    const rules = this.rules.get(profileId)
    return rules ? rules.change(change) : { ok: false, error: { code: 'unsupported' } }
  }
}

/**
 * Partie d'une commande refusée partout par les règles de l'agent de ce profil (fiche 215), relues
 * à chaque appel : les outils de l'app ne la lancent pas. `undefined` pour un profil sans règles ;
 * fichier illisible : rien de refusé ici (l'agent ne le lit pas non plus).
 */
export function deniedCommandOf(
  profile: Pick<AgentProfile, 'id' | 'approvalRules'>,
  home: string
): ((command: string, workspace: string) => string | undefined) | undefined {
  const source = profile.approvalRules
  if (!source) return undefined
  const file = source.file({ home })
  const store = source.open(file, profile.id, display(file, home))
  return (command, workspace) => {
    const read = store.read()
    return read.ok ? deniedPart(command, read.rules.commands, workspace) : undefined
  }
}

type ApprovalRulesChannel = 'approvalRules:get' | 'approvalRules:change' | 'approvalRules:open'

export function approvalRulesHandlers(
  settings: Pick<ApprovalRulesSettings, 'get' | 'change' | 'file'> | undefined,
  /** Ouvre un fichier dans l'app par défaut ; rend un message d'erreur, vide si ouvert. */
  openPath?: (path: string) => Promise<string>
): Pick<IpcHandlers, ApprovalRulesChannel> {
  const profile = (value: unknown): string => {
    if (typeof value !== 'string' || !value) throw new Error('Paramètre invalide : profileId')
    return value
  }
  const unsupported = { ok: false as const, error: { code: 'unsupported' as const } }
  return {
    'approvalRules:get': (profileId) => settings?.get(profile(profileId)) ?? unsupported,
    'approvalRules:change': (profileId, change) => {
      const id = profile(profileId)
      const parsed = parseApprovalRulesChange(change)
      if (!parsed) throw new Error('Paramètre invalide : change')
      return settings?.change(id, parsed) ?? unsupported
    },
    'approvalRules:open': async (profileId) => {
      const file = settings?.file(profile(profileId))
      if (!file || !openPath) throw new Error('Paramètre invalide : profileId')
      const error = await openPath(file)
      if (error) throw new Error(error)
      return undefined
    }
  }
}
