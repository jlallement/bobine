import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { TranscriptItem } from '@shared/transcript'
import { useTranslation } from 'react-i18next'
import { OUTLINE_MAX_HEIGHT, outlineHeight, outlineLayout } from './outline-layout'

/** Place minimale à gauche du fil pour afficher le sommaire sans recouvrir le texte. */
const MIN_GUTTER = 64

/**
 * Sommaire de la conversation, comme dans Claude Desktop : un trait par message de
 * l'utilisateur en haut à gauche du fil, celui qu'on lit mis en avant ; au survol, la liste des
 * messages ; un clic amène au message. Sur une longue conversation, la colonne de traits reste
 * dans sa hauteur maximale : un trait pour plusieurs messages (fiche 173, `outline-layout.ts`).
 */
export function ConversationOutline({
  items,
  scroller,
  onGo
}: {
  items: readonly TranscriptItem[]
  scroller: RefObject<HTMLDivElement | null>
  /** Message `id` pas encore rendu (long fil ouvert par la fin, fiche 193) : le fil le rend. */
  onGo?: (id: number) => void
}) {
  const { t } = useTranslation()
  const messages = items.flatMap((i) => (i.kind === 'user' && i.text.trim() ? [i] : []))
  const [current, setCurrent] = useState<number | undefined>(undefined)
  const [room, setRoom] = useState(false)
  const [height, setHeight] = useState(0)
  const count = messages.length
  const firstId = messages[0]?.id
  const messageIds = useRef<number[]>([])
  useLayoutEffect(() => {
    messageIds.current = messages.map((m) => m.id)
  })

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => {
      const column = el.querySelector('.column')
      const gutter = column ? (el.clientWidth - column.clientWidth) / 2 : 0
      setRoom(gutter >= MIN_GUTTER)
      setHeight(outlineHeight(el.clientHeight))
      // Le message lu : le dernier dont le haut a passé le premier tiers de la zone visible.
      const line = el.getBoundingClientRect().top + el.clientHeight / 3
      let id: number | undefined
      const nodes = el.querySelectorAll<HTMLElement>('[data-testid=user-message]')
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= line) id = Number(node.dataset['itemId'])
      }
      // Au-dessus du premier message rendu (long fil ouvert par la fin) : le message d'avant lui.
      const firstShown = Number(nodes[0]?.dataset['itemId'])
      setCurrent(id ?? messageIds.current.findLast((m) => m < firstShown) ?? firstId)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [scroller, count, firstId])

  if (messages.length < 2 || !room) return null
  // Avant la première mesure du fil : la hauteur maximale.
  const layout = outlineLayout(count, height || OUTLINE_MAX_HEIGHT)
  const currentIndex = messages.findIndex((m) => m.id === current)
  const go = (id: number) => {
    const target = scroller.current?.querySelector(`[data-item-id="${id}"]`)
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    else onGo?.(id)
  }
  return (
    <nav
      className="outline"
      aria-label={t('outline.label')}
      data-testid="outline"
      // Liste ouverte sur le message lu, pas sur le premier (longue conversation, fiche 173).
      onMouseEnter={(e) =>
        e.currentTarget.querySelector('.outline-list .current')?.scrollIntoView({ block: 'center' })
      }
    >
      <div
        className="outline-bars"
        aria-hidden
        style={{ gap: layout.gap }}
        data-testid="outline-bars"
      >
        {layout.bars.map((bar) => (
          <span
            key={bar.first}
            data-first={bar.first}
            data-last={bar.last}
            className={`outline-bar${currentIndex >= bar.first && currentIndex <= bar.last ? ' current' : ''}`}
          />
        ))}
      </div>
      <ol className="outline-list" data-testid="outline-list">
        {messages.map((m) => (
          <li key={m.id}>
            <button
              className={m.id === current ? 'current' : ''}
              onClick={() => go(m.id)}
              title={m.text}
              data-testid="outline-item"
            >
              {m.text.trim().split('\n')[0]}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
