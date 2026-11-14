/**
 * Réglages persistés de l'app (`userData/settings.json`).
 * Un fichier absent, illisible ou mal formé donne les valeurs par défaut : jamais d'exception. Un
 * fichier illisible ou qui n'est pas un objet est mis de côté et signalé (fiche 196). Les champs
 * qu'elle ne connaît pas (écrits par une version plus récente) sont gardés tels quels.
 */
import { parseTipsState, type TipsState } from '@shared/tips'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ControlValue, NewConversationDefaults } from '@shared/agent'
import type { NetworkSettings } from '@shared/providers'
import { parsePreferences, type Preferences } from '@shared/preferences'
import { parseUserCommands, type UserCommand } from '@shared/user-commands'
import { parseCustomAgents, type CustomAgent } from '@shared/custom-agents'
import { parseOnboardingMark, type OnboardingMark } from '@shared/onboarding'
import { quarantine, readJson, writeFileAtomic } from './storage'
import { parseAnnouncement, type AgentAnnouncement } from './agent/capabilities'
import { parseWindowState, type WindowState } from './window-state'
import { parseNetworkSettings } from './agent-config/network-env'
import { parseModelsSeen, type ModelsSeen } from './agent/models-seen'

export interface Settings {
  profileId?: string
  workspace?: string
  recentWorkspaces: string[]
  /** Derniers réglages de session choisis, par profil puis par contrôle (ex. `codex.mode`). */
  controls?: Record<string, Record<string, ControlValue>>
  /** Notifications macOS et badge du Dock ; activés si absent (fiche 024). */
  notifications?: boolean
  /** Langue de l'interface (fiche 074) ; celle de macOS si absente. */
  language?: Preferences['language']
  /** Niveau du journal (fiche 080) ; Normal si absent. */
  logLevel?: Preferences['logLevel']
  /** Apparence (fiche 027) ; valeurs par défaut si absentes. */
  theme?: Preferences['theme']
  lightTheme?: Preferences['lightTheme']
  darkTheme?: Preferences['darkTheme']
  conversationFont?: Preferences['conversationFont']
  conversationFontSize?: number
  terminalFontFamily?: string
  terminalFontSize?: number
  accent?: Preferences['accent']
  threadWidth?: Preferences['threadWidth']
  density?: Preferences['density']
  keepAwake?: boolean
  codeFont?: Preferences['codeFont']
  codeFontSize?: Preferences['codeFontSize']
  userName?: string
  /** Raccourci global de la fenêtre rapide (fiche 062) ; ⌥⌘B si absent. */
  quickEntryShortcut?: Preferences['quickEntryShortcut']
  /** Son quand un agent attend (fiche 068) ; Glass si absent. */
  attentionSound?: Preferences['attentionSound']
  /** Rebond de l'icône du Dock (fiche 101) ; oui si absent. */
  dockBounce?: boolean
  /** Compteur « À traiter » sur l'icône du Dock (fiche 119) ; oui si absent. */
  dockBadge?: boolean
  /** Cookies du navigateur intégré gardés (fiche 072) ; oui si absent. */
  browserKeepCookies?: boolean
  /** Astuces de Bobine (fiche 191) ; oui si absent. */
  tipsEnabled?: boolean
  /** Astuces masquées, dernière montrée (fiche 191). */
  tipsState?: TipsState
  /** Conversations filles en cours au plus (fiche 097, ADR-0020) ; 5 si absent. */
  maxChildren?: number
  /** Proposer des conversations filles (fiche 118) ; « Quand ça s'y prête » si absent. */
  childProposals?: Preferences['childProposals']
  /** Conversations gardées actives au plus (fiche 102) ; 6 si absent. */
  maxLive?: number
  /** Éditeur de « Ouvrir dans… » (fiche 156) ; absent : le premier installé. */
  editor?: Preferences['editor']
  /** Minutes sans sortie avant de signaler une commande (fiche 157) ; 3 si absent. */
  stalledCommandMinutes?: number
  /** Plafond de coût par conversation (fiche 157) : activé, montant, jetons. */
  costCapEnabled?: boolean
  costCapAmount?: number
  costCapTokens?: number
  /** Mémoire commune aux agents (fiche 182) ; oui si absent. */
  memoryEnabled?: boolean
  /** Réglages d'une nouvelle conversation. */
  newConversation?: NewConversationDefaults
  /** Outils « toujours autorisés », par profil d'agent (fiche 042). */
  rememberedTools?: Record<string, string[]>
  /** Commandes « / » personnelles, tous dossiers (fiche 045). */
  commands?: UserCommand[]
  /** Dernière annonce de chaque agent à son démarrage, par profil (fiche 054). */
  agentsSeen?: Record<string, AgentAnnouncement>
  /** Avis de version déjà montrés, par profil (fiche 198) : `newer:2.3`, `older:2.0.3`. */
  versionNotices?: Record<string, string[]>
  /** Modèles de chaque agent vus à sa dernière session et derniers utilisés (fiche 108). */
  models?: Record<string, ModelsSeen>
  /** Fenêtre principale à sa dernière position (fiche 093). */
  window?: WindowState
  /** Réseau d'entreprise : proxy, certificats, posés dans l'environnement des agents (fiche 104). */
  network?: NetworkSettings
  /** Familles d'outils de Bobine coupées (fiche 109) : plus déclarées aux prochaines sessions. */
  appToolsOff?: string[]
  /** Rôles désactivés, par nom (fiche 223) : plus proposés, quelle que soit leur portée. */
  rolesOff?: string[]
  /** Agents ACP déclarés dans Réglages › Agents (fiche 141). */
  customAgents?: CustomAgent[]
  /** Accueil du premier lancement (fiche 188) : en cours, fini ou passé. */
  onboarding?: OnboardingMark
  /**
   * Champs inconnus de cette version (écrits par une Bobine plus récente, fiche 196) : réécrits
   * tels quels, jamais lus.
   */
  extra?: Record<string, unknown>
}

