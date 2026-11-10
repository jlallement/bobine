/**
 * SettingsStore : les réglages de l'app en mémoire (fiche 089, ADR-0016). Lus au lancement,
 * enregistrés à chaque changement par l'écrivain injecté (celui de l'historique : un seul
 * écrivain), et les abonnés prévenus des changements qui comptent pour le reste de l'app (thème,
 * langue, raccourci de la fenêtre rapide, cookies, veille, notifications, outils retenus, annonces
 * des agents). Les clés d'API, chiffrées à part (`ApiKeyStore`), passent aussi par ici.
 *
 * N'importe pas `electron` : testable sous Vitest.
 */
import type { OnboardingMark } from '@shared/onboarding'
import { createHmac, randomBytes } from 'node:crypto'
import {
  applyTipAction,
  localDay,
  EMPTY_TIPS,
  normalizeMessage,
  noteSentMessage,
  withoutSent,
  type TipAction,
  type TipId,
  type TipsState
} from '@shared/tips'
import type { ApiKeyInfo, ControlValue, SessionControl } from '@shared/agent'
import type { NetworkSettings } from '@shared/providers'
import { DEFAULT_PREFERENCES, parsePreferences, type Preferences } from '@shared/preferences'
import { parseUserCommands } from '@shared/user-commands'
import {
  agentFromDraft,
  draftFrom,
  draftProblems,
  newCustomAgentId,
  type CustomAgent
} from '@shared/custom-agents'
import { t } from 'i18next'
import { translate } from '@shared/i18n/message'
import type { ApiKeySpec, ApiKeyStore, EnvChanges } from './agent-config/api-keys'
import { networkEnvChanges, parseNetworkSettings } from './agent-config/network-env'
import { sameAnnouncement, type AgentAnnouncement } from './agent/capabilities'
import { noteModels } from './agent/models-seen'
import { isDirectory } from './agent/process-utils'
import { applyCustomProfiles } from './agent/custom-profiles'
import type { AgentProfile } from './agent/profiles'
import { log } from './log'
import { addRecentWorkspace, parseNewConversation, type Settings } from './settings'
import type { WindowState } from './window-state'
import { RefusedModels } from './agent/refused-models'

export interface SettingsStoreOptions {
  /** Réglages lus au lancement (`loadSettings`). */
  initial: Settings
  /** Écrit les réglages sur le disque. */
  save: (settings: Settings) => void
  /**
   * Profils de l'app, liste partagée avec ceux qui la lisent (gestionnaire des conversations…) :
   * les agents déclarés (fiche 141) y sont tenus à jour.
   */
  profiles: AgentProfile[]
  /** Clés d'API des agents, chiffrées (fiche 022). */
  apiKeys?: ApiKeyStore
  /** Environnement de l'app (clés fournies hors de l'app) ; `process.env` par défaut. */
  env?: NodeJS.ProcessEnv
  /**
   * Clés que les fournisseurs de modèles déclarés chez l'agent attendent (fiche 104), posées au
   * lancement avec celles du profil.
   */
  providerKeys?: (profile: AgentProfile) => ApiKeySpec[]
}

export class SettingsStore {
  private readonly options: SettingsStoreOptions
  private settings: Settings
  private readonly listeners = new Set<() => void>()
  /** Modèles refusés faute de connexion (fiche 210) : en mémoire seulement, jamais écrits. */
  readonly refusedModels = new RefusedModels()

  constructor(options: SettingsStoreOptions) {
    this.options = options
    this.settings = options.initial
    applyCustomProfiles(options.profiles, this.settings.customAgents ?? [])
  }

  /** Réglages tels qu'enregistrés (lecture seule : on les change par les méthodes ci-dessous). */
  get current(): Readonly<Settings> {
    return this.settings
  }

  /** Prévient `listener` à chaque changement signalé ; rend de quoi se désabonner. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /* ---------- Préférences ---------- */

