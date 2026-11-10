/**
 * Fournisseurs de modèles dans les réglages (fiche 104) : un `AgentProvidersConfig` par profil qui
 * en déclare le format, les clés dans le trousseau (`ApiKeyStore`, sous `<agent>:<VAR>` comme les
 * clés des agents), « Tester » dans les conditions réseau des agents, et le groupe du Diagnostic.
 */
import type { DiagnosticCheck, DiagnosticGroup } from '@shared/diagnostics'
import {
  keyVariableFor,
  parseModelProvider,
  type NetworkSettings,
  type ProviderEntry,
  type ProvidersView,
  type ProviderTestResult
} from '@shared/providers'
import { t } from 'i18next'
import type { AgentProfile } from '../agent/profiles'
import { log } from '../log'
import type { ApiKeySpec, ApiKeyStore } from './api-keys'
import {
  AgentProvidersConfig,
  type ProvidersLocations,
  type StoredProvider
} from './provider-files'
import { probeProvider } from './provider-probe'

export interface ProvidersSettingsOptions {
  profiles: readonly AgentProfile[]
  locations: ProvidersLocations
  /** Clés chiffrées (fiche 022) ; absent : pas de clé enregistrable. */
  apiKeys?: ApiKeyStore
  /** Environnement de l'app ; `process.env` par défaut. */
  env?: NodeJS.ProcessEnv
  /** Réseau effectif des agents (saisi, sinon celui du shell), pour « Tester ». */
  network: () => NetworkSettings
}

export class ProvidersSettings {
  private readonly options: ProvidersSettingsOptions
  private readonly configs: { profile: AgentProfile; config: AgentProvidersConfig }[]

  constructor(options: ProvidersSettingsOptions) {
    this.options = options
    this.configs = options.profiles.flatMap((profile) =>
      profile.providers
        ? [{ profile, config: new AgentProvidersConfig(profile.providers, options.locations) }]
        : []
    )
  }

  list(): ProvidersView[] {
    return this.configs.map(({ profile, config }) => this.view(profile, config))
  }

  save(profileId: string, raw: unknown, previousId?: string): ProvidersView[] {
    const provider = parseModelProvider(raw)
    if (typeof provider === 'string') throw new Error(provider)
    this.config(profileId).save(provider, previousId)
    log.info(`Fournisseurs : « ${provider.id} » enregistré pour ${profileId}`)
    return this.list()
  }

  remove(profileId: string, id: string): ProvidersView[] {
    this.config(profileId).remove(id)
    log.info(`Fournisseurs : « ${id} » retiré pour ${profileId}`)
    return this.list()
  }

  setEnabled(profileId: string, id: string, enabled: boolean): ProvidersView[] {
    this.config(profileId).setEnabled(id, enabled)
    return this.list()
  }

  setOnly(profileId: string, only: boolean): ProvidersView[] {
    this.config(profileId).setOnly(only)
    return this.list()
  }

  /**
   * Clé d'un fournisseur : chiffrée dans le trousseau sous la variable que le fichier attend ; un
   * fichier qui la donnait en clair (ou pas du tout) passe à `{env:VAR}`.
   */
  async setKey(profileId: string, id: string, value: string): Promise<ProvidersView[]> {
    const store = this.options.apiKeys
    if (!store) throw new Error(t('conversations.error.noApiKeys'))
    const { config } = this.entry(profileId)
    const provider = this.stored(config, id)
    const env = provider.key.kind === 'env' ? provider.key.env : keyVariableFor(id)
    await store.set(profileId, env, value)
    if (provider.key.kind !== 'env') config.useKeyVariable(id, env)
    log.info(`Fournisseurs : clé de « ${id} » enregistrée pour ${profileId} (${env})`)
    return this.list()
  }

  removeKey(profileId: string, id: string): ProvidersView[] {
    const { config } = this.entry(profileId)
    const provider = this.stored(config, id)
    if (provider.key.kind === 'env') this.options.apiKeys?.remove(profileId, provider.key.env)
    return this.list()
  }

  /** « Tester » : `GET /models` avec la clé (enregistrée, sinon celle de l'environnement). */
  async test(profileId: string, id: string): Promise<ProviderTestResult> {
    const { config } = this.entry(profileId)
    const provider = this.stored(config, id)
    const result = await probeProvider(
      { baseURL: provider.baseURL, ...(await this.keyOf(profileId, provider)) },
      this.options.network()
    )
    log.info(
      `Fournisseurs : test de « ${id} » (${profileId}) : ${
        result.ok ? `${result.models} modèle(s)` : `${result.cause} — ${result.error}`
      } en ${result.ms} ms`
    )
    return result
  }

