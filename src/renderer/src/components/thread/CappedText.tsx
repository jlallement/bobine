import {
  createContext,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  lineCount,
  outputCap,
  REVEAL_STEP,
  startOfLinesBefore,
  textCounts,
  type TextCounts
} from '@shared/display-cap'
import { countText } from '@shared/i18n/format'
import { sizeText } from '../../acp-view'
import { findMatches } from '../../thread-find'
import { EditorContext } from './OpenInEditor'
import { useReveal } from './useReveal'

/** Durée du « Copié » de « Copier tout ». */
const COPIED_MS = 1500

/**
 * Recherche dans le fil ouverte : ce qu'on cherche (fiche 086). Une sortie plafonnée montre alors
 * aussi son début masqué s'il contient ce qu'on cherche, à partir de la ligne trouvée : la
 * recherche ne lit que la page (relecture de la fiche 192).
 */
export const FindQueryContext = createContext<string | undefined>(undefined)

/** Pause de la frappe avant de chercher dans le contenu masqué (comme la recherche du fil). */
const FIND_SETTLE_MS = 150

/** Ce qu'on cherche, une fois la frappe posée : pas de calcul ni de rendu à chaque touche. */
export function useSettledFindQuery(): string | undefined {
  const query = useContext(FindQueryContext)
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), FIND_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [query])
  return query === undefined ? undefined : settled
}

/**
 * Comptes du texte (lignes, octets) tenus à jour par morceau : une sortie qui arrive en streaming
 * n'est pas recomptée en entier à chaque morceau.
 */
function useTextCounts(text: string): TextCounts {
  const [counts, setCounts] = useState(() => textCounts(text))
  if (counts.text !== text) {
    const next = textCounts(text, counts)
    setCounts(next)
    return next
  }
  return counts
}

/**
 * Sortie d'outil plafonnée (fiche 192, maquette validée par l'expert UX) : les dernières lignes
 * (500, ou 200 Kio), la zone ouverte en bas, et un bandeau « N premières lignes masquées (taille au
 * total) · Afficher tout · Copier tout ». « Afficher tout » rend le début par paquets, met le focus
 * sur la première ligne et annonce le total ; trop gros (50 000 lignes, 5 Mio), il laisse la place
 * à « Ouvrir dans l'éditeur » (fichier temporaire de l'app). Le fil garde la sortie entière.
 * `renderChunk` reçoit chaque morceau et sa position (couleurs ANSI en vigueur à ce point).
 */
