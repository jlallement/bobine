/**
 * Ce que fait l'agent pendant un tour, pour l'indicateur d'activité à la fin du fil : réfléchit,
 * écrit, utilise un outil, attend une autorisation ou une réponse. Déduit du fil seul.
 */
import type { TranscriptItem } from './transcript'
import { appToolText } from './app-tools'
import { toolText } from './tool-label'
import { t } from 'i18next'

export type Activity =
  | { kind: 'thinking' }
  | { kind: 'writing' }
  | { kind: 'tool'; title: string }
  | { kind: 'permission' }
  | { kind: 'question' }
  /** Tour fini, l'agent travaille encore (fiche 255). */
  | { kind: 'background' }

/**
 * L'étape en cours du tour (fiche 128) : le dernier élément d'activité (texte, réflexion, outil),
 * `-1` tant qu'il n'y en a pas. Un texte qui s'allonge reste la même étape ; un nouvel élément en
 * ouvre une autre, et le temps affiché repart de zéro.
 */
export function currentStepId(items: readonly TranscriptItem[]): number {
  const start = items.findLastIndex((i) => i.kind === 'user')
  const last = items
    .slice(start + 1)
    .findLast((i) => i.kind === 'agent' || i.kind === 'thought' || i.kind === 'tool')
  return last?.id ?? -1
}

/**
 * `workspace` : dossier de la conversation, pour des chemins relatifs (fiche 107) ; `rootName` : le
 * nom à lui donner (« Documents » d'une discussion, fiche 224).
 */
export function currentActivity(
  items: readonly TranscriptItem[],
  workspace?: string,
  rootName?: string
): Activity {
  const start = items.findLastIndex((i) => i.kind === 'user')
  const turn = items.slice(start + 1)
  // Ce qui attend l'utilisateur passe avant tout.
  if (turn.some((i) => i.kind === 'tool' && i.permission?.state === 'pending')) {
    return { kind: 'permission' }
  }
  if (turn.some((i) => i.kind === 'elicitation' && i.state === 'pending')) {
    return { kind: 'question' }
  }
  const last = turn.findLast((i) => i.kind === 'agent' || i.kind === 'thought' || i.kind === 'tool')
  if (last?.kind === 'tool' && (last.status === 'pending' || last.status === 'in_progress')) {
    // Le même libellé que la carte : « Sous-agent : … », outil de l'app en clair (fiche 047),
    // outil de l'agent d'après sa cible (fiche 107).
    const title = last.subagent
      ? t('activity.subagent', { task: last.subagent.task })
      : last.appTool
        ? appToolText(last.appTool)
        : toolText(last, workspace, rootName)
    return { kind: 'tool', title }
  }
  if (last?.kind === 'agent') return { kind: 'writing' }
  return { kind: 'thinking' }
}

/**
 * Après la fin du tour, l'agent travaille encore (fiche 255) : ce qui attend l'utilisateur d'abord,
 * puis le sous-agent en arrière-plan en cours (le dernier lancé), sinon « travaille après le tour »
 * (la réponse qu'il donne de lui-même au rapport d'un sous-agent).
 */
export function backgroundActivity(items: readonly TranscriptItem[]): Activity {
  const activity = currentActivity(items)
  if (activity.kind === 'permission' || activity.kind === 'question') return activity
  const running = items.findLast(
    (i) =>
      i.kind === 'tool' &&
      !!i.subagent &&
      !!i.subagentRun?.background &&
      i.subagentRun.endedAt === undefined &&
      !i.subagentRun.lost
  )
  return running?.kind === 'tool' && running.subagent
    ? { kind: 'tool', title: t('activity.subagent', { task: running.subagent.task }) }
    : { kind: 'background' }
}

export function activityLabel(activity: Activity): string {
  switch (activity.kind) {
    case 'thinking':
      return t('activity.thinking')
    case 'writing':
      return t('activity.writing')
    case 'tool':
      // « …sentence. » + « … » : pas de ponctuation en double.
      return `${activity.title.replace(/[\s.…]+$/, '')}…`
    case 'permission':
      return t('activity.permission')
    case 'question':
      return t('activity.question')
    case 'background':
      return t('activity.background')
  }
}

/** Durée écoulée, courte : « 8 s », « 1 min 05 ». */
export function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
}