/** Tous les champs connus (le type oblige à n'en oublier aucun) : le reste est gardé tel quel. */
const KNOWN: Record<keyof Settings, true> = {
  profileId: true,
  workspace: true,
  recentWorkspaces: true,
  controls: true,
  notifications: true,
  language: true,
  logLevel: true,
  theme: true,
  lightTheme: true,
  darkTheme: true,
  conversationFont: true,
  conversationFontSize: true,
  terminalFontFamily: true,
  terminalFontSize: true,
  accent: true,
  threadWidth: true,
  density: true,
  keepAwake: true,
  codeFont: true,
  codeFontSize: true,
  userName: true,
  quickEntryShortcut: true,
  attentionSound: true,
  dockBounce: true,
  dockBadge: true,
  browserKeepCookies: true,
  maxChildren: true,
  childProposals: true,
  maxLive: true,
  editor: true,
  stalledCommandMinutes: true,
  costCapEnabled: true,
  costCapAmount: true,
  costCapTokens: true,
  newConversation: true,
  rememberedTools: true,
  commands: true,
  agentsSeen: true,
  models: true,
  window: true,
  network: true,
  appToolsOff: true,
  rolesOff: true,
  customAgents: true,
  tipsEnabled: true,
  tipsState: true,
  onboarding: true,
  memoryEnabled: true,
  versionNotices: true,
  extra: true
}

/** Champs d'une version plus récente, gardés pour la prochaine écriture. */
function unknownFields(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const extra = Object.fromEntries(Object.entries(obj).filter(([key]) => !(key in KNOWN)))
  return Object.keys(extra).length ? extra : undefined
}

export const MAX_RECENT_WORKSPACES = 5

/**
 * Préférences lues dans `settings.json` avant que l'app ne soit prête (langue, journal), sans
 * mettre de côté un fichier abîmé (le gestionnaire des conversations s'en charge ensuite).
 */
export function peekPreferences(file: string): Partial<Preferences> {
  try {
    return parsePreferences(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return {}
  }
}

export function loadSettings(file: string): Settings {
  return readSettings(file).settings
}

/**
 * Réglages lus, et le fichier abîmé mis de côté s'il y en a un (`damaged` : son nouveau chemin, ou
 * le sien s'il n'a pas pu être déplacé), pour le dire à l'utilisateur.
 */
export function readSettings(file: string): { settings: Settings; damaged?: string } {
  // Fichier illisible : mis de côté (`.corrupt-<date>`), valeurs par défaut.
  const read = readJson(file)
  if (!read.ok) {
    const settings: Settings = { recentWorkspaces: [] }
    return read.reason === 'missing' ? { settings } : { settings, damaged: read.movedTo ?? file }
  }
  const raw = read.value
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    // JSON valide mais pas des réglages : mis de côté aussi, sinon la prochaine écriture l'efface.
    return { settings: { recentWorkspaces: [] }, damaged: quarantine(file) ?? file }
  }
  return { settings: parseSettings(raw as Record<string, unknown>) }
}

