/**
 * Fournisseurs de modèles d'OpenCode (fiche 104), tels que son profil les déclare
 * (`ProvidersSource`, fiche 140). OpenCode 2.0.32 (relevé le 2026-10-21, `pnpm opencode-probe`) :
 * `~/.config/opencode/opencode.json(c)` (`XDG_CONFIG_HOME`), `{ "provider": { id: { npm, name,
 * options: { baseURL, apiKey, … }, models: { id: { name, … } } } }, "enabled_providers": [...],
 * "disabled_providers": [...] }`. Un fournisseur compatible OpenAI a
 * `npm: "@ai-sdk/openai-compatible"`.
 *
 * Modifications par `jsonc-parser` : un fournisseur qui existe garde ses autres champs (paquet,
 * en-têtes, délais, `limit` des modèles…).
 */
import { join } from 'node:path'
import { applyEdits, modify, parse } from 'jsonc-parser'
import { t } from 'i18next'
import { keySourceOf, keyVariableFor, type ProviderModel } from '@shared/providers'
import type { ProvidersSource } from '../agent/adapters'
import { FORMATTING } from './config-prune'
import { firstExisting, isObject, list } from './mcp-files'
import type { StoredProvider, StoredProviders } from './provider-files'

/** Paquet des points d'accès compatibles OpenAI, celui que l'app écrit. */
export const OPENAI_COMPATIBLE = '@ai-sdk/openai-compatible'

type Data = Record<string, unknown>

const apply = (text: string, path: string[], value: unknown): string =>
  applyEdits(text, modify(text, path, value, { formattingOptions: FORMATTING }))

function reparse(text: string): Data {
  const parsed: unknown = parse(text, [], { allowTrailingComma: true })
  return isObject(parsed) ? parsed : {}
}

/** Modèles d'un bloc `models` : identifiant, libellé (`name`, sinon l'identifiant). */
function modelsOf(raw: unknown): ProviderModel[] {
  if (!isObject(raw)) return []
  return Object.entries(raw).map(([id, model]) => ({
    id,
    name: isObject(model) && typeof model['name'] === 'string' && model['name'] ? model['name'] : id
  }))
}

function parseProviders(data: Data): StoredProviders {
  const only = Array.isArray(data['enabled_providers'])
  const enabledList = list(data['enabled_providers'])
  const disabledList = list(data['disabled_providers'])
  const table = isObject(data['provider']) ? data['provider'] : {}
  const providers: StoredProvider[] = []
  for (const [id, raw] of Object.entries(table)) {
    if (!isObject(raw)) continue
    const options = isObject(raw['options']) ? raw['options'] : {}
    const baseURL = typeof options['baseURL'] === 'string' ? options['baseURL'] : ''
    providers.push({
      id,
      name: typeof raw['name'] === 'string' && raw['name'] ? raw['name'] : id,
      baseURL,
      models: modelsOf(raw['models']),
      enabled: !disabledList.includes(id) && (!only || enabledList.includes(id)),
      key: keySourceOf(options['apiKey']),
      ...(typeof raw['npm'] === 'string' && raw['npm'] !== OPENAI_COMPATIBLE
        ? { npm: raw['npm'] }
        : {})
    })
  }
  return { providers, only }
}

/** Active ou désactive dans les listes du fichier, selon celles qui existent. */
function applyEnabled(text: string, data: Data, id: string, enabled: boolean): string {
  let next = text
  const disabled = list(data['disabled_providers'])
  const only = Array.isArray(data['enabled_providers'])
  const allowed = list(data['enabled_providers'])
  if (enabled) {
    if (disabled.includes(id)) {
      const rest = disabled.filter((v) => v !== id)
      next = apply(next, ['disabled_providers'], rest.length ? rest : undefined)
    }
    if (only && !allowed.includes(id)) {
      next = apply(next, ['enabled_providers'], [...allowed, id])
    }
    return next
  }
  if (only && allowed.includes(id)) {
    next = apply(
      next,
      ['enabled_providers'],
      allowed.filter((v) => v !== id)
    )
  } else if (!only && !disabled.includes(id)) {
    next = apply(next, ['disabled_providers'], [...disabled, id])
  }
  return next
}

