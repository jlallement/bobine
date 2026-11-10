/**
 * Canaux des fournisseurs de modèles et du réseau d'entreprise (fiche 104), sortis d'`ipc.ts` :
 * les fournisseurs lus et écrits dans le fichier de chaque agent, leurs clés, « Tester », le
 * groupe du Diagnostic ; proxy et certificats des réglages.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { NetworkView } from '@shared/providers'
import type { ProvidersSettings } from './providers-settings'

type ProviderChannels =
  | 'providers:list'
  | 'providers:save'
  | 'providers:remove'
  | 'providers:setEnabled'
  | 'providers:setOnly'
  | 'providers:setKey'
  | 'providers:removeKey'
  | 'providers:test'
  | 'providers:diagnose'
  | 'settings:network'
  | 'settings:setNetwork'

export type ProvidersController = Pick<
  ProvidersSettings,
  | 'list'
  | 'save'
  | 'remove'
  | 'setEnabled'
  | 'setOnly'
  | 'setKey'
  | 'removeKey'
  | 'test'
  | 'diagnose'
>

export interface NetworkController {
  get(): NetworkView
  set(change: unknown): NetworkView
}

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function providersHandlers(
  providers: ProvidersController | undefined,
  network: NetworkController | undefined,
  /** Agents installés (leur commande trouvée), pour le Diagnostic. */
  installed: () => string[]
): Pick<IpcHandlers, ProviderChannels> {
  const settings = () => {
    if (!providers) throw new Error(t('ipc.unavailable.providers'))
    return providers
  }
  const net = () => {
    if (!network) throw new Error(t('ipc.unavailable.providers'))
    return network
  }
  return {
    'providers:list': () => settings().list(),
    'providers:save': (profileId, provider, previousId) =>
      settings().save(
        str(profileId, 'profileId'),
        provider,
        previousId === undefined ? undefined : str(previousId, 'previousId')
      ),
    'providers:remove': (profileId, id) =>
      settings().remove(str(profileId, 'profileId'), str(id, 'id')),
    'providers:setEnabled': (profileId, id, enabled) =>
      settings().setEnabled(str(profileId, 'profileId'), str(id, 'id'), bool(enabled, 'enabled')),
    'providers:setOnly': (profileId, only) =>
      settings().setOnly(str(profileId, 'profileId'), bool(only, 'only')),
    'providers:setKey': (profileId, id, value) =>
      settings().setKey(str(profileId, 'profileId'), str(id, 'id'), str(value, 'value')),
    'providers:removeKey': (profileId, id) =>
      settings().removeKey(str(profileId, 'profileId'), str(id, 'id')),
    'providers:test': (profileId, id) =>
      settings().test(str(profileId, 'profileId'), str(id, 'id')),
    'providers:diagnose': () => settings().diagnose(installed()),
    'settings:network': () => net().get(),
    'settings:setNetwork': (change) => net().set(change)
  }
}
