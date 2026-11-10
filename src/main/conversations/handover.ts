/**
 * Continuer une conversation avec un autre agent (fiche 108, ADR-0024) : les agents proposés et
 * leurs modèles mis en avant, où partiraient les messages, et la bascule elle-même (le gestionnaire
 * change l'agent de la conversation, puis le modèle choisi est réglé par le réglage ACP de
 * catégorie `model`). Sorti du gestionnaire, qui n'a plus de place (fiche 089).
 */
import { t } from 'i18next'
import type { ConversationView, ProfileSummary } from '@shared/agent'
import {
  FEATURED_MODELS,
  type DataDestination,
  type HandoverModel,
  type HandoverTarget
} from '@shared/handover'
import type { IpcHandlers } from '@shared/ipc'
import type { ModelProvider, ProvidersView } from '@shared/providers'
import { modelControl, type ModelsSeen } from '../agent/models-seen'
import { log } from '../log'
import type { ConversationManager } from './manager'

/** Ce que la bascule demande au gestionnaire des conversations. */
export type HandoverManager = Pick<
  ConversationManager,
  'view' | 'settingsView' | 'switchAgent' | 'ready' | 'setControl' | 'post' | 'settings'
>

/** Fournisseurs de modèles déclarés chez chaque agent (fiche 104) ; vide s'il n'y en a pas. */
export type ProvidersList = () => ProvidersView[]

/**
 * Où partent les messages pour ce modèle : le fournisseur déclaré qui porte son préfixe (nom et
 * adresse), sinon le préfixe seul, sinon ce que le profil dit de l'agent.
 */
export function destinationOf(
  value: string | undefined,
  providers: readonly ModelProvider[],
  agent: string | undefined
): DataDestination {
  const cut = value?.indexOf('/') ?? -1
  const prefix = value && cut > 0 ? value.slice(0, cut) : undefined
  const provider = prefix && providers.find((p) => p.id === prefix)
  if (provider) return { kind: 'provider', name: provider.name, url: provider.baseURL }
  if (prefix) return { kind: 'prefix', provider: prefix }
  return agent ? { kind: 'agent', text: agent } : { kind: 'unknown' }
}

/**
 * Modèles d'un agent dans l'ordre du menu : les derniers utilisés, puis ceux des fournisseurs
 * déclarés (au plus `FEATURED_MODELS` mis en avant), puis les autres vus à sa dernière session.
 */
export function targetModels(
  memory: ModelsSeen | undefined,
  providers: readonly ModelProvider[],
  agent: string | undefined
): HandoverModel[] {
  const seen = memory?.options ?? []
  const nameOf = (value: string, fallback = value) =>
    seen.find((o) => o.value === value)?.name ?? fallback
  const model = (value: string, name: string, featured?: HandoverModel['featured']) => ({
    value,
    name,
    ...(featured ? { featured } : {}),
    destination: destinationOf(value, providers, agent)
  })
  const featured: HandoverModel[] = []
  const add = (candidate: HandoverModel) => {
    const known = featured.some((m) => m.value === candidate.value)
    if (!known && featured.length < FEATURED_MODELS) featured.push(candidate)
  }
  for (const value of memory?.recent ?? []) add(model(value, nameOf(value), 'recent'))
  for (const provider of providers.filter((p) => p.enabled)) {
    for (const m of provider.models) {
      const value = `${provider.id}/${m.id}`
      add(model(value, nameOf(value, `${provider.name}/${m.name}`), 'provider'))
    }
  }
  const rest = seen
    .filter((o) => !featured.some((m) => m.value === o.value))
    .map((o) => model(o.value, o.name))
  return [...featured, ...rest]
}

/** Agents vers qui continuer la conversation `id` : installés, autres que le sien. */
export function handoverTargets(
  manager: HandoverManager,
  providers: ProvidersList,
  id: string
): HandoverTarget[] {
  const { profileId: current, draft } = manager.view(id).summary
  // Conversation vide : rien à transmettre, on choisit simplement son agent.
  if (draft) return []
  const declared = providers()
  const memory = manager.settings.current.models ?? {}
  return manager
    .settingsView()
    .profiles.filter((p) => p.available && p.id !== current)
    .map((profile) => {
      const own = declared.find((v) => v.profileId === profile.id)?.providers ?? []
      return {
        profileId: profile.id,
        label: profile.label,
        models: targetModels(memory[profile.id], own, profile.destination),
        destination: destinationOf(undefined, own, profile.destination)
      }
    })
}

/**
 * Continue la conversation avec `profileId`, et le modèle `model` s'il est donné : réglé dès que
 * l'agent est prêt, s'il le propose ; sinon un avis le dit et l'agent garde le sien.
 */
export async function continueWith(
  manager: HandoverManager,
  providers: ProvidersList,
  id: string,
  profileId: string,
  model?: string
): Promise<ConversationView> {
  const { summary } = manager.view(id)
  const target = manager
    .settingsView()
    .profiles.find((p: ProfileSummary) => p.id === profileId && p.available)
  if (!target || summary.draft || profileId === summary.profileId) {
    throw new Error(t('handover.error.agent'))
  }
  // Nom du modèle tel que le menu le montrait : vu chez l'agent, sinon celui du fournisseur.
  const own = providers().find((v) => v.profileId === profileId)?.providers ?? []
  const known = targetModels(manager.settings.current.models?.[profileId], own, undefined)
  const name = model ? (known.find((m) => m.value === model)?.name ?? model) : undefined
  manager.switchAgent(id, profileId, {
    type: 'handover',
    handover: {
      from: { profileId: summary.profileId, label: summary.profileLabel },
      to: { profileId, label: target.label },
      ...(name ? { model: name } : {})
    }
  })
  log.info(`Conversation ${id} : continuée avec ${profileId}${model ? ` (${model})` : ''}`)
  if (model) await applyModel(manager, id, model, target.label)
  return manager.view(id)
}

async function applyModel(
  manager: HandoverManager,
  id: string,
  model: string,
  agent: string
): Promise<void> {
  // L'agent qui ne démarre pas le dit dans le fil : rien de plus à signaler ici.
  const started = await manager.ready(id).then(
    () => true,
    () => false
  )
  if (!started) return
  const control = modelControl(manager.view(id).snapshot?.controls ?? [])
  if (control?.currentValue === model) return
  if (!control?.options.some((o) => o.value === model)) {
    manager.post(id, {
      type: 'notice',
      level: 'warning',
      message: { key: 'handover.notice.modelMissing', params: { model, agent } }
    })
    return
  }
  await manager.setControl(id, control.id, model)
}

type HandoverChannels = 'conversation:handoverTargets' | 'conversation:continueWith'

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */
function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function handoverHandlers(
  manager: HandoverManager,
  providers: ProvidersList
): Pick<IpcHandlers, HandoverChannels> {
  return {
    'conversation:handoverTargets': (id) => handoverTargets(manager, providers, str(id, 'id')),
    'conversation:continueWith': (id, profileId, model) =>
      continueWith(
        manager,
        providers,
        str(id, 'id'),
        str(profileId, 'profileId'),
        model === undefined ? undefined : str(model, 'model')
      )
  }
}
