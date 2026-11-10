/**
 * Astuces de Bobine (fiche 191) : une astuce n'apparaît que dans son contexte, une à la fois, au
 * plus une par jour (toutes confondues). × la ferme pour aujourd'hui ; « Ne plus montrer » ou
 * la fonction utilisée la masquent pour toujours. Rien de propre à un agent (ADR-0011).
 * L'état est gardé par le main dans `settings.json` (`tipsState`).
 */

export const TIP_IDS = ['aside', 'context', 'review', 'scheduled'] as const
export type TipId = (typeof TIP_IDS)[number]

export const isTipId = (value: unknown): value is TipId =>
  typeof value === 'string' && (TIP_IDS as readonly string[]).includes(value)

export interface TipsState {
  /** Astuces masquées pour toujours : « Ne plus montrer », ou fonction déjà utilisée. */
  hidden: TipId[]
  /** Jour local (`AAAA-MM-JJ`) de la dernière astuce montrée. */
  lastShownDay?: string
  /** Premier jour où Bobine a servi les astuces : aucune ce jour-là (l'accueil suffit). */
  firstDay?: string
  /** Clé du HMAC des empreintes, tirée au hasard pour cette installation ; reste au main. */
  salt?: string
  /**
   * Messages envoyés, pour « même message trois jours différents » : une empreinte (jamais le
   * texte) du dossier et du message, et les jours où il a été envoyé.
   */
  sent?: SentMessage[]
}

export interface SentMessage {
  key: string
  days: string[]
}

export const EMPTY_TIPS: TipsState = { hidden: [] }

/** Ce que l'interface reçoit : l'état, et le temps de calme d'une conversation neuve. */
export interface TipsView extends Omit<TipsState, 'sent' | 'salt'> {
  quietMs: number
  /** Règle « aucune astuce le jour du premier lancement » en vigueur (levée pour les essais). */
  firstDayRule: boolean
}

/** Pas d'astuce aujourd'hui : c'est le jour du premier lancement (relu à chaque fois). */
export const firstDayToday = (view: TipsView, today: string): boolean =>
  view.firstDayRule && view.firstDay === today

/** État sans empreintes de messages (astuces coupées, « Planifier… » masquée). */
export function withoutSent(state: TipsState): TipsState {
  const { sent: _sent, ...rest } = state
  return rest
}

/** Ce qui arrive à une astuce. */
export type TipAction = 'shown' | 'never' | 'used'
export const TIP_ACTIONS: readonly TipAction[] = ['shown', 'never', 'used']

/** Pas d'astuce pendant les deux premières minutes d'une conversation. */
export const TIP_QUIET_MS = 2 * 60_000
/** Aparté : texte tapé (non vide) depuis 2 s pendant que l'agent travaille. */
export const ASIDE_TIP_DELAY_MS = 2_000
/** Contexte : au-delà de 85 % de la fenêtre. */
export const CONTEXT_TIP_RATIO = 0.85
/** Gros changement : plus de 20 fichiers ou 500 lignes. */
export const REVIEW_TIP_FILES = 20
export const REVIEW_TIP_LINES = 500

/** Même message (presque identique), même dossier, ce nombre de jours différents. */
export const REPEAT_TIP_DAYS = 3
/** Message trop court pour une tâche planifiée (« ok », « continue »…). */
export const REPEAT_MIN_LENGTH = 12
/** Empreintes gardées au plus (les plus anciennes s'en vont). */
export const MAX_SENT = 200

/**
 * Texte comparable d'un message : minuscules, ponctuation et espaces réduits ; `undefined` pour
 * une commande `/` ou un message trop court.
 */
export function normalizeMessage(text: string): string | undefined {
  if (text.trim().startsWith('/')) return undefined
  const flat = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return flat.length >= REPEAT_MIN_LENGTH ? flat : undefined
}

/**
 * Un message envoyé aujourd'hui (son empreinte `key`) : `repeated` quand c'est le troisième jour
 * différent, la première fois ce jour-là.
 */
export function noteSentMessage(
  state: TipsState,
  key: string,
  today: string
): { state: TipsState; repeated: boolean } {
  const sent = state.sent ?? []
  const known = sent.find((m) => m.key === key)
  if (known?.days.includes(today)) return { state, repeated: false }
  const days = [...(known?.days ?? []), today].slice(-REPEAT_TIP_DAYS)
  const others = sent.filter((m) => m.key !== key)
  return {
    state: { ...state, sent: [...others, { key, days }].slice(-MAX_SENT) },
    repeated: days.length >= REPEAT_TIP_DAYS
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function parseSent(raw: unknown): SentMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m): m is SentMessage =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as SentMessage).key === 'string' &&
        /^[0-9a-f]{16,64}$/.test((m as SentMessage).key) &&
        Array.isArray((m as SentMessage).days)
    )
    .map((m) => ({
      key: m.key,
      days: [...new Set(m.days.filter((d) => typeof d === 'string' && DAY.test(d)))].slice(
        -REPEAT_TIP_DAYS
      )
    }))
    .filter((m) => m.days.length > 0)
    .slice(-MAX_SENT)
}

/** Jour local `AAAA-MM-JJ`. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** État valide venu du disque ; le reste est ignoré. */
export function parseTipsState(raw: unknown): TipsState {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const hidden = Array.isArray(obj['hidden']) ? [...new Set(obj['hidden'].filter(isTipId))] : []
  const day = obj['lastShownDay']
  const first = obj['firstDay']
  const salt = obj['salt']
  const sent = parseSent(obj['sent'])
  return {
    ...(typeof salt === 'string' && /^[0-9a-f]{64}$/.test(salt) ? { salt } : {}),
    hidden,
    ...(typeof day === 'string' && DAY.test(day) ? { lastShownDay: day } : {}),
    ...(typeof first === 'string' && DAY.test(first) ? { firstDay: first } : {}),
    ...(sent.length ? { sent } : {})
  }
}

/** Une astuce peut-elle paraître aujourd'hui ? */
export const mayShowTip = (state: TipsState, id: TipId, today: string): boolean =>
  !state.hidden.includes(id) && state.lastShownDay !== today

export function applyTipAction(
  state: TipsState,
  id: TipId,
  action: TipAction,
  today: string
): TipsState {
  if (action === 'shown') return { ...state, lastShownDay: today }
  return state.hidden.includes(id) ? state : { ...state, hidden: [...state.hidden, id] }
}
