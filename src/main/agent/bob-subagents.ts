/**
 * Sous-agents de Bob (fiche 010), tels que le profil Bob les déclare (`subagentFormat`, fiche 140).
 * Relevé sur Bob 2.0.6 le 2026-10-13 : outil `spawn_subagent`, titre « Running subagent:
 * <consigne> », `rawInput: { description, name }` (`name` : type, ex. `explore`) ; résultat
 * `<task_result>…</task_result>`. Bob ne garde pas la session de ses sous-agents : rien à rejouer.
 */
import type { Subagent } from '@shared/subagent'
import { t } from 'i18next'
import type { SubagentFormat } from './adapters'

const TITLE = /^Running subagent:\s*/

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** Sous-agent lancé par cet appel d'outil de Bob, ou `undefined`. */
export function bobSubagentOf(title: string | undefined, rawInput: unknown): Subagent | undefined {
  if (!title || !TITLE.test(title)) return undefined
  const input =
    typeof rawInput === 'object' && rawInput !== null ? (rawInput as Record<string, unknown>) : {}
  const type = text(input['name'])
  const task = text(input['description']) ?? text(title.replace(TITLE, '')) ?? 'Sous-agent'
  return { ...(type ? { type } : {}), task }
}

export const BOB_SUBAGENT_FORMAT: SubagentFormat = {
  summary: () => t('capabilities.subagentCalls.bob'),
  subagentOf: bobSubagentOf
}
