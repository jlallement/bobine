import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffRow } from '@shared/diff'
import {
  HARD_BYTES,
  HARD_LINES,
  linesOf,
  rowsForLines,
  type DiffSegment
} from '@shared/display-cap'
import { CopyAll, useSettledFindQuery } from './CappedText'
import { findMatches } from '../../thread-find'
import { countText } from '@shared/i18n/format'
import { useReveal } from './useReveal'

const MORE_KEY = {
  lines: 'cap.more',
  removed: 'cap.moreRemoved',
  added: 'cap.moreAdded'
} as const

/**
 * Une tranche d'un diff, plafonnée (fiche 192) : ses premières lignes, puis la rangée « ⋯ N lignes
 * de plus · Afficher tout » au style des plages repliées. « Afficher tout » rend la suite par
 * paquets, met le focus sur la première ligne nouvelle et annonce le total ; au-delà de
 * `HARD_LINES` lignes ou `HARD_BYTES` caractères, il laisse la place à « Ouvrir dans l'éditeur »,
 * qui ouvre le diff entier (pas le fichier tel qu'il est aujourd'hui). « Copier tout » copie le diff
 * entier, éditeur installé ou non. Recherche dans le fil ouverte : les lignes masquées qui
 * contiennent ce qu'on cherche sont montrées, jusqu'à la dernière trouvée (la recherche ne lit que
 * la page).
 */
export function CappedRows({
  segment,
  offset,
  columns,
  renderRow,
  whole,
  openInEditor
}: {
  segment: DiffSegment
  /** Rang de sa première rangée dans le diff (clés). */
  offset: number
  columns: number
  renderRow: (row: DiffRow, index: number) => ReactNode[]
  /** Le diff entier en texte, fait à la demande. */
  whole: () => string
  /** « Ouvrir dans l'éditeur » d'un texte (nom de l'éditeur, action), si un éditeur est installé. */
  openInEditor?: { label: string; open: (text: string) => void } | undefined
}) {
  const { t } = useTranslation()
  const { rows, limit, kind } = segment
  const total = linesOf(rows)
  const { shown, revealing, revealed, reveal, revealTo } = useReveal(total, limit)
  const query = useSettledFindQuery()
  // Lignes à montrer pour que la recherche trouve tout ce qui est masqué (0 : rien de trouvé).
  const searched = useMemo(() => {
    if (!query?.trim() || total <= limit) return 0
    const lines = rows.filter((row) => row.type !== 'skip')
    const text = lines.map((row) => row.text).join('\n')
    const last = findMatches(text, query).at(-1)
    if (!last) return 0
    // Ligne de la dernière correspondance : fins de ligne avant elle, plus un.
    let line = 1
    for (let i = text.indexOf('\n'); i !== -1 && i < last[0]; i = text.indexOf('\n', i + 1)) line++
    return line
  }, [query, rows, total, limit])
  const hidden = total - shown
  const tooBig =
    total > HARD_LINES ||
    rows.reduce((n, row) => n + (row.type === 'skip' ? 0 : row.text.length + 1), 0) > HARD_BYTES
  // Trouvé dans le masqué : montré par paquets ; trop gros, seulement dit (« Ouvrir… »).
  useEffect(() => {
    if (searched > 0 && !tooBig) revealTo(searched)
  }, [searched, tooBig, revealTo])
  const foundHidden = searched > shown
  const capRow = useRef<HTMLTableRowElement>(null)
  /** Dernière rangée montrée au moment du clic : la suivante reçoit le focus. */
  const anchor = useRef<Element | null>(null)
  useEffect(() => {
    const before = anchor.current
    if (!before) return
    const first = before.nextElementSibling
    if (first instanceof HTMLElement && first !== capRow.current) {
      anchor.current = null
      first.tabIndex = -1
      first.focus()
    }
  }, [shown])
  return (
    <>
      {rows.slice(0, rowsForLines(rows, shown)).flatMap((row, i) => renderRow(row, offset + i))}
      {hidden > 0 && (
        <tr ref={capRow} className="diff-skip diff-cap" data-testid="diff-cap" data-kind={kind}>
          <td colSpan={columns}>
            {revealing ? (
              t('cap.showing', { done: countText(shown), total: countText(total) })
            ) : (
              <>
                {foundHidden && tooBig ? `${t('cap.foundHidden')} · ` : ''}
                {t(MORE_KEY[kind], { count: hidden, n: countText(hidden) })}
                {!tooBig ? (
                  <button
                    type="button"
                    className="link-button cap-action"
                    onClick={() => {
                      anchor.current = capRow.current?.previousElementSibling ?? null
                      reveal()
                    }}
                    data-testid="cap-show-all"
                  >
                    {t('cap.showAll')}
                  </button>
                ) : (
                  openInEditor && (
                    <button
                      type="button"
                      className="link-button cap-action"
                      onClick={() => openInEditor.open(whole())}
                      data-testid="cap-open-editor"
                    >
                      {openInEditor.label}
                    </button>
                  )
                )}
                <CopyAll text={whole} />
              </>
            )}
          </td>
        </tr>
      )}
      {total > limit && (
        <tr className="sr-only">
          <td aria-live="polite">
            {revealed ? t('cap.shown', { count: total, n: countText(total) }) : ''}
          </td>
        </tr>
      )}
    </>
  )
}