  /** Langue, thème, polices…, valeurs par défaut comprises. */
  preferences(): Preferences {
    const s = this.settings
    return {
      language: s.language ?? DEFAULT_PREFERENCES.language,
      logLevel: s.logLevel ?? DEFAULT_PREFERENCES.logLevel,
      theme: s.theme ?? DEFAULT_PREFERENCES.theme,
      lightTheme: s.lightTheme ?? DEFAULT_PREFERENCES.lightTheme,
      darkTheme: s.darkTheme ?? DEFAULT_PREFERENCES.darkTheme,
      conversationFont: s.conversationFont ?? DEFAULT_PREFERENCES.conversationFont,
      conversationFontSize: s.conversationFontSize ?? DEFAULT_PREFERENCES.conversationFontSize,
      terminalFontSize: s.terminalFontSize ?? DEFAULT_PREFERENCES.terminalFontSize,
      ...(s.terminalFontFamily ? { terminalFontFamily: s.terminalFontFamily } : {}),
      accent: s.accent ?? DEFAULT_PREFERENCES.accent,
      threadWidth: s.threadWidth ?? DEFAULT_PREFERENCES.threadWidth,
      density: s.density ?? DEFAULT_PREFERENCES.density,
      keepAwake: s.keepAwake ?? DEFAULT_PREFERENCES.keepAwake,
      codeFont: s.codeFont ?? DEFAULT_PREFERENCES.codeFont,
      codeFontSize: s.codeFontSize ?? DEFAULT_PREFERENCES.codeFontSize,
      userName: s.userName ?? DEFAULT_PREFERENCES.userName,
      quickEntryShortcut: s.quickEntryShortcut ?? DEFAULT_PREFERENCES.quickEntryShortcut,
      attentionSound: s.attentionSound ?? DEFAULT_PREFERENCES.attentionSound,
      dockBounce: s.dockBounce ?? DEFAULT_PREFERENCES.dockBounce,
      dockBadge: s.dockBadge ?? DEFAULT_PREFERENCES.dockBadge,
      browserKeepCookies: s.browserKeepCookies ?? DEFAULT_PREFERENCES.browserKeepCookies,
      tipsEnabled: s.tipsEnabled ?? DEFAULT_PREFERENCES.tipsEnabled,
      maxChildren: s.maxChildren ?? DEFAULT_PREFERENCES.maxChildren,
      childProposals: s.childProposals ?? DEFAULT_PREFERENCES.childProposals,
      maxLive: s.maxLive ?? DEFAULT_PREFERENCES.maxLive,
      ...(s.editor ? { editor: s.editor } : {}),
      stalledCommandMinutes:
        stalledOverride() ?? s.stalledCommandMinutes ?? DEFAULT_PREFERENCES.stalledCommandMinutes,
      costCapEnabled: s.costCapEnabled ?? DEFAULT_PREFERENCES.costCapEnabled,
      costCapAmount: s.costCapAmount ?? DEFAULT_PREFERENCES.costCapAmount,
      costCapTokens: s.costCapTokens ?? DEFAULT_PREFERENCES.costCapTokens,
      memoryEnabled: s.memoryEnabled ?? DEFAULT_PREFERENCES.memoryEnabled
    }
  }

  /** Change des préférences (champs invalides ignorés). */
  setPreferences(change: unknown): void {
    const valid = parsePreferences(change)
    this.settings = { ...this.settings, ...valid }
    // Astuces coupées (fiche 191) : les empreintes des messages s'en vont.
    if (valid.tipsEnabled === false && this.settings.tipsState?.sent) {
      this.settings = { ...this.settings, tipsState: withoutSent(this.settings.tipsState) }
    }
    if (valid.terminalFontFamily === '') delete this.settings.terminalFontFamily
    this.changed()
  }

  /* ---------- Astuces (fiche 191) ---------- */

  tips(): TipsState {
    return this.settings.tipsState ?? EMPTY_TIPS
  }

  /**
   * État des astuces changé : enregistré **sans prévenir** les abonnés. Rien d'autre ne dépend
   * de lui (thème, langue, raccourcis…) : pas de circuit « réglages changés » à chaque message.
   */
  private setTips(next: TipsState): TipsState {
    this.settings = { ...this.settings, tipsState: next }
    this.save()
    return next
  }

  /**
   * État des astuces ; le premier appel retient le jour du premier lancement : celui de l'accueil
   * (fiche 188) quand il a eu lieu, sinon aujourd'hui.
   */
  tipsSince(today: string): TipsState {
    const state = this.tips()
    if (state.firstDay) return state
    const welcome = this.settings.onboarding?.at ? new Date(this.settings.onboarding.at) : undefined
    const firstDay = welcome && !Number.isNaN(welcome.getTime()) ? localDay(welcome) : today
    return this.setTips({ ...state, firstDay })
  }

