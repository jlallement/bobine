/**
 * « En cours » de l'onglet « Session » (fiche 166) : ce qui tourne pour une conversation
 * (commandes des terminaux du panneau, serveurs de dev, sous-agents en arrière-plan, conversations filles au
 * travail), et ce qui a fini depuis le lancement de l'app. Logique pure : `useSessionRunning`
 * fournit les observations, ce module garde le suivi.
 */
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import { childState } from '@shared/children'
import type { DevServerView } from '@shared/launch'
import type { TerminalTabInfo } from '@shared/terminal'
import type { TranscriptItem } from '@shared/transcript'

export type RunningKind = 'terminal' | 'server' | 'subagent' | 'child'

/** Comment Bobine arrête une entrée ; absent : elle ne sait pas (sous-agent, fiche 166). */
export type RunningStop =
  | { kind: 'terminal'; tabId: string }
  | { kind: 'server'; name: string }
  | { kind: 'child'; childId: string }

export interface RunningEntry {
  /** Unique dans la conversation : `<kind>:<identifiant>`. */
  key: string
  kind: RunningKind
  label: string
  /** Début (ms) : donné par la source, sinon la première fois que l'app l'a vu. */
  startedAt: number
  /** Fin (ms) : présente pour ce qui a fini. */
  endedAt?: number
  stop?: RunningStop
  /** Conversation fille, à ouvrir d'un clic. */
  childId?: string
}

/** Ce que les sources disent maintenant ; `ended` : fini, à l'heure `endedAt` si connue. */
export interface RunningObservation extends Omit<RunningEntry, 'startedAt' | 'endedAt'> {
  startedAt?: number
  ended?: boolean
  endedAt?: number
}

export interface RunningState {
  running: RunningEntry[]
  finished: RunningEntry[]
}

export const EMPTY_RUNNING: RunningState = { running: [], finished: [] }

/**
 * Suivi : ce qui était en cours et n'est plus observé a fini maintenant ; ce qui a fini avant le
 * lancement de l'app (`since`) n'est pas compté. Une commande d'un terminal qui finit disparaît
 * sans aller dans « Terminées » : son résultat reste dans le terminal, et chaque `ls` y ferait
 * sinon une ligne.
 */
export function trackRunning(
  previous: RunningState,
  observed: readonly RunningObservation[],
  now: number,
  since: number
): RunningState {
  const known = new Map(
    [...previous.running, ...previous.finished].map((entry) => [entry.key, entry])
  )
  const seen = new Set(observed.map((o) => o.key))
  const running: RunningEntry[] = []
  const finished = new Map<string, RunningEntry>()
  for (const entry of previous.finished) finished.set(entry.key, entry)
  for (const { ended, ...obs } of observed) {
    const before = known.get(obs.key)
    const startedAt = obs.startedAt ?? before?.startedAt ?? now
    if (!ended) {
      finished.delete(obs.key)
      const { endedAt: _endedAt, ...rest } = obs
      running.push({ ...rest, startedAt })
      continue
    }
    const endedAt = obs.endedAt ?? before?.endedAt ?? now
    const wasRunning = previous.running.some((entry) => entry.key === obs.key)
    if (!wasRunning && !finished.has(obs.key) && endedAt < since) continue
    const { stop: _stop, ...rest } = obs
    finished.set(obs.key, { ...rest, startedAt, endedAt })
  }
  for (const entry of previous.running) {
    if (seen.has(entry.key) || entry.kind === 'terminal') continue
    const { stop: _stop, ...rest } = entry
    finished.set(entry.key, { ...rest, endedAt: now })
  }
  return { running, finished: [...finished.values()] }
}

export const sameRunning = (a: RunningState, b: RunningState): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * Terminaux du panneau (fiche 034) : seulement pendant qu'une commande y tourne (pas un shell à
 * l'invite), sous son nom, depuis son début. Une par commande : la suivante est une autre ligne.
 */
export function terminalObservations(tabs: readonly TerminalTabInfo[]): RunningObservation[] {
  return tabs.flatMap((tab): RunningObservation[] => {
    const command = tab.exitCode === undefined ? tab.command : undefined
    if (!command) return []
    return [
      {
        key: `terminal:${tab.id}:${command.startedAt}`,
        kind: 'terminal',
        label: command.name,
        startedAt: command.startedAt,
        stop: { kind: 'terminal', tabId: tab.id }
      }
    ]
  })
}

/** Serveurs de dev du dossier (fiche 030). */
export function serverObservations(servers: readonly DevServerView[]): RunningObservation[] {
  return servers.map((server) => {
    const alive =
      server.status === 'starting' || server.status === 'running' || server.status === 'attached'
    return {
      key: `server:${server.name}`,
      kind: 'server',
      label: server.name,
      ...(server.startedAt !== undefined ? { startedAt: server.startedAt } : {}),
      ...(alive
        ? { stop: { kind: 'server' as const, name: server.name } }
        : { ended: true, ...(server.endedAt !== undefined ? { endedAt: server.endedAt } : {}) })
    }
  })
}

/** Sous-agents lancés en arrière-plan (fiche 122) : ACP n'en arrête pas un seul, pas d'arrêt. */
export function subagentObservations(items: readonly TranscriptItem[]): RunningObservation[] {
  return items.flatMap((item): RunningObservation[] => {
    const run = item.kind === 'tool' ? item.subagentRun : undefined
    if (item.kind !== 'tool' || !run?.background) return []
    const ended = run.endedAt !== undefined || !!run.lost
    return [
      {
        key: `subagent:${item.toolCallId}`,
        kind: 'subagent',
        label: item.subagent?.task || item.title,
        ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
        ...(ended
          ? { ended: true, ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}) }
          : {})
      }
    ]
  })
}

/**
 * Filles qui travaillent (ou attendent une réponse) ; « Arrêter » interrompt leur tour. Une fille
 * qui ne travaille plus n'est pas observée : le suivi la range dans « Terminées ».
 */
export function childObservations(
  children: readonly Pick<ConversationSummary, 'id' | 'title' | 'status'>[],
  attention: AttentionState
): RunningObservation[] {
  return children.flatMap((child): RunningObservation[] => {
    const state = childState(child, attention[child.id])
    if (state !== 'running' && state !== 'waiting') return []
    return [
      {
        key: `child:${child.id}`,
        kind: 'child',
        label: child.title,
        childId: child.id,
        stop: { kind: 'child', childId: child.id }
      }
    ]
  })
}