export function CappedText({
  text,
  className,
  testId,
  renderChunk = plainChunk
}: {
  text: string
  className: string
  testId?: string
  renderChunk?: (chunk: string, start: number, whole: string) => ReactNode
}) {
  const { t } = useTranslation()
  const editor = useContext(EditorContext)
  const query = useSettledFindQuery()
  const counts = useTextCounts(text)
  const cap = useMemo(() => outputCap(text, undefined, counts), [text, counts])
  const capped = cap.totalLines - cap.hiddenLines
  const { shown, revealing, revealed, reveal, revealTo } = useReveal(cap.totalLines, capped)
  // Recherche ouverte, trouvée dans le début masqué : montré, par paquets, jusqu'à la ligne
  // trouvée ; trop gros pour tout montrer, seulement dit (« Ouvrir dans l'éditeur »).
  const found = useMemo(() => {
    if (!query?.trim() || cap.start === 0) return undefined
    const first = findMatches(text.slice(0, cap.start), query)[0]
    return first ? text.lastIndexOf('\n', first[0]) + 1 : undefined
  }, [query, text, cap.start])
  const foundLines = found === undefined ? 0 : lineCount(text.slice(found))
  useEffect(() => {
    if (foundLines > 0 && !cap.tooBig) revealTo(foundLines)
  }, [foundLines, cap.tooBig, revealTo])
  // Morceaux montrés, du plus récent au plus ancien : le plafond, puis des paquets au-dessus.
  const bounds = useMemo(() => {
    const starts = [cap.start]
    let lines = capped
    while (lines < shown && (starts.at(-1) ?? 0) > 0) {
      const step = Math.min(REVEAL_STEP, shown - lines)
      starts.push(startOfLinesBefore(text, starts.at(-1) ?? 0, step))
      lines += step
    }
    // Tout demandé : jusqu'au tout début, même si une ligne coupée par le plafond en caractères
    // fausse le compte des lignes.
    if (shown >= cap.totalLines && (starts.at(-1) ?? 0) > 0) starts.push(0)
    return starts
  }, [text, cap.start, cap.totalLines, capped, shown])
  const pre = useRef<HTMLPreElement>(null)
  const first = useRef<HTMLSpanElement>(null)
  // Ouverte en bas : le bilan d'une commande est à la fin.
  useLayoutEffect(() => {
    const el = pre.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  const focusOnReveal = useRef(false)
  useEffect(() => {
    if (!revealed || !focusOnReveal.current) return
    focusOnReveal.current = false
    first.current?.focus()
  }, [revealed])
  const hidden = (bounds.at(-1) ?? 0) > 0
  const chunks = bounds
    .map((start, i) => ({ start, end: i === 0 ? text.length : (bounds[i - 1] ?? text.length) }))
    .reverse()
  return (
    <>
      {hidden && (
        <div className="terminal-note cap-note" data-testid="output-cap">
          <span className="cap-note-text">
            {revealing
              ? t('cap.showing', { done: countText(shown), total: countText(cap.totalLines) })
              : found !== undefined && cap.tooBig
                ? t('cap.foundHidden')
                : cap.byChars
                  ? t('cap.hiddenChars', { size: sizeText(cap.bytes) })
                  : t('cap.hiddenStart', {
                      count: cap.hiddenLines,
                      n: countText(cap.hiddenLines),
                      size: sizeText(cap.bytes)
                    })}
          </span>
          {!revealing &&
            (cap.tooBig ? (
              editor?.openText && (
                <button
                  type="button"
                  className="link-button cap-action"
                  onClick={() => editor.openText?.(text)}
                  data-testid="cap-open-editor"
                >
                  {t('editor.open', { editor: editor.name })}
                </button>
              )
            ) : (
              <button
                type="button"
                className="link-button cap-action"
                onClick={() => {
                  focusOnReveal.current = true
                  reveal()
                }}
                data-testid="cap-show-all"
              >
                {t('cap.showAll')}
              </button>
            ))}
          <CopyAll text={text} />
        </div>
      )}
      <pre ref={pre} className={className} data-testid={testId}>
        {chunks.map(({ start, end }, i) => (
          <span key={start} ref={i === 0 ? first : undefined} tabIndex={i === 0 ? -1 : undefined}>
            <Chunk chunk={text.slice(start, end)} start={start} whole={text} render={renderChunk} />
          </span>
        ))}
      </pre>
      {cap.start > 0 && (
        <span className="sr-only" aria-live="polite">
          {revealed ? t('cap.shown', { count: cap.totalLines, n: countText(cap.totalLines) }) : ''}
        </span>
      )}
    </>
  )
}

const plainChunk = (chunk: string) => chunk

/**
 * Un paquet : rendu une fois (les suivants s'ajoutent au-dessus sans refaire celui-ci). Le texte
 * d'avant lui ne change pas quand la sortie s'allonge : seuls son texte et sa place comptent.
 */
const Chunk = memo(
  function Chunk({
    chunk,
    start,
    whole,
    render
  }: {
    chunk: string
    start: number
    whole: string
    render: (chunk: string, start: number, whole: string) => ReactNode
  }) {
    return <>{render(chunk, start, whole)}</>
  },
  (a, b) => a.chunk === b.chunk && a.start === b.start && a.render === b.render
)

/** « Copier tout » : la sortie entière ; « Copié » dit, et annoncé, pendant 1,5 s. */
export function CopyAll({ text }: { text: string | (() => string) }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), COPIED_MS)
    return () => clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      className="link-button cap-action"
      aria-live="polite"
      onClick={() =>
        navigator.clipboard.writeText(typeof text === 'string' ? text : text()).then(
          () => setState('done'),
          () => setState('failed')
        )
      }
      data-testid="cap-copy-all"
    >
      {state === 'done' ? t('copy.done') : state === 'failed' ? t('copy.failed') : t('cap.copyAll')}
    </button>
  )
}