  /** Astuce montrée, masquée pour toujours ou utilisée ; `today` : jour local. */
  recordTip(id: TipId, action: TipAction, today: string): TipsState {
    let next = applyTipAction(this.tips(), id, action, today)
    // Plus d'astuce « Planifier… » : les empreintes des messages n'ont plus de raison d'être.
    if (id === 'scheduled' && action !== 'shown') next = withoutSent(next)
    return next === this.settings.tipsState ? next : this.setTips(next)
  }

  /**
   * Un message envoyé (fiche 191) : vrai quand c'est le troisième jour différent pour ce message
   * dans ce dossier. Seule une empreinte est gardée, jamais le texte : un HMAC dont la clé, tirée
   * au hasard pour l'installation, est dans le même `settings.json`. Qui lit ce fichier peut donc
   * tester un texte deviné ; le HMAC empêche seulement les tables précalculées et la comparaison
   * d'une installation à l'autre. Rien n'est gardé quand les astuces sont coupées ou celle-ci
   * masquée, et tout est effacé alors.
   */
  noteSentMessage(folder: string, text: string, today: string): boolean {
    const normalized = normalizeMessage(text)
    let state = this.tips()
    if (!normalized || !this.preferences().tipsEnabled || state.hidden.includes('scheduled')) {
      return false
    }
    if (!state.salt) state = { ...state, salt: randomBytes(32).toString('hex') }
    const key = createHmac('sha256', state.salt ?? '')
      .update(`${folder}\0${normalized}`)
      .digest('hex')
      .slice(0, 32)
    const noted = noteSentMessage(state, key, today)
    if (noted.state !== this.settings.tipsState) this.setTips(noted.state)
    return noted.repeated
  }

  /** « Tout réafficher » : plus aucune astuce masquée (le quota du jour reste). */
  resetTips(): TipsState {
    const { hidden: _hidden, ...rest } = this.tips()
    return this.setTips({ ...rest, hidden: [] })
  }

  notificationsEnabled(): boolean {
    return this.settings.notifications !== false
  }

  setNotifications(enabled: boolean): void {
    this.settings = { ...this.settings, notifications: enabled }
    this.changed()
  }

  /** Commandes « / » personnelles (fiche 045) : la liste entière, vérifiée, enregistrée. */
  setCommands(raw: unknown): void {
    const commands = parseUserCommands(raw)
    this.settings = { ...this.settings, commands }
    if (commands.length === 0) delete this.settings.commands
    this.changed()
  }

  /* ---------- Nouvelle conversation, dossiers, réglages de session ---------- */

  /** Réglages d'une nouvelle conversation (fiche 027). */
  setNewConversation(raw: unknown): void {
    const defaults = parseNewConversation(raw)
    if (defaults.workspace && !isDirectory(defaults.workspace)) {
      throw new Error(t('conversations.error.folderMissing', { folder: defaults.workspace }))
    }
    this.settings = { ...this.settings, newConversation: defaults }
    this.save()
  }

  /** Dernier agent et dossier choisis ; le dossier passe en tête des récents. */
  rememberWorkspace(profileId: string, workspace: string): void {
    this.settings = {
      ...this.settings,
      profileId,
      workspace,
      recentWorkspaces: addRecentWorkspace(this.settings.recentWorkspaces, workspace)
    }
    this.save()
  }

  /** Retire un dossier de la liste des récents. */
  forgetWorkspace(workspace: string): void {
    this.settings = {
      ...this.settings,
      recentWorkspaces: this.settings.recentWorkspaces.filter((w) => w !== workspace)
    }
    this.save()
  }

  /** Réglage de session choisi, réappliqué aux prochaines sessions de ce profil. */
  rememberControl(profileId: string, controlId: string, value: ControlValue): void {
    this.settings = {
      ...this.settings,
      controls: {
        ...this.settings.controls,
        [profileId]: { ...this.settings.controls?.[profileId], [controlId]: value }
      }
    }
    this.save()
  }

  /* ---------- Outils toujours autorisés (fiche 042) ---------- */

  hasRememberedTool(profileId: string, tool: string): boolean {
    return this.settings.rememberedTools?.[profileId]?.includes(tool) === true
  }

  /** « Toujours autoriser » retenu pour les prochaines conversations de cet agent. */
  rememberTool(profileId: string, tool: string): void {
    const tools = this.settings.rememberedTools?.[profileId] ?? []
    if (tools.includes(tool)) return
    this.settings = {
      ...this.settings,
      rememberedTools: { ...this.settings.rememberedTools, [profileId]: [...tools, tool] }
    }
    this.save()
    log.info(`Outil toujours autorisé pour ${profileId} : ${tool}`)
    this.notify()
  }

