/**
 * Export CSV du tableau de consommation (fiche 137) : une ligne par tour, ou une ligne par jour.
 * En-têtes techniques en anglais : ce sont des données, lues par un tableur ou un script, pas des
 * textes de l'interface (ADR-0014). RFC 4180 (virgule, guillemets doublés, CRLF), nombres avec un
 * point ; un champ qui commencerait par `=`, `+`, `-` ou `@` est protégé d'une apostrophe, pour
 * qu'un tableur ne l'exécute pas comme une formule.
 */
import type { TurnRow } from './usage-db'

type Cell = string | number | undefined

const FORMULA = /^[=+\-@\t\r]/

function field(value: Cell): string {
  if (value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = FORMULA.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const line = (cells: readonly Cell[]) => cells.map(field).join(',')
const csv = (header: readonly string[], rows: readonly (readonly Cell[])[]) =>
  [line(header), ...rows.map(line)].join('\r\n') + '\r\n'

/** Heure locale ISO 8601 avec son décalage (`2026-10-24T09:15:02+02:00`). */
export function localIso(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  )
}

const seconds = (row: TurnRow) =>
  row.endedAt !== undefined && row.endedAt >= row.startedAt
    ? Math.round((row.endedAt - row.startedAt) / 100) / 10
    : undefined

/** Une ligne par tour, dans l'ordre du journal. */
export function turnsCsv(rows: readonly TurnRow[]): string {
  return csv(
    [
      'id',
      'conversation_id',
      'parent_id',
      'started_at',
      'ended_at',
      'duration_s',
      'agent_id',
      'agent',
      'model_id',
      'model',
      'mode',
      'project',
      'workspace',
      'stop_reason',
      'input_tokens',
      'output_tokens',
      'cached_read_tokens',
      'cached_write_tokens',
      'thought_tokens',
      'total_tokens',
      'cost',
      'cost_unit',
      'tool_calls',
      'subagents'
    ],
    rows.map((r) => [
      r.id,
      r.conversationId,
      r.parentId,
      localIso(r.startedAt),
      r.endedAt === undefined ? undefined : localIso(r.endedAt),
      seconds(r),
      r.profileId,
      r.profileLabel,
      r.model?.id,
      r.model?.name,
      r.mode?.name,
      r.repoRoot ?? r.workspace,
      r.workspace,
      r.stopReason,
      r.tokens.input,
      r.tokens.output,
      r.tokens.cachedRead,
      r.tokens.cachedWrite,
      r.tokens.thought,
      r.tokens.total,
      r.cost?.amount,
      r.cost?.currency,
      Object.values(r.tools).reduce((a, b) => a + b, 0),
      r.subagents
    ])
  )
}

/**
 * Une ligne par jour de la période (jours vides compris) : échanges, conversations, durée,
 * jetons, et une colonne de coût par unité (`cost_USD`, `cost_bobcoins`), jamais additionnées.
 */
export function daysCsv(
  days: readonly string[],
  rows: readonly TurnRow[],
  dayOf: (ms: number) => string
): string {
  const units = [...new Set(rows.flatMap((r) => (r.cost ? [r.cost.currency] : [])))].sort()
  const byDay = new Map<string, TurnRow[]>()
  for (const row of rows) {
    const day = dayOf(row.startedAt)
    byDay.set(day, [...(byDay.get(day) ?? []), row])
  }
  const sum = (list: readonly TurnRow[], value: (r: TurnRow) => number | undefined) =>
    list.reduce((n, r) => n + (value(r) ?? 0), 0)
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6
  return csv(
    [
      'day',
      'turns',
      'conversations',
      'duration_s',
      'input_tokens',
      'output_tokens',
      ...units.map((u) => `cost_${u}`)
    ],
    days.map((day) => {
      const list = byDay.get(day) ?? []
      return [
        day,
        list.length,
        new Set(list.map((r) => r.conversationId)).size,
        Math.round(sum(list, seconds) * 10) / 10,
        sum(list, (r) => r.tokens.input),
        sum(list, (r) => r.tokens.output),
        ...units.map((u) => round6(sum(list, (r) => (r.cost?.currency === u ? r.cost.amount : 0))))
      ]
    })
  )
}
