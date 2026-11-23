/**
 * Réseau d'entreprise (fiche 104) : proxy et certificats, repris du shell de connexion ou saisis
 * dans Réglages › Agents, posés dans l'environnement de tous les agents à leur lancement
 * (`HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS` : ce que lisent Node et Bun, donc
 * Bob et OpenCode). Les réglages saisis l'emportent sur le shell.
 */
import type { NetworkSettings, NetworkView } from '@shared/providers'
import { withEnvChanges, type EnvChanges } from './api-keys'
import { DEFAULT_NO_PROXY } from './provider-probe'

const first = (env: NodeJS.ProcessEnv, names: string[]): string | undefined =>
  names.map((name) => env[name]?.trim()).find(Boolean)

/** Ce que l'environnement de l'app (shell de connexion compris) donne déjà. */
export function networkFromEnv(env: NodeJS.ProcessEnv): NetworkSettings {
  const proxy = first(env, ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'])
  const noProxy = first(env, ['NO_PROXY', 'no_proxy'])
  const caCerts = first(env, ['NODE_EXTRA_CA_CERTS'])
  return {
    ...(proxy ? { proxy } : {}),
    ...(noProxy ? { noProxy } : {}),
    ...(caCerts ? { caCerts } : {})
  }
}

/**
 * Proxy qu'un agent a vraiment dans son environnement (celui de l'app, son profil, puis ses
 * variables posées au lancement), pour la piste réseau des bandeaux (fiche 275). Non masqué : à
 * masquer avant tout affichage (`maskUrlCredentials`).
 */
export function agentProxy(
  base: NodeJS.ProcessEnv,
  profileEnv: Record<string, string>,
  changes: EnvChanges
): string | undefined {
  return agentNetwork(base, profileEnv, changes).proxy
}

/** Réseau d'entreprise qu'un agent a dans son environnement : proxy, exceptions, certificats. */
export function agentNetwork(
  base: NodeJS.ProcessEnv,
  profileEnv: Record<string, string>,
  changes: EnvChanges
): NetworkSettings {
  return networkFromEnv(withEnvChanges({ ...base, ...profileEnv }, changes))
}

/** Mêmes proxy, exceptions et certificats (fiche 276 : réglages changés depuis le lancement). */
export function sameNetwork(a: NetworkSettings, b: NetworkSettings): boolean {
  return a.proxy === b.proxy && a.noProxy === b.noProxy && a.caCerts === b.caCerts
}

/** Réglages saisis, complétés par l'environnement : ce que les agents auront vraiment. */
export function effectiveNetwork(
  settings: NetworkSettings,
  env: NodeJS.ProcessEnv
): NetworkSettings {
  const shell = networkFromEnv(env)
  const proxy = settings.proxy ?? shell.proxy
  const noProxy = settings.noProxy ?? shell.noProxy
  const caCerts = settings.caCerts ?? shell.caCerts
  return {
    ...(proxy ? { proxy } : {}),
    ...(noProxy ? { noProxy } : {}),
    ...(caCerts ? { caCerts } : {})
  }
}

export function networkView(settings: NetworkSettings, env: NodeJS.ProcessEnv): NetworkView {
  return { settings, fromShell: networkFromEnv(env) }
}

/**
 * Variables à poser dans l'environnement d'un agent d'après les réglages saisis (rien pour ce qui
 * ne l'est pas : l'environnement de l'app reste). Un proxy sans `NO_PROXY` nulle part en reçoit un
 * pour le trafic local (le serveur d'outils de l'app est sur 127.0.0.1).
 */
export function networkEnvChanges(settings: NetworkSettings, env: NodeJS.ProcessEnv): EnvChanges {
  const changes: EnvChanges = {}
  if (settings.proxy) {
    changes['HTTPS_PROXY'] = settings.proxy
    changes['HTTP_PROXY'] = settings.proxy
  }
  if (settings.noProxy) changes['NO_PROXY'] = settings.noProxy
  else if (settings.proxy && !first(env, ['NO_PROXY', 'no_proxy'])) {
    changes['NO_PROXY'] = DEFAULT_NO_PROXY
  }
  if (settings.caCerts) changes['NODE_EXTRA_CA_CERTS'] = settings.caCerts
  return changes
}

/** Réglages saisis, nettoyés : espaces retirés, champs vides omis. */
export function parseNetworkSettings(raw: unknown): NetworkSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '')
  const proxy = text(r['proxy'])
  const noProxy = text(r['noProxy'])
  const caCerts = text(r['caCerts']).replace(/^~(?=\/)/, process.env['HOME'] ?? '~')
  return {
    ...(proxy ? { proxy } : {}),
    ...(noProxy ? { noProxy } : {}),
    ...(caCerts ? { caCerts } : {})
  }
}

/** Canal des réglages réseau (`settings:network`, `settings:setNetwork`) sur le magasin des réglages. */
export function networkController(store: {
  network(): NetworkSettings
  setNetwork(change: unknown): NetworkSettings
}): { get(): NetworkView; set(change: unknown): NetworkView } {
  return {
    get: () => networkView(store.network(), process.env),
    set: (change) => networkView(store.setNetwork(change), process.env)
  }
}

/**
 * Réseau d'entreprise d'un agent lancé maintenant, et changements des réglages (fiche 276) : de
 * quoi dire, dans les bandeaux d'un agent déjà lancé, que ses réglages réseau ont changé.
 */
export interface NetworkSource {
  env(): EnvChanges
  onChange(listener: () => void): () => void
}
