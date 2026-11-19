import { ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import type { TranscriptItem } from '@shared/transcript'
import { RoleAvatar } from '../roles/RoleAvatar'
import {
  cueSummary,
  dropKey,
  dropSeen,
  EMPTY_CUE,
  isOnScreen,
  noteTargets,
  settle,
  SETTLE_MS,
  targetsSignature,
  type CueMemory,
  type CueTarget
} from './work-cue'
import { delegatedWorkTargets } from './work-cue-targets'

/** Durée de l'anneau autour de la carte montrée (revue UX de la fiche 261). */
export const FLASH_MS = 1400
/** Images attendues au plus pour qu'une carte d'un long fil soit rendue (fiche 193). */
const REVEAL_FRAMES = 30

/** Carte d'un travail dans le fil (`data-work-anchor`, posé par les cartes elles-mêmes). */
function anchorOf(scroller: HTMLElement | null, itemId: number): HTMLElement | null {
  return scroller?.querySelector<HTMLElement>(`[data-work-anchor="${itemId}"]`) ?? null
}

/** Une cible est vue quand sa carte est à l'écran, dans l'élément qui défile. */
const seenIn = (scroller: HTMLElement | null) => (target: CueTarget) =>
  isOnScreen(anchorOf(scroller, target.itemId), scroller)

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Repère en bas du fil (fiche 261, écran E) : « ↑ Expert UX/UI a répondu · Voir », ou « ↑ 2 travaux
 * ont répondu · Voir » (mène au plus ancien). Une ligne fine au-dessus de la saisie, qui disparaît
 * quand la carte a été vue (défilement ou « Voir »). Générique : les cibles viennent d'un
 * adaptateur ; à recréer à chaque conversation (`key`). La région annoncée aux lecteurs d'écran
 * est toujours là, vide sans repère.
 */
export function WorkCue({
  targets,
  scroller,
  onReveal
}: {
  targets: readonly CueTarget[]
  /** Élément qui fait défiler le fil. */
  scroller: { readonly current: HTMLElement | null }
  /** Rendre un élément d'un long fil pas encore rendu (fiche 193). */
  onReveal: (itemId: number) => void
}) {
  const memory = useRef<CueMemory>(EMPTY_CUE)
  const latest = useRef(targets)
  useLayoutEffect(() => {
    latest.current = targets
  })
  // Ce que le rendu montre : les deux files, recopiées quand elles changent.
  const [view, setView] = useState<Pick<CueMemory, 'pending' | 'settling'>>(EMPTY_CUE)
  const remember = useCallback((next: CueMemory) => {
    memory.current = next
    setView((shown) =>
      shown.pending === next.pending && shown.settling === next.settling
        ? shown
        : { pending: next.pending, settling: next.settling }
    )
  }, [])
  // Après le rendu et le suivi du bas du fil (effets de mise en page du parent) : la carte est à sa
  // place quand on regarde si elle est à l'écran. Recalculé quand les cibles changent vraiment,
  // pas à chaque rendu du fil.
  const signature = targetsSignature(targets)
  useEffect(() => {
    const now = latest.current
    const seen = seenIn(scroller.current)
    remember(dropSeen(noteTargets(memory.current, now, seen), now, seen))
  }, [signature, scroller, remember])
  // Un travail vient de répondre hors de l'écran : revu après un court délai, le temps que sa carte
  // (le compte rendu, ajouté en bas du fil) arrive peut-être sous les yeux. Pas de clignotement.
  useEffect(() => {
    if (view.settling.length === 0) return
    const timer = window.setTimeout(
      () => remember(settle(memory.current, latest.current, seenIn(scroller.current))),
      SETTLE_MS
    )
    return () => window.clearTimeout(timer)
  }, [view.settling, scroller, remember])
  // Défilement, fil ou fenêtre qui changent de taille : une carte attendue est peut-être vue.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const seen = seenIn(el)
    const check = () => {
      const next = dropSeen(memory.current, latest.current, seen)
      if (next !== memory.current) remember(next)
    }
    el.addEventListener('scroll', check, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : undefined
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      observer?.disconnect()
    }
  }, [scroller, remember])
  // Une seule attente d'image et un seul anneau à la fois ; tout est annulé au démontage.
  const frame = useRef<number | undefined>(undefined)
  const flash = useRef<{ card: HTMLElement; timer: number } | undefined>(undefined)
  const stopFrame = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
  }
  const stopFlash = () => {
    if (!flash.current) return
    window.clearTimeout(flash.current.timer)
    flash.current.card.removeAttribute('data-cue-flash')
    flash.current = undefined
  }
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      if (flash.current) {
        window.clearTimeout(flash.current.timer)
        flash.current.card.removeAttribute('data-cue-flash')
      }
    },
    []
  )
  /** La carte au milieu de l'écran, entourée un instant, et le focus sur elle. */
  const showCard = (card: HTMLElement) => {
    stopFlash()
    card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    // Attributs que React ne gère pas sur ces cartes : un nouveau rendu ne les efface pas.
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1')
    card.focus({ preventScroll: true })
    card.setAttribute('data-cue-flash', '')
    const timer = window.setTimeout(() => {
      card.removeAttribute('data-cue-flash')
      flash.current = undefined
    }, FLASH_MS)
    flash.current = { card, timer }
  }
  const summary = useMemo(
    () => cueSummary({ ...EMPTY_CUE, pending: view.pending }, targets),
    [view.pending, targets]
  )
  const go = (first: CueTarget) => {
    remember(dropKey(memory.current, first.key))
    stopFrame()
    const card = anchorOf(scroller.current, first.itemId)
    if (card) {
      showCard(card)
      return
    }
    // Long fil ouvert par la fin : la carte est rendue d'abord, puis montrée.
    onReveal(first.itemId)
    let left = REVEAL_FRAMES
    const wait = () => {
      frame.current = undefined
      const rendered = anchorOf(scroller.current, first.itemId)
      if (rendered) showCard(rendered)
      else if (--left > 0) frame.current = requestAnimationFrame(wait)
    }
    frame.current = requestAnimationFrame(wait)
  }
  return (
    <div className="work-cue-live" aria-live="polite" data-testid="work-cue-live">
      {summary && <CueLine first={summary.first} count={summary.count} onShow={go} />}
    </div>
  )
}

