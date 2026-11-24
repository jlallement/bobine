/**
 * Canaux IPC du tour de table (fiche 285, ADR-0072), branchés par `ipc.ts`. Chaque argument venu
 * du renderer passe par les `parse…` du contrat (`@shared/roundtable-ipc`) avant d'atteindre
 * l'orchestrateur, qui vérifie ensuite la conversation, le tour et la place contre l'état réel.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { RoundtableLetter } from '@shared/roundtable'
import { QUESTION_CHARS } from '@shared/roundtable-prompts'
import {
  parseOptionalLetter,
  parseRoundtableId,
  parseRoundtableLetter,
  parseRoundtableStartRequest,
  type RoundtableChannel,
  type RoundtableOptions,
  type RoundtableStartRequest,
  type RoundtableStartResult
} from '@shared/roundtable-ipc'

/** Ce que les canaux demandent à l'orchestrateur ; arguments déjà vérifiés. */
export interface RoundtableService {
  options(conversationId: string): RoundtableOptions | Promise<RoundtableOptions>
  start(
    conversationId: string,
    request: RoundtableStartRequest
  ): RoundtableStartResult | Promise<RoundtableStartResult>
  synthesize(conversationId: string, roundtableId: string): void | Promise<void>
  rebuttal(conversationId: string, roundtableId: string): void | Promise<void>
  decide(conversationId: string, roundtableId: string): void | Promise<void>
  relaunch(
    conversationId: string,
    roundtableId: string,
    letter: RoundtableLetter
  ): void | Promise<void>
  stop(
    conversationId: string,
    roundtableId: string,
    letter?: RoundtableLetter
  ): void | Promise<void>
}

/** Gestionnaires des canaux `roundtable:*` ; sans orchestrateur, chacun refuse clairement. */
export function roundtableHandlers(
  service: RoundtableService | undefined
): Pick<IpcHandlers, RoundtableChannel> {
  const available = (): RoundtableService => {
    if (!service) throw new Error(t('roundtable.error.unavailable'))
    return service
  }
  const conversation = (value: unknown) => parseRoundtableId(value, 'conversationId')
  const roundtable = (value: unknown) => parseRoundtableId(value, 'roundtableId')
  return {
    'roundtable:options': (conversationId) => available().options(conversation(conversationId)),
    'roundtable:start': (conversationId, request) => {
      const id = conversation(conversationId)
      // Question trop longue : l'erreur typée du tour, sur tout chemin (pas « paramètre invalide »).
      const question = (request as { question?: unknown } | null)?.question
      if (typeof question === 'string' && question.trim().length > QUESTION_CHARS) {
        return { ok: false, error: 'question' }
      }
      const parsed = parseRoundtableStartRequest(request)
      return available().start(id, parsed)
    },
    'roundtable:synthesize': async (conversationId, roundtableId) => {
      const [id, rt] = [conversation(conversationId), roundtable(roundtableId)]
      await available().synthesize(id, rt)
      return undefined
    },
    'roundtable:rebuttal': async (conversationId, roundtableId) => {
      const [id, rt] = [conversation(conversationId), roundtable(roundtableId)]
      await available().rebuttal(id, rt)
      return undefined
    },
    'roundtable:decide': async (conversationId, roundtableId) => {
      const [id, rt] = [conversation(conversationId), roundtable(roundtableId)]
      await available().decide(id, rt)
      return undefined
    },
    'roundtable:relaunch': async (conversationId, roundtableId, letter) => {
      const [id, rt] = [conversation(conversationId), roundtable(roundtableId)]
      const seat = parseRoundtableLetter(letter)
      await available().relaunch(id, rt, seat)
      return undefined
    },
    'roundtable:stop': async (conversationId, roundtableId, letter) => {
      const [id, rt] = [conversation(conversationId), roundtable(roundtableId)]
      const seat = parseOptionalLetter(letter)
      await available().stop(id, rt, seat)
      return undefined
    }
  }
}