  /** Variables des fournisseurs d'un agent, à poser à son lancement (`SettingsStore.credentials`). */
  keySpecs(profile: AgentProfile): ApiKeySpec[] {
    const found = this.configs.find((c) => c.profile.id === profile.id)
    if (!found) return []
    const read = found.config.read()
    if ('error' in read) return []
    return read.providers.flatMap((p) =>
      p.key.kind === 'env' ? [{ env: p.key.env, label: p.name }] : []
    )
  }

  /** Réglages › Diagnostic : une ligne par fournisseur activé des agents installés. */
  async diagnose(installed: readonly string[]): Promise<DiagnosticGroup> {
    const checks: DiagnosticCheck[] = []
    const views = this.configs
      .filter(({ profile }) => installed.includes(profile.id))
      .map(({ profile, config }) => this.view(profile, config))
    for (const view of views) {
      if (view.error) {
        checks.push({
          id: `${view.profileId}:file`,
          label: t('diagnostics.providers.file', { agent: view.label }),
          level: 'warning',
          detail: view.error,
          fix: t('diagnostics.providers.fileFix'),
          action: 'open-agents-settings'
        })
      }
      const results = await Promise.all(
        view.providers.map((p) => (p.enabled ? this.test(view.profileId, p.id) : undefined))
      )
      view.providers.forEach((provider, i) => {
        checks.push(providerCheck(view, provider, results[i]))
      })
    }
    if (checks.length === 0) {
      checks.push({
        id: 'none',
        label: t('diagnostics.providers.label'),
        level: 'optional',
        detail: t('diagnostics.providers.none'),
        action: 'open-agents-settings'
      })
    }
    return { id: 'providers', title: t('diagnostics.group.providers'), checks }
  }

  private view(profile: AgentProfile, config: AgentProvidersConfig): ProvidersView {
    const read = config.read()
    const base = { profileId: profile.id, label: profile.label, file: config.display() }
    if ('error' in read) return { ...base, providers: [], only: false, error: read.error }
    const env = this.options.env ?? process.env
    return {
      ...base,
      only: read.only,
      providers: read.providers.map((p) => {
        const info =
          p.key.kind === 'env'
            ? this.options.apiKeys?.info(profile.id, [{ env: p.key.env, label: p.name }], env)[0]
            : undefined
        return {
          ...p,
          keyStored: info?.stored ?? false,
          ...(info?.unreadable ? { keyUnreadable: true } : {}),
          keyFromEnvironment: p.key.kind === 'env' ? !!env[p.key.env] : false
        }
      })
    }
  }

  /** Clé en clair pour « Tester » : enregistrée (déchiffrée), sinon celle de l'environnement. */
  private async keyOf(profileId: string, provider: StoredProvider): Promise<{ apiKey?: string }> {
    if (provider.key.kind !== 'env') return {}
    const spec = { env: provider.key.env, label: provider.name }
    const stored = (await this.options.apiKeys?.credentials(profileId, [spec]))?.[spec.env]
    const apiKey = stored ?? (this.options.env ?? process.env)[spec.env]
    return apiKey ? { apiKey } : {}
  }

  private stored(config: AgentProvidersConfig, id: string): StoredProvider {
    const read = config.read()
    if ('error' in read) throw new Error(read.error)
    const provider = read.providers.find((p) => p.id === id)
    if (!provider) throw new Error(t('providers.unknown', { id }))
    return provider
  }

  private entry(profileId: string): { profile: AgentProfile; config: AgentProvidersConfig } {
    const found = this.configs.find((c) => c.profile.id === profileId)
    if (!found) throw new Error(t('providers.noAgent', { agent: profileId }))
    return found
  }

  private config(profileId: string): AgentProvidersConfig {
    return this.entry(profileId).config
  }
}

/** Ligne du Diagnostic d'un fournisseur : joint ou non, et pourquoi. */
function providerCheck(
  view: ProvidersView,
  provider: ProviderEntry,
  result: ProviderTestResult | undefined
): DiagnosticCheck {
  const base = {
    id: `${view.profileId}:${provider.id}`,
    label: t('diagnostics.providers.provider', { name: provider.name, agent: view.label })
  }
  if (!provider.enabled || !result) {
    return { ...base, level: 'optional', detail: t('diagnostics.providers.disabled') }
  }
  if (result.ok) {
    return {
      ...base,
      level: 'ok',
      detail: `${provider.baseURL} · ${t('diagnostics.providers.models', { count: result.models })}`
    }
  }
  return {
    ...base,
    level: 'error',
    detail: result.error,
    fix: t(`providers.fix.${result.cause}`),
    action: 'open-agents-settings'
  }
}