/** La ligne elle-même : seul le nom se coupe, jamais le verbe (revue UX de la fiche 261). */
function CueLine({
  first,
  count,
  onShow
}: {
  first: CueTarget
  count: number
  onShow: (first: CueTarget) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="work-cue" data-testid="work-cue" data-count={count}>
      <span className="work-cue-in">
        <ArrowUp size={12} aria-hidden />
        {count === 1 && first.role && <RoleAvatar role={first.role} size={18} />}
        <span className="work-cue-text" data-testid="work-cue-text">
          {count > 1 ? (
            <span className="work-cue-verb">{t('workCue.several', { count })}</span>
          ) : (
            <>
              <span className="work-cue-name" title={first.label}>
                {first.label}
              </span>{' '}
              <span className="work-cue-verb">
                {t(first.state === 'finished' ? 'workCue.finished' : 'workCue.replied')}
              </span>
            </>
          )}
        </span>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="link-button work-cue-show"
          title={t('workCue.showTip')}
          onClick={() => onShow(first)}
          data-testid="work-cue-show"
        >
          {t('workCue.show')}
        </button>
      </span>
    </div>
  )
}

/**
 * Le repère branché sur le travail délégué d'aujourd'hui (filles, fiches 097 et 223) : cibles tirées
 * du fil et de la liste des conversations, recalculées seulement quand elles changent.
 */
export function DelegatedWorkCue({
  items,
  childConversations,
  attention,
  scroller,
  onReveal
}: {
  items: readonly TranscriptItem[]
  /** Conversations filles de celle-ci (liste des conversations). */
  childConversations: readonly ConversationSummary[]
  attention: AttentionState
  scroller: { readonly current: HTMLElement | null }
  onReveal: (itemId: number) => void
}) {
  const targets = useMemo(
    () => delegatedWorkTargets(items, childConversations, attention),
    [items, childConversations, attention]
  )
  return <WorkCue targets={targets} scroller={scroller} onReveal={onReveal} />
}
