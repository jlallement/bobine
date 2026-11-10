/**
 * Astuces de Bobine (fiche 191), côté interface : une seule à la fois, offerte par l'écran qui
 * voit son contexte (`offer`), et refusée si les règles de `@shared/tips` ou le moment
 * (`quiet` : une demande d'autorisation, une conversation de moins de deux minutes) ne le
 * permettent pas. L'état durable (masquées, jour de la dernière) est au main.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ConversationSummary } from '@shared/agent'
import {
  firstDayToday,
  localDay,
  mayShowTip,
  REVIEW_TIP_FILES,
  REVIEW_TIP_LINES,
  TIP_QUIET_MS,
  type TipId,
  type TipsView
} from '@shared/tips'

export interface Tips {
  /** Astuce affichée, s'il y en a une. */
  current: TipId | null
  /** Le contexte d'une astuce est là : elle paraît si les règles le permettent. */
  offer: (id: TipId) => void
  /** × : fermée (le quota du jour est pris : elle ne revient pas aujourd'hui). */
  close: () => void
  /** « Ne plus montrer ». */
  never: (id: TipId) => void
  /** La fonction a servi : son astuce ne paraîtra plus jamais. */
  used: (id: TipId) => void
  /** Ouvre « Faire relire… » si la conversation ouverte a un gros changement pas encore relu. */
  review?: () => void
  /** « Planifier… » de l'astuce du message répété : ouvre la page des tâches, préremplie. */
  planRepeated?: () => void
  /** Tâche à préremplir à l'ouverture de la page des tâches planifiées, puis oubliée. */
  plan?: { instruction: string; folder: string }
  clearPlan?: () => void
  /** « Annuler » de la tâche préremplie : retour à la conversation. */
  leavePlan?: () => void
  /** Message tapé envoyé dans ce dossier : au troisième jour, l'astuce « Planifier… ». */
  noteSent?: (folder: string | undefined, text: string) => void
}

export const TipsContext = createContext<Tips | null>(null)

/** Astuces de la fenêtre ; `null` hors du fournisseur (essais de composants). */
export const useTipsContext = (): Tips | null => useContext(TipsContext)

/** Conversation trop récente pour une astuce (deux minutes après sa création). */
export function tooRecent(
  createdAt: string | undefined,
  now: number,
  quietMs: number = TIP_QUIET_MS
): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) && now - created < quietMs
}

export function useTips({
  enabled,
  quiet,
  conversationId,
  createdAt
}: {
  /** Réglage « Astuces de Bobine ». */
  enabled: boolean
  /** Pas maintenant : une demande d'autorisation attend. */
  quiet: boolean
  conversationId: string | null
  /** Création de la conversation ouverte : rien pendant ses deux premières minutes. */
  createdAt: string | undefined
}): Tips {
  const [state, setState] = useState<TipsView | null>(null)
  /** Astuce montrée, et la conversation où elle l'a été. */
  const [shown, setShown] = useState<{ id: TipId; conversationId: string | null } | null>(null)
  // Une autre conversation, une demande d'autorisation, le réglage coupé : l'astuce s'efface.
  const current =
    shown && shown.conversationId === conversationId && enabled && !quiet ? shown.id : null

  // Ce que `offer` lit au moment de l'appel : elle reste stable pour les effets des écrans.
  const live = useRef({ state, current, allowed: false, createdAt, conversationId })
  useEffect(() => {
    live.current = { state, current, allowed: enabled && !quiet, createdAt, conversationId }
  })

  useEffect(() => {
    void window.api.tips
      .state()
      .then(setState)
      .catch(() => undefined)
    // « Tout réafficher », « Ne plus montrer » ailleurs : l'état suit sans relancer l'app.
    return window.api.tips.onChanged?.(setState)
  }, [])

  const record = useCallback((id: TipId, action: 'shown' | 'never' | 'used') => {
    void window.api.tips
      .record(id, action)
      .then(setState)
      .catch(() => undefined)
  }, [])

  const offer = useCallback(
    (id: TipId) => {
      const now = live.current
      const known = now.state
      if (!now.allowed || !known || now.current) return
      if (firstDayToday(known, localDay(new Date()))) return
      // Le message répété arrive souvent dans une conversation toute neuve : il passe outre.
      if (id !== 'scheduled' && tooRecent(now.createdAt, Date.now(), known.quietMs)) return
      const today = localDay(new Date())
      if (!mayShowTip(known, id, today)) return
      // Le quota du jour est pris tout de suite : pas une seconde astuce avant la réponse du main.
      live.current = { ...now, current: id, state: { ...known, lastShownDay: today } }
      setShown({ id, conversationId: now.conversationId })
      record(id, 'shown')
    },
    [record]
  )

  const close = useCallback(() => setShown(null), [])
  const never = useCallback(
    (id: TipId) => {
      setShown((s) => (s?.id === id ? null : s))
      record(id, 'never')
    },
    [record]
  )
  const used = useCallback(
    (id: TipId) => {
      setShown((s) => (s?.id === id ? null : s))
      if (!live.current.state?.hidden.includes(id)) record(id, 'used')
    },
    [record]
  )

  return { current, offer, close, never, used }
}

