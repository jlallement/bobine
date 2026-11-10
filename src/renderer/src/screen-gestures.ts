import { useLayoutEffect, useRef, type PointerEvent, type WheelEvent } from 'react'

/**
 * Gestes à la souris sur l'écran d'un appareil (simulateur iOS, fiche 044 ; émulateur Android,
 * fiche 081) : clic = toucher, appui long (si l'appareil le permet), glisser = balayage de la durée
 * du geste, molette ou trackpad = balayage court à l'endroit du pointeur. Coordonnées de l'appareil
 * (points, dp) : l'élément qui reçoit les gestes est l'écran, exactement à l'échelle.
 */

export type Point = { x: number; y: number }
type Size = { width: number; height: number }

/** En deçà de ce déplacement (pixels de l'écran de l'utilisateur), un geste est un toucher. */
export const TAP_SLOP_PX = 6
/** Toucher tenu au moins ce temps : appui long. */
export const LONG_PRESS_MS = 500
/** Molette ou trackpad : les crans reçus pendant ce délai font un seul balayage. */
const WHEEL_SETTLE_MS = 120
/** Marge gardée avec les bords de l'écran pour un balayage à la molette (pas de geste système). */
const WHEEL_MARGIN = 24
/** Durée d'un balayage à la molette. */
const WHEEL_SWIPE_MS = 250

export type Gesture =
  | { kind: 'tap'; at: Point; holdMs?: number }
  | { kind: 'swipe'; from: Point; to: Point; ms: number }

/** Relâchement : toucher si le pointeur n'a presque pas bougé (appui long s'il a été tenu), sinon balayage. */
export function releasedGesture(
  start: Point,
  end: Point,
  movedPx: number,
  elapsedMs: number,
  longPress: boolean
): Gesture {
  if (movedPx < TAP_SLOP_PX) {
    return longPress && elapsedMs >= LONG_PRESS_MS
      ? { kind: 'tap', at: start, holdMs: Math.min(5000, Math.round(elapsedMs)) }
      : { kind: 'tap', at: start }
  }
  return { kind: 'swipe', from: start, to: end, ms: Math.min(1500, Math.max(50, elapsedMs)) }
}

/**
 * Molette : balayage court depuis le pointeur, à l'opposé du défilement (le doigt pousse le
 * contenu), loin des bords ; `null` s'il est trop court pour compter.
 */
export function wheelSwipe(
  at: Point,
  delta: { dx: number; dy: number },
  scale: number,
  screen: Size
): Gesture | null {
  const clamp = (v: number, max: number) => Math.min(max - WHEEL_MARGIN, Math.max(WHEEL_MARGIN, v))
  const from = { x: clamp(at.x, screen.width), y: clamp(at.y, screen.height) }
  const to = {
    x: clamp(from.x - delta.dx / scale, screen.width),
    y: clamp(from.y - delta.dy / scale, screen.height)
  }
  if (Math.hypot(to.x - from.x, to.y - from.y) < 4) return null
  return { kind: 'swipe', from, to, ms: WHEEL_SWIPE_MS }
}

interface Pending {
  pointerId: number
  startClient: Point
  start: Point
  last: Point
  at: number
}

/**
 * Gestionnaires à poser sur l'élément de l'écran. `scale` : pixels de l'écran de l'utilisateur par
 * unité de l'appareil ; `perform` reçoit chaque geste reconnu.
 */
export function useScreenGestures(options: {
  screen: Size | null
  scale: number
  enabled: boolean
  longPress?: boolean
  /**
   * Molette = défilement dans l'appareil (par défaut). Faux quand l'appareil est zoomé (fiche 084) :
   * la molette déplace alors la vue agrandie, et l'on fait défiler l'app en glissant.
   */
  wheelScrolls?: boolean
  perform: (gesture: Gesture) => void
}) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const gesture = useRef<Pending | null>(null)
  const wheel = useRef<{ at: Point; dx: number; dy: number; timer: number } | null>(null)

  /** Position du pointeur en unités de l'appareil (bornée à l'écran). */
  const toPoint = (event: { clientX: number; clientY: number; currentTarget: Element }): Point => {
    const screen = latest.current.screen
    const box = event.currentTarget.getBoundingClientRect()
    const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v))
    return {
      x: clamp(((event.clientX - box.left) / box.width) * (screen?.width ?? 0), screen?.width ?? 0),
      y: clamp(
        ((event.clientY - box.top) / box.height) * (screen?.height ?? 0),
        screen?.height ?? 0
      )
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const { enabled, screen } = latest.current
    if (!enabled || !screen || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = toPoint(event)
    gesture.current = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      start,
      last: start,
      at: performance.now()
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (g && g.pointerId === event.pointerId) g.last = toPoint(event)
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== event.pointerId) return
    gesture.current = null
    const moved = Math.hypot(event.clientX - g.startClient.x, event.clientY - g.startClient.y)
    latest.current.perform(
      releasedGesture(
        g.start,
        toPoint(event),
        moved,
        performance.now() - g.at,
        latest.current.longPress ?? false
      )
    )
  }

  const onPointerCancel = () => {
    gesture.current = null
  }

  const onWheel = (event: WheelEvent<HTMLElement>) => {
    const { enabled, screen, scale, wheelScrolls = true } = latest.current
    if (!enabled || !wheelScrolls || !screen || scale === 0) return
    const pending = wheel.current ?? { at: toPoint(event), dx: 0, dy: 0, timer: 0 }
    pending.dx += event.deltaX
    pending.dy += event.deltaY
    window.clearTimeout(pending.timer)
    pending.timer = window.setTimeout(() => {
      wheel.current = null
      const { screen: now, scale: s } = latest.current
      const swipe = now && s > 0 ? wheelSwipe(pending.at, pending, s, now) : null
      if (swipe) latest.current.perform(swipe)
    }, WHEEL_SETTLE_MS)
    wheel.current = pending
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onWheel }
}
