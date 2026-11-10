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

/** `workspace` : dossier de la conversation, pour des chemins relatifs (fiche 107). */
export function currentActivity(items: readonly TranscriptItem[], workspace?: string): Activity {
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
        : toolText(last, workspace)
    return { kind: 'tool', title }
  }
  if (last?.kind === 'agent') return { kind: 'writing' }
  return { kind: 'thinking' }
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
  }
}

/** Durée écoulée, courte : « 8 s », « 1 min 05 ». */
export function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
}