/**
 * « Faire relire » d'un gros changement (fiche 191) : plus de 20 fichiers ou 500 lignes modifiés
 * dans la conversation, et aucune relecture déjà lancée sur elle ; sinon `undefined`.
 */
export function reviewTipFor(
  active: ConversationSummary | null | undefined,
  list: readonly ConversationSummary[],
  changes: { files: number; added: number; removed: number },
  open: () => void
): (() => void) | undefined {
  if (!active || active.draft || active.reviewOf) return undefined
  const big = changes.files > REVIEW_TIP_FILES || changes.added + changes.removed > REVIEW_TIP_LINES
  if (!big || list.some((s) => s.reviewOf?.id === active.id)) return undefined
  return open
}

/** Astuces de la fenêtre principale (sorties d'`App.tsx`) : réglage, moment, conversation. */
export function useAppTips(
  c: {
    settings: { preferences: { tipsEnabled: boolean } } | null
    activeId: string | null
    activeSummary: ConversationSummary | null
    attention: Record<string, string | undefined>
    list: readonly ConversationSummary[]
    active?: { snapshot: { status: string } | null } | null
  },
  changes: { files: number; added: number; removed: number },
  actions: {
    startAside: (question?: string) => void
    openReview: () => void
    showScheduled: () => void
    closePage: () => void
  }
): { tips: Tips; startAside: (question?: string) => void } {
  const enabled = c.settings?.preferences.tipsEnabled ?? false
  const base = useTips({
    enabled,
    // Jamais pendant une demande de l'agent (autorisation, question).
    quiet: !!c.activeId && c.attention[c.activeId] === 'request',
    conversationId: c.activeId,
    createdAt: c.activeSummary?.createdAt
  })
  const [repeated, setRepeated] = useState<{ instruction: string; folder: string } | null>(null)
  // Message répété : marqué « en attente » dès l'envoi ; l'astuce paraît quand le tour est fini
  // (l'agent ne répond plus) ET que le main a confirmé le troisième jour, dans n'importe quel ordre.
  const pending = useRef<{
    conversationId: string | null
    busySeen: boolean
    ended: boolean
    repeated: boolean | null
  } | null>(null)
  const busy = c.active?.snapshot?.status === 'busy'
  const [plan, setPlan] = useState<{ instruction: string; folder: string } | null>(null)
  const { offer, used } = base
  const clearPlan = useCallback(() => setPlan(null), [])
  const review = reviewTipFor(c.activeSummary, c.list, changes, actions.openReview)
  const settle = useCallback(() => {
    const waiting = pending.current
    if (!waiting || waiting.repeated === null || !waiting.ended) return
    pending.current = null
    if (waiting.repeated) offer('scheduled')
  }, [offer])
  const noteSent = (folder: string | undefined, text: string) => {
    if (!enabled || !folder) return
    const waiting = {
      conversationId: c.activeId,
      // Envoyé pendant que l'agent travaille (file d'attente) : le tour en cours compte.
      busySeen: busy,
      ended: false,
      repeated: null as boolean | null
    }
    pending.current = waiting
    void window.api.tips
      .noteMessage(folder, text)
      .then((again) => {
        if (again) setRepeated({ instruction: text.trim(), folder })
        if (pending.current !== waiting) return
        waiting.repeated = again
        settle()
      })
      .catch(() => {
        if (pending.current === waiting) pending.current = null
      })
  }
  useEffect(() => {
    const waiting = pending.current
    if (!waiting) return
    // Autre conversation : l'occasion est passée.
    if (waiting.conversationId !== c.activeId) pending.current = null
    else if (busy) waiting.busySeen = true
    else if (waiting.busySeen) {
      waiting.ended = true
      settle()
    }
  }, [busy, c.activeId, settle])
  const tips: Tips = {
    ...base,
    ...(review ? { review } : {}),
    ...(repeated && base.current === 'scheduled'
      ? {
          planRepeated: () => {
            setPlan(repeated)
            used('scheduled')
            actions.showScheduled()
          }
        }
      : {}),
    ...(plan ? { plan } : {}),
    clearPlan,
    leavePlan: actions.closePage,
    noteSent
  }
  return {
    tips,
    startAside: (question) => {
      used('aside')
      actions.startAside(question)
    }
  }
}
