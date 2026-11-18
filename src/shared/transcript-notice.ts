/**
 * Avis du fil (élément `notice`) : leur forme, leur texte, et ceux des outils de l'app apparus en
 * cours de conversation (fiche 241) — un projet Xcode ou Android créé dans le dossier. Un seul avis
 * « à redémarrer » par famille : redonné à chaque fin de tour (l'ancien est retiré, le nouveau reste
 * sous la dernière réponse), puis remplacé par une ligne discrète quand l'agent a les outils.
 */
import type { ParseKeys } from 'i18next'
import type { AgentEvent, AppToolsState, NoticeLevel } from './agent'
import { translate, type Message } from './i18n/message'
import type { TranscriptItem, TranscriptState } from './transcript'

/** Action proposée par un avis : redémarrer l'agent (comme dans le menu ⚙). */
export type NoticeAction = 'restart-agent'

export interface TranscriptNotice {
  kind: 'notice'
  id: number
  level: NoticeLevel
  /** Ce que dit l'app, en code (ADR-0014) : traduit à l'affichage, voir `noticeText`. */
  message?: Message
  /** Texte tel quel : avis d'avant la fiche 074, ou texte venu de l'agent. */
  text?: string
  /** Titre de l'encadré (sortie de `/context`, `/cost`, fiche 126). */
  title?: string
  /** Lien à la suite du texte (fiche 198). */
  link?: Extract<AgentEvent, { type: 'notice' }>['link']
  /** Famille d'outils de l'app apparue en cours de conversation (fiche 241). */
  appTools?: string
  /** Bouton de l'avis : redémarrer l'agent (fiche 241). */
  action?: NoticeAction
}

/** Texte d'un avis du fil, dans la langue courante. */
export const noticeText = (notice: { message?: Message; text?: string }): string =>
  notice.message ? translate(notice.message) : (notice.text ?? '')

const KEYS: Record<string, Record<AppToolsState, ParseKeys>> = {
  'ios-simulator': {
    pending: 'transcript.notice.appTools.iosPending',
    live: 'transcript.notice.appTools.iosLive',
    session: 'transcript.notice.appTools.iosSession'
  },
  'android-emulator': {
    pending: 'transcript.notice.appTools.androidPending',
    live: 'transcript.notice.appTools.androidLive',
    session: 'transcript.notice.appTools.androidSession'
  }
}

/** Autre famille qui suivrait le dossier : textes généraux. */
const OTHER: Record<AppToolsState, ParseKeys> = {
  pending: 'transcript.notice.appTools.otherPending',
  live: 'transcript.notice.appTools.otherLive',
  session: 'transcript.notice.appTools.otherSession'
}

const isPending = (family: string) => (item: TranscriptItem) =>
  item.kind === 'notice' && item.appTools === family && item.action === 'restart-agent'

export function reduceAppTools(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: 'app-tools' }>
): TranscriptState {
  const pending = isPending(event.family)
  const had = state.items.some(pending)
  // Session ouverte sans avis en attente : rien à dire (le cas de toute conversation).
  if (event.state === 'session' && !had) return state
  const item: TranscriptItem = {
    kind: 'notice',
    id: state.nextId,
    level: event.state === 'pending' ? 'warning' : 'info',
    message: { key: (KEYS[event.family] ?? OTHER)[event.state] },
    appTools: event.family,
    ...(event.state === 'pending' ? { action: 'restart-agent' as const } : {})
  }
  return {
    ...state,
    items: [...state.items.filter((i) => !pending(i)), item],
    nextId: state.nextId + 1
  }
}
