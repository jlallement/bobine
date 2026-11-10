/**
 * Canaux IPC de l'aparté (fiche 180), branchés par `ipc.ts` comme ceux de la fusion des filles.
 * Les arguments viennent du renderer : vérifiés ici. La réponse suit par `aside:changed`.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { Asides } from './aside'

type AsideChannel = Extract<keyof IpcHandlers, `aside:${string}`>

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function asideHandlers(
  asides: Pick<Asides, 'ask' | 'close' | 'view'> | undefined
): Pick<IpcHandlers, AsideChannel> {
  const available = () => {
    if (!asides) throw new Error(t('ipc.unavailable.aside'))
    return asides
  }
  return {
    'aside:ask': async (id, request) => {
      const r = typeof request === 'object' && request !== null ? request : undefined
      const question = typeof r?.question === 'string' ? r.question : ''
      if (!question.trim()) throw new Error('Paramètre invalide : question')
      // Pas d'attente de la réponse : elle suit par `aside:changed`.
      void available()
        .ask(str(id, 'id'), { question, withContext: r?.withContext === true })
        .catch(() => {})
      return undefined
    },
    'aside:close': async (id) => {
      await available().close(str(id, 'id'))
      return undefined
    },
    'aside:view': (id) => available().view(str(id, 'id'))
  }
}
