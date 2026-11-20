/**
 * Barres au-dessus du code du fichier ouvert (fiche 271) : aller à la ligne (⌃G) et recherche (⌘F).
 */
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'

/** Aller à la ligne (⌃G, menu de l'onglet). */
export function GotoBar({
  count,
  onGo,
  onClose
}: {
  count: number
  onGo: (line: number) => void
  /** `back` : le clavier revient au code (Échap) ; un clic ailleurs le laisse où il va. */
  onClose: (back: boolean) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <div className="file-bar" data-testid="file-goto-bar">
      <input
        autoFocus
        inputMode="numeric"
        aria-label={t('files.goToLinePrompt')}
        placeholder={t('files.goToLine')}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={() => onClose(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose(true)
          } else if (e.key === 'Enter') {
            const n = Number(value)
            if (n > 0) onGo(Math.min(n, count))
            else onClose(true)
          }
        }}
        data-testid="file-goto"
      />
    </div>
  )
}

/**
 * Recherche dans le fichier ouvert (⌘F, Q48) : le premier résultat est amené dès la frappe ; ↵ et ↓
 * suivant, ⇧↵ et ↑ précédent, Échap et ✕ ferment.
 */
export function FileFind({
  lines,
  onShow,
  onClose
}: {
  lines: readonly string[]
  onShow: (line: number) => void
  /** Fermée (Échap, ✕) : le clavier revient au code. */
  onClose: (back: boolean) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const needle = query.toLowerCase()
  const found = useMemo(
    () =>
      needle
        ? lines.flatMap((line, i) => (line.toLowerCase().includes(needle) ? [i + 1] : []))
        : [],
    [lines, needle]
  )
  const go = (index: number) => {
    if (found.length === 0) return
    const next = (index + found.length) % found.length
    setAt(next)
    const line = found[next]
    if (line) onShow(line)
  }
  const type = (value: string) => {
    setQuery(value)
    setAt(0)
    const lower = value.toLowerCase()
    const first = value ? lines.findIndex((line) => line.toLowerCase().includes(lower)) : -1
    if (first >= 0) onShow(first + 1)
  }
  const count = needle
    ? found.length
      ? t('files.findCount', { at: at + 1, count: found.length })
      : t('files.findNone')
    : ''
  const button = (label: string, icon: ReactNode, run: () => void, testId: string, off = false) => (
    <Tip label={label}>
      <button
        className="icon-button small"
        aria-label={label}
        disabled={off}
        onClick={run}
        data-testid={testId}
      >
        {icon}
      </button>
    </Tip>
  )
  return (
    <div className="file-bar" role="search" data-testid="file-find-bar">
      <input
        autoFocus
        aria-label={t('files.find')}
        placeholder={t('files.find')}
        value={query}
        onChange={(e) => type(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose(true)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(at + (e.shiftKey ? -1 : 1))
          }
        }}
        data-testid="file-find"
      />
      <span className="file-find-count" aria-live="polite" data-testid="file-find-count">
        {count}
      </span>
      {button(
        t('files.findPrevious'),
        <ChevronUp size={14} />,
        () => go(at - 1),
        'file-find-previous',
        found.length === 0
      )}
      {button(
        t('files.findNext'),
        <ChevronDown size={14} />,
        () => go(at + 1),
        'file-find-next',
        found.length === 0
      )}
      {button(t('files.findClose'), <X size={14} />, () => onClose(true), 'file-find-close')}
    </div>
  )
}