function parseSettings(obj: Record<string, unknown>): Settings {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const window = parseWindowState(obj['window'])
  const onboarding = parseOnboardingMark(obj['onboarding'])
  return {
    profileId: str(obj['profileId']),
    workspace: str(obj['workspace']),
    recentWorkspaces: Array.isArray(obj['recentWorkspaces'])
      ? obj['recentWorkspaces']
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .slice(0, MAX_RECENT_WORKSPACES)
      : [],
    controls: parseControls(obj['controls']),
    rememberedTools: parseRememberedTools(obj['rememberedTools']),
    ...nonEmpty('versionNotices', parseRememberedTools(obj['versionNotices']) ?? {}),
    ...nonEmpty('newConversation', parseNewConversation(obj['newConversation'])),
    ...(parseUserCommands(obj['commands']).length
      ? { commands: parseUserCommands(obj['commands']) }
      : {}),
    ...nonEmpty('agentsSeen', parseAgentsSeen(obj['agentsSeen'])),
    ...nonEmpty('models', parseModelsSeen(obj['models'])),
    ...(typeof obj['notifications'] === 'boolean' ? { notifications: obj['notifications'] } : {}),
    ...(window ? { window } : {}),
    ...(onboarding ? { onboarding } : {}),
    ...nonEmpty('network', parseNetworkSettings(obj['network'])),
    ...parseAppToolsOff(obj['appToolsOff']),
    ...parseRolesOff(obj['rolesOff']),
    ...(parseCustomAgents(obj['customAgents']).length
      ? { customAgents: parseCustomAgents(obj['customAgents']) }
      : {}),
    ...(obj['tipsState'] !== undefined ? { tipsState: parseTipsState(obj['tipsState']) } : {}),
    ...parsePreferences(obj),
    ...(unknownFields(obj) ? { extra: unknownFields(obj) } : {})
  }
}

/** Identifiants de familles coupées : des textes, sans doublon ; absent s'il n'y en a aucun. */
function parseAppToolsOff(raw: unknown): Pick<Settings, 'appToolsOff'> {
  if (!Array.isArray(raw)) return {}
  const ids = [...new Set(raw.filter((v): v is string => typeof v === 'string' && v !== ''))]
  return ids.length ? { appToolsOff: ids } : {}
}

/** Noms de rôles désactivés : des textes, sans doublon ; absent s'il n'y en a aucun. */
function parseRolesOff(raw: unknown): Pick<Settings, 'rolesOff'> {
  if (!Array.isArray(raw)) return {}
  const names = [...new Set(raw.filter((v): v is string => typeof v === 'string' && v !== ''))]
  return names.length ? { rolesOff: names } : {}
}

const nonEmpty = <K extends string, V extends object>(key: K, value: V) =>
  (Object.keys(value).length ? { [key]: value } : {}) as Partial<Record<K, V>>

function parseAgentsSeen(raw: unknown): Record<string, AgentAnnouncement> {
  if (typeof raw !== 'object' || raw === null) return {}
  return Object.fromEntries(
    Object.entries(raw)
      .map(([id, value]) => [id, parseAnnouncement(value)] as const)
      .filter((entry): entry is readonly [string, AgentAnnouncement] => entry[1] !== undefined)
  )
}

/** Réglages d'une nouvelle conversation (champs mal formés ignorés). */
export function parseNewConversation(raw: unknown): NewConversationDefaults {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const profileId = text(r['profileId'])
  const workspace = text(r['workspace'])
  const mode = r['mode'] === 'plan' || r['mode'] === 'execute' ? r['mode'] : undefined
  return {
    ...(profileId ? { profileId } : {}),
    ...(workspace ? { workspace } : {}),
    ...(mode ? { mode } : {})
  }
}

/** Listes de textes par profil (outils retenus, avis de version déjà montrés). */
function parseRememberedTools(raw: unknown): Record<string, string[]> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const result: Record<string, string[]> = {}
  for (const [profileId, tools] of Object.entries(raw)) {
    if (!Array.isArray(tools)) continue
    const valid = [...new Set(tools.filter((t): t is string => typeof t === 'string' && t !== ''))]
    if (valid.length) result[profileId] = valid
  }
  return Object.keys(result).length ? result : undefined
}

function parseControls(raw: unknown): Settings['controls'] {
  if (typeof raw !== 'object' || raw === null) return undefined
  const result: Record<string, Record<string, ControlValue>> = {}
  for (const [profileId, values] of Object.entries(raw)) {
    if (typeof values !== 'object' || values === null) continue
    const valid = Object.entries(values).filter(
      (entry): entry is [string, ControlValue] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'boolean'
    )
    if (valid.length) result[profileId] = Object.fromEntries(valid)
  }
  return Object.keys(result).length ? result : undefined
}

/** Écriture atomique (fichier temporaire puis renommage). */
export function saveSettings(file: string, settings: Settings): void {
  mkdirSync(dirname(file), { recursive: true })
  // Champs inconnus d'abord : un champ connu l'emporte toujours.
  const { extra, ...known } = settings
  writeFileAtomic(file, JSON.stringify({ ...extra, ...known }, null, 2) + '\n')
}

/** Place `workspace` en tête des récents, sans doublon, 5 au plus. */
export function addRecentWorkspace(recents: string[], workspace: string): string[] {
  return [workspace, ...recents.filter((w) => w !== workspace)].slice(0, MAX_RECENT_WORKSPACES)
}
