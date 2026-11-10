/**
 * Sous-agents d'OpenCode (fiches 010, 053, 078), tels que le profil d'OpenCode les déclare
 * (`subagentFormat`, fiche 140). Formats relevés :
 *
 * - OpenCode 1.19 : outil `task`, titre = description, `rawInput: { description, prompt,
 *   subagent_type }` ; résultat `<task id="…" state="completed"><task_result>…</task_result></task>`.
 * - OpenCode 2.0.31 : outil `subagent`, titre « subagent », `rawInput: { agent, description,
 *   prompt }` ; résultat `<subagent sessionID="ses_…" state="completed">…</subagent>`, et
 *   `rawOutput.metadata.sessionID`. Son travail arrive en direct (voir `opencode-contract.ts`).
 */
import type { Subagent } from '@shared/subagent'
import type { SubagentFormat } from './adapters'
import { t } from 'i18next'

/** Titre de l'outil d'OpenCode 2 (`subagent`), ou de la 1.19 avant la consigne (`task`). */
const TITLE = /^(subagent|task)$/i

/** Identifiant de session sûr : il est renvoyé tel quel à l'agent (`session/load`). */
const SESSION_ID = /^[\w-]{1,200}$/

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

/** Sous-agent lancé par cet appel d'outil d'OpenCode, ou `undefined`. */
export function openCodeSubagentOf(
  title: string | undefined,
  rawInput: unknown
): Subagent | undefined {
  const input = record(rawInput) ?? {}
  // OpenCode 1.19 : `subagent_type`.
  const type = text(input['subagent_type'])
  if (type) {
    const task = text(input['description']) ?? text(title) ?? 'Sous-agent'
    const prompt = text(input['prompt'])
    return { type, task, ...(prompt && prompt !== task ? { prompt } : {}) }
  }
  // OpenCode 2 : `agent` (type), avec la consigne ; le titre reste le nom de l'outil.
  const agent = text(input['agent'])
  const prompt = text(input['prompt'])
  if (agent && prompt && (text(input['description']) || (title && TITLE.test(title)))) {
    const task = text(input['description']) ?? prompt
    return { type: agent, task, ...(prompt !== task ? { prompt } : {}) }
  }
  return undefined
}

/**
 * Session du sous-agent, quand sa réponse la nomme (1.19 : `<task id="ses_…" …>` ; 2 :
 * `<subagent sessionID="ses_…" …>`, et `rawOutput.metadata.sessionID`, même pour un sous-agent
 * lancé en arrière-plan). Forme sûre seulement.
 */
export function openCodeSubagentSessionId(output: string, rawOutput?: unknown): string | undefined {
  const fromMetadata = record(record(rawOutput)?.['metadata'])?.['sessionID']
  if (typeof fromMetadata === 'string' && SESSION_ID.test(fromMetadata)) return fromMetadata
  return (
    /<task\s+id="([\w-]{1,200})"/.exec(output)?.[1] ??
    /<subagent\s+sessionID="([\w-]{1,200})"/.exec(output)?.[1]
  )
}

export const OPENCODE_SUBAGENT_FORMAT: SubagentFormat = {
  summary: () => t('capabilities.subagentCalls.opencode'),
  subagentOf: openCodeSubagentOf,
  sessionId: openCodeSubagentSessionId
}
