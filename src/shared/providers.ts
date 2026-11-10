import { t } from 'i18next'
/**
 * Fournisseurs de modèles d'un agent (fiche 104) : points d'accès compatibles OpenAI (modèles
 * internes servis en LLMaaS) déclarés dans le fichier de l'agent (OpenCode :
 * `~/.config/opencode/opencode.json`, bloc `provider`). L'app les montre et les modifie, dans un
 * format commun ; la clé d'API est chiffrée dans le trousseau et posée dans l'environnement de
 * l'agent par la variable que le fichier attend (`{env:VAR}`).
 */

/** Un modèle du fournisseur : son identifiant chez lui, son libellé dans les menus. */
export interface ProviderModel {
  id: string
  name: string
}

/** Comment le fichier donne la clé d'API du fournisseur. */
export type ProviderKeySource =
  /** `{env:VAR}` : la variable d'environnement, posée par l'app au lancement si elle a la clé. */
  | { kind: 'env'; env: string }
  /** Écrite en clair dans le fichier. */
  | { kind: 'plain' }
  /** `{file:…}` : lue dans un fichier par l'agent. */
  | { kind: 'file'; path: string }
  | { kind: 'none' }

export interface ModelProvider {
  /** Clé du bloc `provider` (`llmaas`), et préfixe des modèles (`llmaas/qwen3-32b`). */
  id: string
  /** Libellé dans les menus de l'agent. */
  name: string
  /** Adresse de base du point d'accès, `/v1` compris. */
  baseURL: string
  models: ProviderModel[]
  enabled: boolean
}

/** Fournisseur tel qu'il est déclaré chez l'agent, avec ce que l'app sait de sa clé. */
export interface ProviderEntry extends ModelProvider {
  key: ProviderKeySource
  /** Clé enregistrée dans l'app (chiffrée) pour la variable `key.env`. */
  keyStored: boolean
  /** Enregistrée, mais le trousseau n'a pas su la déchiffrer : à ressaisir. */
  keyUnreadable?: boolean
  /** La variable `key.env` est déjà dans l'environnement de l'app. */
  keyFromEnvironment: boolean
  /**
   * Paquet qui parle au point d'accès (`npm` chez OpenCode) ; absent : celui des points d'accès
   * compatibles OpenAI, que l'app sait écrire.
   */
  npm?: string
}

export interface ProvidersView {
  profileId: string
  label: string
  /** Fichier lu et écrit, `~` pour le dossier personnel. */
  file: string
  providers: ProviderEntry[]
  /** « Seulement ces fournisseurs » : `enabled_providers` présent dans le fichier. */
  only: boolean
  /** Fichier illisible (JSON invalide…) : affiché, et rien n'est écrit dedans. */
  error?: string
}

/** Réglages réseau d'entreprise (fiche 104), posés dans l'environnement des agents. */
export interface NetworkSettings {
  /** `HTTPS_PROXY` (et `HTTP_PROXY`) : `http://hôte:port`, identifiants compris s'il en faut. */
  proxy?: string
  /** `NO_PROXY` : hôtes joints sans proxy ; `localhost,127.0.0.1` si absent et proxy posé. */
  noProxy?: string
  /** `NODE_EXTRA_CA_CERTS` : fichier PEM des certificats de l'entreprise. */
  caCerts?: string
}

/** Réglages réseau pour l'interface : saisis, et ce que le shell de connexion donne sinon. */
export interface NetworkView {
  settings: NetworkSettings
  /** Valeurs trouvées dans l'environnement (shell de connexion), appliquées faute de saisie. */
  fromShell: NetworkSettings
}

/** Pourquoi « Tester » a échoué : la marche à suivre en dépend. */
export type ProviderTestCause =
  | 'refused'
  | 'dns'
  | 'timeout'
  | 'proxy'
  | 'certificate'
  | 'unauthorized'
  | 'not-found'
  | 'http'
  | 'other'

export type ProviderTestResult =
  | { ok: true; models: number; ms: number }
  | { ok: false; cause: ProviderTestCause; error: string; ms: number }

export const PROVIDER_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/
export const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/

/** Variable d'environnement qui portera la clé d'un fournisseur : `llmaas` → `LLMAAS_API_KEY`. */
export function keyVariableFor(id: string): string {
  return `${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/** Source de la clé d'après ce que le fichier donne (`{env:VAR}`, `{file:…}`, en clair, rien). */
export function keySourceOf(value: unknown): ProviderKeySource {
  if (typeof value !== 'string' || !value) return { kind: 'none' }
  const env = /^\{env:([^}]+)\}$/.exec(value)
  if (env?.[1]) return { kind: 'env', env: env[1].trim() }
  const file = /^\{file:([^}]+)\}$/.exec(value)
  if (file?.[1]) return { kind: 'file', path: file[1].trim() }
  return { kind: 'plain' }
}

/**
 * Fournisseur saisi dans les réglages : vérifié et nettoyé, ou message d'erreur. Modèles sans
 * libellé : l'identifiant sert de libellé.
 */
export function parseModelProvider(raw: unknown): ModelProvider | string {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const id = typeof r['id'] === 'string' ? r['id'].trim() : ''
  if (!PROVIDER_ID.test(id)) return t('providers.check.id')
  const baseURL = typeof r['baseURL'] === 'string' ? r['baseURL'].trim().replace(/\/+$/, '') : ''
  if (!/^https?:\/\/\S+$/.test(baseURL)) return t('providers.check.url')
  const name = typeof r['name'] === 'string' && r['name'].trim() ? r['name'].trim() : id
  const models: ProviderModel[] = []
  for (const m of Array.isArray(r['models']) ? r['models'] : []) {
    const model = (typeof m === 'object' && m !== null ? m : {}) as Record<string, unknown>
    const modelId = typeof model['id'] === 'string' ? model['id'].trim() : ''
    if (!MODEL_ID.test(modelId)) return t('providers.check.model', { id: modelId })
    if (models.some((known) => known.id === modelId)) continue
    const label = typeof model['name'] === 'string' ? model['name'].trim() : ''
    models.push({ id: modelId, name: label || modelId })
  }
  if (models.length === 0) return t('providers.check.noModel')
  return { id, name, baseURL, models, enabled: r['enabled'] !== false }
}

/** Modèles saisis une ligne par modèle : `identifiant = libellé`, ou l'identifiant seul. */
export function parseModelLines(text: string): ProviderModel[] {
  const models: ProviderModel[] = []
  for (const line of text.split('\n')) {
    const at = line.indexOf('=')
    const id = (at >= 0 ? line.slice(0, at) : line).trim()
    if (!id) continue
    const name = at >= 0 ? line.slice(at + 1).trim() : ''
    models.push({ id, name: name || id })
  }
  return models
}

/** L'inverse : les modèles en lignes `identifiant = libellé` (libellé omis s'il répète l'identifiant). */
export function modelLines(models: readonly ProviderModel[]): string {
  return models.map((m) => (m.name && m.name !== m.id ? `${m.id} = ${m.name}` : m.id)).join('\n')
}
