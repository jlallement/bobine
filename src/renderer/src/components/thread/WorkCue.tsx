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
  targetsSignature,
  type CueMemory,
  type CueTarget
} from './work-cue'
import { delegatedWorkTargets } from './work-cue-targets'

/** Durée de l'anneau autour de la carte montrée (maquette 260, écran E). */
export const FLASH_MS = 1000
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

/** La carte au milieu de l'écran, entourée un instant (rien ne bouge si les animations sont réduites). */
function showCard(card: HTMLElement) {
  card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
  // Attribut que React ne gère pas : un nouveau rendu de la carte ne l'efface pas.
  card.setAttribute('data-cue-flash', '')
  window.setTimeout(() => card.removeAttribute('data-cue-flash'), FLASH_MS)
}

/**
 * Repère en bas du fil (fiche 261, écran E) : « ↑ Expert UX/UI a répondu · Voir », ou « ↑ 2 travaux
 * ont répondu · Voir » (mène au plus ancien). Une ligne fine au-dessus de la saisie, qui disparaît
 * quand la carte a été vue (défilement ou « Voir »). Générique : les cibles viennent d'un
 * adaptateur ; à recréer à chaque conversation (`key`).
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
  const { t } = useTranslation()
  const memory = useRef<CueMemory>(EMPTY_CUE)
  const latest = useRef(targets)
  useLayoutEffect(() => {
    latest.current = targets
  })
  const [pending, setPending] = useState<readonly string[]>(EMPTY_CUE.pending)
  const remember = useCallback((next: CueMemory) => {
    memory.current = next
    setPending(next.pending)
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
  const frame = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    },
    []
  )
  const summary = useMemo(() => cueSummary({ ...EMPTY_CUE, pending }, targets), [pending, targets])
  if (!summary) return null
  const { first, count } = summary
  const go = () => {
    remember(dropKey(memory.current, first.key))
    const card = anchorOf(scroller.current, first.itemId)
    if (card) {
      showCard(card)
      return
    }
    // Long fil ouvert par la fin : la carte est rendue d'abord, puis montrée.
    onReveal(first.itemId)
    let left = REVEAL_FRAMES
    const wait = () => {
      const rendered = anchorOf(scroller.current, first.itemId)
      if (rendered) showCard(rendered)
      else if (--left > 0) frame.current = requestAnimationFrame(wait)
    }
    frame.current = requestAnimationFrame(wait)
  }
  const text =
    count > 1
      ? t('workCue.several', { count })
      : t(first.state === 'finished' ? 'workCue.finished' : 'workCue.replied', {
          name: first.label
        })
  return (
    <div className="work-cue" role="status" data-testid="work-cue" data-count={count}>
      <span className="work-cue-in">
        <ArrowUp size={12} aria-hidden />
        {count === 1 && first.role && <RoleAvatar role={first.role} size={18} />}
        <span data-testid="work-cue-text">{text}</span>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="link-button work-cue-show"
          title={t('workCue.showTip')}
          onClick={go}
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
