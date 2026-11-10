import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type { HelpTarget } from '@shared/help-topics'
import { applyAppearance } from '../../appearance'
import { groupOf, guideLang, HOME_PAGE, type Guide, type GuideLang } from '../../help/guide'
import { loadGuide } from '../../help/guide-content'
import { queryTerms, searchGuide, type SearchResult } from '../../help/search'
import { firstMatch, highlightTerms } from '../../help/page-highlight'
import { HelpMarkdown } from './HelpMarkdown'
import '../../help.css'

const PLACE_KEY = 'bobine-help-place'

/** Page où en était cette fenêtre avant un rechargement, si elle est valide. */
function storedPlace(): Place | undefined {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return undefined
    const { lang, page, anchor } = raw as Record<string, unknown>
    if ((lang !== 'fr' && lang !== 'en') || typeof page !== 'string' || !/^[\w-]+$/.test(page)) {
      return undefined
    }
    return { lang, page, ...(typeof anchor === 'string' ? { anchor } : {}) }
  } catch {
    return undefined
  }
}

/** Pause de frappe avant de chercher. */
const SEARCH_DEBOUNCE_MS = 100

interface Place extends HelpTarget {
  lang: GuideLang
}

/** Fait ressortir une section un instant à l'arrivée (comme un réglage trouvé). */
function flash(target: HTMLElement): void {
  target.classList.remove('settings-flash')
  void target.offsetWidth
  target.classList.add('settings-flash')
  target.addEventListener('animationend', () => target.classList.remove('settings-flash'), {
    once: true
  })
}

/** Historique de navigation (⌘[ ⌘]). */
interface History {
  back: Place[]
  forward: Place[]
}

/**
 * Fenêtre d'aide (fiche 186) : sommaire à gauche, recherche en tête (⌘?), page à droite. Elle se
 * lit à côté de la conversation : rien n'est modal. Les pages viennent du guide embarqué.
 */