function renameInLists(text: string, data: Data, from: string, to: string): string {
  let next = text
  for (const key of ['enabled_providers', 'disabled_providers']) {
    const current = list(data[key])
    if (current.includes(from)) {
      next = apply(
        next,
        [key],
        current.map((v) => (v === from ? to : v))
      )
    }
  }
  return next
}

export const OPENCODE_PROVIDERS: ProvidersSource = {
  file: (loc) => {
    const dir = join(loc.xdgConfigHome ?? join(loc.home, '.config'), 'opencode')
    return firstExisting([join(dir, 'opencode.jsonc'), join(dir, 'opencode.json')])
  },
  parse: parseProviders,

  // Un nouveau fournisseur est écrit compatible OpenAI, sa clé attendue en `{env:VAR}`.
  save: (text, data, provider, previousId) => {
    const table = isObject(data['provider']) ? data['provider'] : {}
    const from = previousId ?? provider.id
    const previous = isObject(table[from]) ? table[from] : undefined
    let next = text
    if (previousId && previousId !== provider.id) {
      if (table[provider.id] !== undefined) {
        throw new Error(t('providers.exists', { id: provider.id }))
      }
      if (previous) next = apply(next, ['provider', previousId], undefined)
      next = renameInLists(next, data, previousId, provider.id)
    }
    const options = isObject(previous?.['options']) ? previous['options'] : {}
    const previousModels = isObject(previous?.['models']) ? previous['models'] : {}
    const models: Record<string, unknown> = {}
    for (const model of provider.models) {
      const entry = previousModels[model.id]
      const known = isObject(entry) ? entry : {}
      models[model.id] = { ...known, name: model.name }
    }
    const raw: Record<string, unknown> = {
      ...(previous ?? {}),
      npm: typeof previous?.['npm'] === 'string' ? previous['npm'] : OPENAI_COMPATIBLE,
      name: provider.name,
      options: {
        ...options,
        baseURL: provider.baseURL,
        apiKey:
          typeof options['apiKey'] === 'string' && options['apiKey']
            ? options['apiKey']
            : `{env:${keyVariableFor(provider.id)}}`
      },
      models
    }
    next = apply(next, ['provider', provider.id], raw)
    return applyEnabled(next, reparse(next), provider.id, provider.enabled)
  },

  // `"provider": {}` part aussi, et le fichier s'il est vide (fiche 126).
  remove: (text, data, id) => {
    let next = text
    if (isObject(data['provider']) && data['provider'][id] !== undefined) {
      next = apply(next, ['provider', id], undefined)
    }
    for (const key of ['enabled_providers', 'disabled_providers']) {
      const current = list(data[key])
      if (current.includes(id)) {
        next = apply(
          next,
          [key],
          current.filter((v) => v !== id)
        )
      }
    }
    return { text: next, removed: ['provider', id] }
  },

  setEnabled: applyEnabled,

  // `enabled_providers` = les fournisseurs activés du fichier ; retiré sinon, les fournisseurs
  // désactivés passant dans `disabled_providers` pour le rester.
  setOnly: (text, data, only) => {
    const { providers } = parseProviders(data)
    if (only) {
      return apply(
        text,
        ['enabled_providers'],
        providers.filter((p) => p.enabled).map((p) => p.id)
      )
    }
    let next = apply(text, ['enabled_providers'], undefined)
    const disabled = list(data['disabled_providers'])
    const off = providers.filter((p) => !p.enabled && !disabled.includes(p.id)).map((p) => p.id)
    if (off.length) next = apply(next, ['disabled_providers'], [...disabled, ...off])
    return next
  },

  useKeyVariable: (text, data, id, env) => {
    if (!isObject(data['provider']) || !isObject(data['provider'][id])) {
      throw new Error(t('providers.unknown', { id }))
    }
    return apply(text, ['provider', id, 'options', 'apiKey'], `{env:${env}}`)
  }
}
