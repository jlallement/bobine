/**
 * Avis du fil (élément `notice`) : leur forme, leur texte, et ceux des outils de l'app apparus en
 * cours de conversation (fiche 241) — un projet Xcode ou Android créé dans le dossier. Un seul avis
 * « à redémarrer » par famille : redonné à chaque fin de tour (l'ancien est retiré, le nouveau reste
 * sous la dernière réponse), puis remplacé par une ligne discrète quand l'agent a les outils.
 */
import type { ParseKeys } from 'i18next'
import type { AgentEvent, AgentSnapshot, AppToolsState, NoticeLevel } from './agent'
import { isMessage, translate, type Message } from './i18n/message'
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
  /**
   * Avis d'un message refusé (connexion, modèle — fiches 210, 259) : vrai jusqu'à la réponse
   * suivante de l'agent. Retiré par elle (`withoutRefusal`), ou remplacé par l'avis d'un nouveau
   * refus.
   */
  refusal?: true
  /**
   * Avis de l'interface elle-même (un appel refusé, un fichier introuvable au clic — recette de la
   * rc.3) : il ne dit rien du tour, qui garde son pied (`endedBadly`), et le même avis redonné
   * dans le tour remplace le précédent au lieu de s'empiler. Jamais écrit sur disque : seul le
   * renderer en crée, dans son propre état du fil ; le main, qui enregistre et exporte les fils,
   * ne le reçoit pas (rechargé, le fil ne l'a plus).
   */
  local?: true
}

/**
 * Le fil sans l'avis d'un refus précédent (fiche 259, D6) : l'agent a répondu autrement (tour fini,
 * autre erreur, autre refus), ce que disait l'avis n'est plus établi. Même état si rien à retirer.
 */
export function withoutRefusal(state: TranscriptState): TranscriptState {
  if (!state.items.some(isRefusal)) return state
  return { ...state, items: state.items.filter((item) => !isRefusal(item)) }
}

const isRefusal = (item: TranscriptItem): boolean => item.kind === 'notice' && item.refusal === true

/**
 * Le fil sans l'avis local le plus récent du tour en cours identique à `event` (niveau, titre,
 * texte) ; même état s'il n'y en a pas. Les tours d'avant gardent les leurs.
 */
function withoutLastSameLocal(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: 'notice' }>
): TranscriptState {
  if (typeof event.message !== 'string') return state
  const turnStart = state.items.findLastIndex((item) => item.kind === 'user') + 1
  const same = state.items.findLastIndex(
    (item, index) =>
      index >= turnStart &&
      item.kind === 'notice' &&
      item.local === true &&
      item.level === event.level &&
      item.title === event.title &&
      item.text === event.message
  )
  if (same < 0) return state
  return { ...state, items: state.items.filter((_, index) => index !== same) }
}

/**
 * Avis venu de l'agent ou de l'app (`notice`). Un avis de refus remplace le précédent (fiche 259) ;
 * un avis de l'interface redonné à l'identique dans le même tour (deux clics sur un fichier
 * introuvable — recette de la rc.3) remplace le sien : un seul, en bas.
 */
export function reduceNotice(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: 'notice' }>
): TranscriptState {
  const { message } = event
  const kept = event.refusal
    ? withoutRefusal(state)
    : event.local
      ? withoutLastSameLocal(state, event)
      : state
  const item: TranscriptItem = {
    kind: 'notice',
    id: kept.nextId,
    level: event.level,
    ...(isMessage(message) ? { message } : { text: message }),
    ...(event.title ? { title: event.title } : {}),
    ...(event.link ? { link: event.link } : {}),
    ...(event.refusal ? { refusal: true as const } : {}),
    ...(event.local ? { local: true as const } : {})
  }
  return { ...kept, items: [...kept.items, item], nextId: kept.nextId + 1 }
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

/**
 * Le fil sans l'avis d'un message refusé tant que la carte de refus est à l'écran (revue UX de la
 * fiche 267) : la carte « Le modèle … n'a pas répondu » le dit déjà ; l'avis reste dans le fil une
 * fois la carte partie, jusqu'à la réponse suivante.
 */
export function withoutCardedRefusal<T extends TranscriptItem>(
  items: T[],
  snapshot: Pick<AgentSnapshot, 'status' | 'blocker'> | null | undefined
): T[] {
  const carded =
    snapshot?.status === 'needs-action' &&
    snapshot.blocker?.kind === 'auth' &&
    snapshot.blocker.atTurn === true
  return carded ? items.filter((item) => !isRefusal(item)) : items
}