export function HelpWindow() {
  const { t, i18n } = useTranslation()
  const uiLang = guideLang(i18n.language)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [history, setHistory] = useState<History>({ back: [], forward: [] })
  const [query, setQuery] = useState('')
  // Recherche faite : la frappe après un léger anti-rebond (plus bas).
  const [searched, setSearched] = useState('')
  // Champ vidé : la recherche faite aussi, tout de suite. Laissée au minuteur, elle restait sur
  // l'ancienne quand on retapait aussitôt (minuteur annulé), et ses résultats revenaient.
  const clearSearch = useCallback(() => {
    setQuery('')
    setSearched('')
  }, [])
  const [selected, setSelected] = useState(0)
  /** Faire ressortir l'ancre à la prochaine page affichée. */
  const [flashNext, setFlashNext] = useState(0)
  const searchInput = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const lang = place?.lang ?? uiLang

  useEffect(() => {
    void window.api.settings.get().then((s) => applyAppearance(s))
    return window.api.settings.onChanged((s) => applyAppearance(s))
  }, [])

  useEffect(() => {
    document.title = t('help.title')
  }, [t])

  useEffect(() => {
    let live = true
    void loadGuide(lang).then((g) => live && setGuide(g))
    return () => {
      live = false
    }
  }, [lang])

  const placeRef = useRef<Place | null>(null)
  const show = useCallback((next: Place | null) => {
    placeRef.current = next
    // Gardée pour la session de la fenêtre : « Recharger » (écran d'erreur) revient ici.
    try {
      if (next) sessionStorage.setItem(PLACE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible : on retombera sur la cible initiale.
    }
    setPlace(next)
  }, [])
  const go = useCallback(
    (target: HelpTarget & { lang?: GuideLang }, push = true) => {
      const current = placeRef.current
      if (push && current) setHistory((h) => ({ back: [...h.back, current], forward: [] }))
      show({
        lang: target.lang ?? current?.lang ?? uiLang,
        page: target.page,
        ...(target.anchor ? { anchor: target.anchor } : {})
      })
      setFlashNext((n) => n + 1)
    },
    [uiLang, show]
  )

  // Première cible (sujet demandé, ou l'accueil), lue une seule fois, puis celles envoyées par
  // l'app. `go` change avec la langue : les abonnements passent par une référence, pour ne pas
  // relire la cible initiale (et revenir à la première page) à chaque changement.
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  }, [go])
  useEffect(() => {
    let live = true
    void window.api.help.target().then(({ target, search }) => {
      if (!live) return
      goRef.current(storedPlace() ?? target, false)
      if (search) searchInput.current?.focus()
    })
    const offNavigate = window.api.help.onNavigate((target) => {
      clearSearch()
      goRef.current(target)
    })
    const offSearch = window.api.help.onFocusSearch(() => {
      searchInput.current?.focus()
      searchInput.current?.select()
    })
    return () => {
      live = false
      offNavigate()
      offSearch()
    }
  }, [clearSearch])

  // La langue de l'interface change : l'aide la suit, à la même page.
  useEffect(() => {
    const current = placeRef.current
    if (current && current.lang !== uiLang) show({ ...current, lang: uiLang })
  }, [uiLang, show])

  const page = place && guide?.pages[place.page] !== undefined ? place.page : HOME_PAGE
  const text = guide?.pages[page] ?? ''
  // Anti-rebond léger : la recherche suit la frappe sans recalculer à chaque touche.
  useEffect(() => {
    if (!query.trim()) return
    const timer = setTimeout(() => setSearched(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  // Champ vidé (Échap) : la recherche s'arrête tout de suite, sans attendre l'anti-rebond.
  const done = query.trim() ? searched : ''
  const results: SearchResult[] = useMemo(
    () => (guide && done.trim() ? searchGuide(guide.sections, guide.titles, done) : []),
    [guide, done]
  )
  // Mots cherchés : ceux de la recherche faite (après l'anti-rebond), pas de chaque touche.
  const terms = useMemo(() => queryTerms(done), [done])

  const searching = done.trim().length > 0
  const selectedResult = searching ? results[selected] : undefined

  // Recherche : le résultat choisi (↑↓) est affiché aussitôt, sans entrer dans l'historique.
  useEffect(() => {
    if (!selectedResult || !guide) return
    const { page: resultPage, anchor } = selectedResult.section
    const current = placeRef.current
    if (current?.page === resultPage && current.anchor === anchor && current.lang === guide.lang)
      return
    show({ lang: guide.lang, page: resultPage, ...(anchor ? { anchor } : {}) })
  }, [selectedResult, guide, show])

  // Page affichée : au premier mot cherché de la section pendant une recherche, sinon à l'ancre
  // (qui ressort un instant), sinon en haut.
  useEffect(() => {
    const root = body.current
    if (!root || !guide) return
    const anchor = place?.anchor
      ? root.querySelector<HTMLElement>(`[id="${CSS.escape(place.anchor)}"]`)
      : null
    const match = searching ? firstMatch(root, terms, anchor) : undefined
    // jsdom n'a pas de géométrie pour une plage : la section, comme sans recherche.
    if (match && typeof match.getBoundingClientRect === 'function') {
      const top = match.getBoundingClientRect().top - root.getBoundingClientRect().top
      root.scrollTop += top - root.clientHeight / 3
    } else if (anchor) {
      anchor.scrollIntoView({ block: 'start' })
      if (flashNext > 0) flash(anchor)
    } else {
      root.scrollTop = 0
    }
  }, [guide, page, place?.anchor, flashNext, searching, terms])

  // Mots cherchés surlignés dans la page ouverte.
  useEffect(() => highlightTerms(body.current, terms), [terms, text])

  const back = useCallback(() => {
    const current = placeRef.current
    const previous = history.back.at(-1)
    if (!previous || !current) return
    setHistory({ back: history.back.slice(0, -1), forward: [current, ...history.forward] })
    show(previous)
  }, [history, show])
  const forward = useCallback(() => {
    const current = placeRef.current
    const next = history.forward[0]
    if (!next || !current) return
    setHistory({ back: [...history.back, current], forward: history.forward.slice(1) })
    show(next)
  }, [history, show])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === '[') {
        event.preventDefault()
        back()
      } else if (event.metaKey && event.key === ']') {
        event.preventDefault()
        forward()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back, forward])

  const openResult = (result: SearchResult) =>
    go({
      page: result.section.page,
      ...(result.section.anchor ? { anchor: result.section.anchor } : {})
    })

  const group = guide ? groupOf(guide, page) : undefined

  return (
    <div className="help-window" data-testid="help-window">
      <nav className="settings-nav help-nav" aria-label={t('help.nav')}>
        <div className="help-drag" aria-hidden />
        <label className="settings-search help-search">
          <Search size={14} aria-hidden />
          <input
            ref={searchInput}
            type="search"
            value={query}
            placeholder={t('help.search.placeholder')}
            aria-label={t('help.search.label')}
            aria-controls="help-results"
            onChange={(e) => {
              setQuery(e.target.value)
              if (!e.target.value.trim()) setSearched('')
              setSelected(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : -1
                setSelected((i) => Math.min(Math.max(i + step, 0), Math.max(results.length - 1, 0)))
              } else if (e.key === 'Enter') {
                // Frappe pas encore cherchée (anti-rebond) : la chercher tout de suite.
                const fresh =
                  searched === query || !guide
                    ? results
                    : searchGuide(guide.sections, guide.titles, query)
                const result = fresh[searched === query ? selected : 0]
                if (result) openResult(result)
              } else if (e.key === 'Escape' && query) {
                e.preventDefault()
                clearSearch()
              }
            }}
            data-testid="help-search"
          />
          <kbd className="help-search-keys" aria-hidden>
            ⌘?
          </kbd>
        </label>
        {searching ? (
          <ul className="help-results" id="help-results" role="listbox" data-testid="help-results">
            {results.length === 0 && (
              <li className="help-no-result" data-testid="help-no-result">
                {t('help.search.empty')}
              </li>
            )}
            {results.map((r, i) => (
              <li
                key={`${r.section.page}#${r.section.anchor ?? ''}`}
                role="option"
                aria-selected={i === selected}
              >
                <button
                  className={`help-result${i === selected ? ' active' : ''}`}
                  onClick={() => openResult(r)}
                  tabIndex={-1}
                  data-testid="help-result"
                  data-page={r.section.page}
                >
                  <span className="help-result-title">{r.section.title}</span>
                  <span className="help-result-snippet">
                    {r.snippet.map((s, j) =>
                      s.match ? (
                        <mark key={j}>{s.text}</mark>
                      ) : (
                        <Fragment key={j}>{s.text}</Fragment>
                      )
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="help-toc" data-testid="help-toc">
            {guide?.toc.map((g) => (
              <Fragment key={g.title}>
                <div className="help-toc-group">{g.title}</div>
                {g.pages.map((p) => (
                  <button
                    key={p.page}
                    className={`settings-nav-item help-toc-item${p.page === page ? ' active' : ''}`}
                    aria-current={p.page === page ? 'page' : undefined}
                    onClick={() => go({ page: p.page })}
                    data-testid={`help-toc-${p.page}`}
                  >
                    {p.title}
                  </button>
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </nav>
      <main className="help-main">
        <div className="help-drag help-drag-main" aria-hidden />
        <div className="help-body" ref={body} data-testid="help-page" data-page={page}>
          {page !== HOME_PAGE && (
            <div className="help-crumb" data-testid="help-crumb">
              <button className="help-crumb-link" onClick={() => go({ page: HOME_PAGE })}>
                {group?.title ?? guide?.titles[HOME_PAGE]}
              </button>
              {/* « Getting started › Getting started » : le groupe et la page portent le même nom. */}
              {group?.title !== guide?.titles[page] && ` › ${guide?.titles[page] ?? ''}`}
            </div>
          )}
          {guide && (
            <HelpMarkdown
              // Une page neuve à chaque page : sinon React réutilise ses titres d'une page à
              // l'autre, avec la classe du « ressort » posée à la main sur l'ancre d'avant.
              key={`${guide.lang}/${page}`}
              text={text}
              lang={guide.lang}
              page={page}
              onLink={(link) =>
                link.kind === 'changelog'
                  ? void window.api.help.showChangelog()
                  : go({
                      lang: link.lang,
                      page: link.page,
                      ...(link.anchor ? { anchor: link.anchor } : {})
                    })
              }
            />
          )}
        </div>
        {searching && (
          <div className="help-keys" aria-hidden>
            {t('help.search.keys')}
          </div>
        )}
      </main>
    </div>
  )
}
