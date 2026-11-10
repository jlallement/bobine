/**
 * Canaux de l'onglet « Échanges ACP » (fiche 135) : instantané à l'ouverture, puis les lots des
 * conversations regardées, relayés aux fenêtres par `send`. L'émetteur des appels est vérifié par
 * `registerIpcHandlers`, comme pour tous les canaux (fiche 114).
 */
import type { IpcEventChannel, IpcEventContract, IpcHandlers } from '@shared/ipc'
import type { AcpExchanges } from './acp-exchanges'

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

type Send = <C extends IpcEventChannel>(channel: C, payload: IpcEventContract[C]) => void

export function acpExchangeHandlers(
  exchanges: AcpExchanges,
  send?: Send
): Pick<IpcHandlers, 'acp:watch' | 'acp:unwatch'> {
  if (send) exchanges.onBatch((batch) => send('acp:messages', batch))
  return {
    'acp:watch': (id) => exchanges.watch(str(id, 'id')),
    'acp:unwatch': (id) => {
      exchanges.unwatch(str(id, 'id'))
      return undefined
    }
  }
}