  /** Un outil n'est plus autorisé d'office pour cet agent. */
  forgetTool(profileId: string, tool: string): void {
    const tools = (this.settings.rememberedTools?.[profileId] ?? []).filter((t) => t !== tool)
    const rememberedTools = Object.fromEntries(
      Object.entries({ ...this.settings.rememberedTools, [profileId]: tools }).filter(
        ([, list]) => list.length > 0
      )
    )
    this.settings = { ...this.settings, rememberedTools }
    this.changed()
  }

  /* ---------- Accueil du premier lancement (fiche 188) ---------- */

  onboarding(): OnboardingMark | undefined {
    return this.settings.onboarding
  }

  setOnboarding(mark: OnboardingMark): void {
    this.settings = { ...this.settings, onboarding: mark }
    this.save()
  }

  /* ---------- Outils de Bobine (fiche 109) ---------- */

  /** Familles d'outils coupées par l'utilisateur. */
  appToolsOff(): ReadonlySet<string> {
    return new Set(this.settings.appToolsOff ?? [])
  }

  /** Coupe ou rallume une famille : vaut pour les sessions ouvertes ensuite. */
  setAppToolFamily(id: string, enabled: boolean): void {
    const off = this.appToolsOff()
    if (off.has(id) !== enabled) return
    const next = enabled ? [...off].filter((f) => f !== id) : [...off, id]
    const { appToolsOff: _previous, ...rest } = this.settings
    this.settings = next.length ? { ...rest, appToolsOff: next } : rest
    this.save()
    log.info(`Outils de Bobine : famille ${id} ${enabled ? 'activée' : 'coupée'}`)
  }

  /* ---------- Agents ---------- */

  /** Annonce d'un agent à son démarrage (fiche 054) : retenue si elle a changé. */
  agentSeen(profileId: string, announcement: AgentAnnouncement): void {
    if (sameAnnouncement(this.settings.agentsSeen?.[profileId], announcement)) return
    this.settings = {
      ...this.settings,
      agentsSeen: { ...this.settings.agentsSeen, [profileId]: announcement }
    }
    this.changed()
  }

  /**
   * Avis de version (fiche 198) : `true` la première fois pour ce profil et cette clé, qui est
   * alors retenue ; ensuite `false`, dans toutes les conversations et après un redémarrage.
   */
  claimVersionNotice(profileId: string, key: string): boolean {
    const shown = this.settings.versionNotices?.[profileId] ?? []
    if (shown.includes(key)) return false
    this.settings = {
      ...this.settings,
      // Les plus récentes seulement : la liste ne grandit pas sans fin.
      versionNotices: { ...this.settings.versionNotices, [profileId]: [...shown, key].slice(-20) }
    }
    this.save()
    return true
  }

  /**
   * Modèles de l'agent d'après un instantané de sa session (fiche 108) : retenus s'ils ont changé,
   * sans prévenir les abonnés (seul « Continuer avec … » les lit, à la demande).
   */
  noteModels(profileId: string, controls: readonly SessionControl[]): void {
    const next = noteModels(this.settings.models?.[profileId], controls)
    if (!next) return
    this.settings = { ...this.settings, models: { ...this.settings.models, [profileId]: next } }
    this.save()
  }

  /* ---------- Fenêtre (fiche 093) ---------- */

  /** Fenêtre principale à sa dernière position enregistrée. */
  windowState(): WindowState | undefined {
    return this.settings.window
  }

  /** Enregistrée sans prévenir les abonnés : rien d'autre ne dépend de la fenêtre. */
  setWindowState(state: WindowState): void {
    this.settings = { ...this.settings, window: state }
    this.save()
  }

  /* ---------- Clés d'API (fiche 022) ---------- */

  /**
   * État des clés d'un agent pour l'interface : jamais les valeurs, et sans ouvrir le trousseau
   * (fiche 100).
   */
  keyInfo(profile: AgentProfile): ApiKeyInfo[] {
    const store = this.options.apiKeys
    const env = this.options.env ?? process.env
    const specs = profile.apiKeys ?? []
    return store
      ? store.info(profile.id, specs, env)
      : specs.map((spec) => ({
          env: spec.env,
          label: spec.label,
          stored: false,
          fromEnvironment: !!env[spec.env]
        }))
  }

