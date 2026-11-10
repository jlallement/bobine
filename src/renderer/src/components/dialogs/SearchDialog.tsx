import * as Dialog from '@radix-ui/react-dialog'
import { MessageSquare, Search } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import type { ConversationSummary } from '@shared/agent'
import { searchConversations, type ContentHit } from '@shared/conversation-search'
import { basename } from '../common/Menus'
import { useTranslation } from 'react-i18next'

/**
 * Recherche rapide d'une conversation (⌘K, fiche 027), par titre, dossier ou agent. La recherche
 * dans le contenu des conversations est l'objet de la fiche 026.
 */
export function SearchDialog({
  open,
  onOpenChange,
  conversations,
  activeId,
  onSelect
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: ConversationSummary[]
  activeId: string | null
  /** `query` : la conversation a été trouvée par son contenu (⌘F s'ouvre dessus, fiche 086). */
  onSelect: (id: string, query?: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  // Contenu des conversations : cherché par le main, un instant après la dernière frappe.
  const [hits, setHits] = useState<{ query: string; hits: ContentHit[] }>({ query: '', hits: [] })
  useEffect(() => {
    if (query.trim().length < 2) return
    let alive = true
    const timer = setTimeout(() => {
      void window.api.conversations
        .search(query)
        .then((found) => alive && setHits({ query, hits: found }))
        .catch(() => {})
    }, 150)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])
  const history = conversations.filter((c) => !c.draft)
  const byTitle = searchConversations(history, query)
  const content = new Map(
    (hits.query === query && query.trim().length >= 2 ? hits.hits : []).map((h) => [h.id, h])
  )
  // Titres, dossiers et agents d'abord, puis les conversations trouvées par leur contenu.
  const results = [
    ...byTitle.map((c) => ({ conversation: c, hit: content.get(c.id) })),
    ...history
      .filter((c) => content.has(c.id) && !byTitle.includes(c))
      .map((c) => ({ conversation: c, hit: content.get(c.id) }))
  ].slice(0, 50)
  const current = Math.min(index, Math.max(0, results.length - 1))

  const choose = (id: string) => {
    onOpenChange(false)
    onSelect(id, content.has(id) ? query.trim() : undefined)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setIndex((current + step + results.length) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = results[current]
      if (chosen) choose(chosen.conversation.id)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setQuery('')
          setIndex(0)
        }
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog search-dialog" data-testid="search">
          <Dialog.Title className="sr-only">{t('search.title')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('search.hint')}</Dialog.Description>
          <div className="search-field">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              placeholder={t('search.placeholder')}
              onChange={(e) => {
                setQuery(e.target.value)
                setIndex(0)
              }}
              onKeyDown={onKeyDown}
              data-testid="search-input"
            />
            <kbd>{t('search.escape')}</kbd>
          </div>
          <ul className="search-results" role="listbox">
            {results.length === 0 && <li className="search-empty">{t('search.empty')}</li>}
            {results.map(({ conversation: c, hit }, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === current}
                className={`search-result${i === current ? ' current' : ''}`}
                onMouseMove={() => setIndex(i)}
                onClick={() => choose(c.id)}
                data-testid="search-result"
              >
                <MessageSquare size={14} className="muted-icon" />
                <div className="search-result-main">
                  <div className="search-result-line">
                    <span className="search-result-title">{c.title}</span>
                    {c.id === activeId && (
                      <span className="search-result-tag">{t('search.shown')}</span>
                    )}
                    <span className="search-result-side">
                      {c.profileLabel} · {basename(c.workspace)}
                    </span>
                  </div>
                  {hit && <Snippet hit={hit} />}
                </div>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Extrait du contenu, mots cherchés surlignés. */
function Snippet({ hit }: { hit: ContentHit }) {
  const parts: { text: string; mark: boolean }[] = []
  let at = 0
  for (const [start, end] of hit.highlights) {
    if (start < at) continue
    if (start > at) parts.push({ text: hit.snippet.slice(at, start), mark: false })
    parts.push({ text: hit.snippet.slice(start, end), mark: true })
    at = end
  }
  parts.push({ text: hit.snippet.slice(at), mark: false })
  return (
    <div className="search-snippet" data-testid="search-snippet">
      {parts.map((p, i) =>
        p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>
      )}
    </div>
  )
}