  /**
   * À poser dans l'environnement de l'agent à son lancement : ses clés enregistrées (celles du
   * profil, celles des fournisseurs de modèles), et le réseau d'entreprise saisi (fiche 104).
   */
  async credentials(profile: AgentProfile): Promise<EnvChanges> {
    const specs = [...(profile.apiKeys ?? []), ...(this.options.providerKeys?.(profile) ?? [])]
    return {
      ...(await this.options.apiKeys?.credentials(profile.id, specs)),
      ...networkEnvChanges(this.network(), this.options.env ?? process.env)
    }
  }

  /* ---------- Réseau d'entreprise (fiche 104) ---------- */

  network(): NetworkSettings {
    return this.settings.network ?? {}
  }

  /** Proxy, certificats : enregistrés, pris en compte au prochain lancement d'un agent. */
  setNetwork(change: unknown): NetworkSettings {
    const network = parseNetworkSettings(change)
    this.settings = { ...this.settings, network }
    this.save()
    return network
  }

  /** Enregistre la clé d'API d'un agent : prise en compte à son prochain lancement. */
  setApiKey(profileId: string, env: string, value: string): Promise<void> {
    return this.keyStore(profileId, env).set(profileId, env, value)
  }

  removeApiKey(profileId: string, env: string): void {
    this.keyStore(profileId, env).remove(profileId, env)
  }

  private keyStore(profileId: string, env: string): ApiKeyStore {
    const profile = this.options.profiles.find((p) => p.id === profileId)
    if (!profile?.apiKeys?.some((spec) => spec.env === env)) {
      throw new Error(t('conversations.error.unknownKey', { env }))
    }
    if (!this.options.apiKeys) throw new Error(t('conversations.error.noApiKeys'))
    return this.options.apiKeys
  }

  /* ---------- Agents déclarés (fiche 141) ---------- */

  /**
   * Ajoute un agent déclaré (`id` absent) ou le modifie, d'après le formulaire ; rend son
   * identifiant. Pris en compte au prochain démarrage de l'agent. Une clé d'API dont la variable
   * change est oubliée (rien ne reste au trousseau pour une variable que l'agent ne lit plus).
   */
  saveCustomAgent(rawDraft: unknown, id?: string): string {
    const draft = draftFrom(rawDraft)
    const problem = draftProblems(draft)[0]
    if (problem) throw new Error(translate(problem))
    const agents = this.settings.customAgents ?? []
    const previous = id === undefined ? undefined : agents.find((a) => a.id === id)
    if (id !== undefined && !previous) throw new Error(t('customAgents.error.unknown'))
    const agent = agentFromDraft(
      draft,
      previous?.id ??
        newCustomAgentId(
          draft.label,
          this.options.profiles.map((p) => p.id)
        )
    )
    if (previous?.apiKeyEnv && previous.apiKeyEnv !== agent.apiKeyEnv) this.forgetKey(previous)
    this.setCustomAgents(
      previous ? agents.map((a) => (a.id === agent.id ? agent : a)) : [...agents, agent]
    )
    return agent.id
  }

  /** Retire un agent déclaré, et sa clé d'API ; ses conversations restent, en lecture seule. */
  removeCustomAgent(id: string): void {
    const agents = this.settings.customAgents ?? []
    const agent = agents.find((a) => a.id === id)
    if (!agent) throw new Error(t('customAgents.error.unknown'))
    this.forgetKey(agent)
    this.setCustomAgents(agents.filter((a) => a.id !== id))
  }

  private setCustomAgents(agents: CustomAgent[]): void {
    this.settings = { ...this.settings, customAgents: agents }
    if (agents.length === 0) delete this.settings.customAgents
    applyCustomProfiles(this.options.profiles, agents)
    this.changed()
  }

  private forgetKey(agent: CustomAgent): void {
    if (agent.apiKeyEnv && this.options.apiKeys?.has(agent.id, agent.apiKeyEnv)) {
      this.options.apiKeys.remove(agent.id, agent.apiKeyEnv)
    }
  }

  /* ---------- Interne ---------- */

  private save(): void {
    this.options.save(this.settings)
  }

  /** Enregistre, puis prévient les abonnés. */
  private changed(): void {
    this.save()
    this.notify()
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Seuil de commande bloquée imposé par `BOBINE_STALLED_COMMAND_MS` (essais, fiche 157), en minutes :
 * quelques secondes plutôt que des minutes. Jamais enregistré.
 */
function stalledOverride(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const ms = Number(env['BOBINE_STALLED_COMMAND_MS'])
  return Number.isFinite(ms) && ms > 0 ? ms / 60_000 : undefined
}
