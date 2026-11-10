/**
 * Guide de l'utilisateur (fiche 186) : les pages Markdown de `docs/guide/<langue>/`, lues telles
 * quelles. Ce module ne fait que les analyser (sommaire, titres, sections) ; le contenu vient de
 * `guide-content.ts`, embarqué au build.
 */

import { frenchSpaces } from '@shared/i18n/typography'
import { fold } from './search'

export type GuideLang = 'fr' | 'en'
export const GUIDE_LANGS: readonly GuideLang[] = ['fr', 'en']

/** Page d'accueil du guide (le sommaire de GitHub). */
export const HOME_PAGE = 'README'

/** Ancre stable d'une section : `<a id="…"></a>` juste avant son titre, en ASCII. */
export const ANCHOR_LINE = /^<a id="([a-z0-9-]+)"><\/a>\s*$/

export interface GuideSection {
  page: string
  /** Ancre stable, absente pour l'introduction d'une page. */
  anchor?: string
  /** Titre de la section (le titre de la page pour l'introduction). */
  title: string
  /** Texte lisible, sans la syntaxe Markdown. */
  text: string
  /** Titre, titre de la page et texte repliés (minuscules, sans accents), calculés une fois. */
  folded?: { title: string; page: string; text: string }
}

export interface TocGroup {
  title: string
  pages: { page: string; title: string }[]
}

export interface Guide {
  lang: GuideLang
  /** Texte Markdown de chaque page, par nom de fichier sans `.md`. */
  pages: Record<string, string>
  /** Titre `#` de chaque page. */
  titles: Record<string, string>
  toc: TocGroup[]
  sections: GuideSection[]
}

/** Langue du guide pour la langue de l'interface (`fr`, `fr-FR`, `en-US`…) ; anglais sinon. */
export const guideLang = (language: string): GuideLang =>
  language.toLowerCase().startsWith('fr') ? 'fr' : 'en'

/** Markdown en ligne → texte lisible (liens, code, gras, images). */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_]/g, '$1$2')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\|?\s*-{3,}.*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

const HEADING = /^(#{1,3})\s+(.*)$/

/** Titre `#` d'une page. */
export function pageTitle(markdown: string): string {
  for (const line of markdown.split('\n')) {
    const m = HEADING.exec(line)
    if (m?.[1] === '#') return plainText(m[2] ?? '')
  }
  return ''
}

/** Sections d'une page : l'introduction, puis une par titre `##` ou `###`. */
export function pageSections(page: string, markdown: string): GuideSection[] {
  const sections: GuideSection[] = []
  let current: GuideSection = { page, title: pageTitle(markdown), text: '' }
  let lines: string[] = []
  let pending: string | undefined
  let fence = false
  const close = () => {
    current.text = plainText(lines.join('\n'))
    if (current.text || current.anchor) sections.push(current)
  }
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence
    if (!fence) {
      const anchor = ANCHOR_LINE.exec(line)
      if (anchor) {
        pending = anchor[1]
        continue
      }
      const heading = HEADING.exec(line)
      if (heading && heading[1] !== '#') {
        close()
        current = { page, title: plainText(heading[2] ?? ''), text: '' }
        if (pending) current.anchor = pending
        pending = undefined
        lines = []
        continue
      }
      if (heading) continue
    }
    if (line.trim()) pending = undefined
    lines.push(line)
  }
  close()
  return sections
}

/** Sommaire : les groupes `##` du `README.md`, et les pages qu'ils listent, dans l'ordre. */
export function tableOfContents(readme: string, titles: Record<string, string>): TocGroup[] {
  const groups: TocGroup[] = []
  let group: TocGroup | undefined
  for (const line of readme.split('\n')) {
    const heading = /^##\s+(.*)$/.exec(line)
    if (heading) {
      group = { title: plainText(heading[1] ?? ''), pages: [] }
      groups.push(group)
      continue
    }
    const link = /^\s*(?:\d+\.|[-*])\s+\[[^\]]*\]\(([a-z0-9-]+)\.md\)/.exec(line)
    const page = link?.[1]
    if (group && page && titles[page] !== undefined) {
      group.pages.push({ page, title: titles[page] })
    }
  }
  return groups.filter((g) => g.pages.length > 0)
}

/**
 * Lignes réservées à GitHub, retirées dans l'app : entre `<!-- hors-app -->` et
 * `<!-- /hors-app -->` (le lien vers l'autre langue : l'app suit déjà la sienne).
 */
export const withoutGithubOnly = (markdown: string): string =>
  markdown.replace(/<!-- hors-app -->[\s\S]*?<!-- \/hors-app -->\n?/g, '')

/** Guide analysé à partir du texte de ses pages. */
export function parseGuide(lang: GuideLang, raw: Record<string, string>): Guide {
  const pages: Record<string, string> = {}
  for (const [page, text] of Object.entries(raw)) pages[page] = withoutGithubOnly(text)
  // Français : espace insécable avant « : ; ? ! » dans les titres et les extraits.
  const typo = lang === 'fr' ? frenchSpaces : (text: string) => text
  const titles: Record<string, string> = {}
  for (const [page, text] of Object.entries(pages)) titles[page] = typo(pageTitle(text))
  const toc = tableOfContents(pages[HOME_PAGE] ?? '', titles)
  return {
    lang,
    pages,
    titles,
    toc,
    sections: [
      ...Object.entries(pages)
        .filter(([page]) => page !== HOME_PAGE)
        .flatMap(([page, text]) => pageSections(page, text)),
      ...homeSections(pages[HOME_PAGE], toc)
    ].map((s) => {
      const title = typo(s.title)
      const text = typo(s.text)
      return {
        ...s,
        title,
        text,
        folded: { title: fold(title), page: fold(titles[s.page] ?? ''), text: fold(text) }
      }
    })
  }
}

/**
 * Sections de l'accueil cherchables : son introduction et ses notes (« Voir aussi » : l'aide, les
 * astuces, les nouveautés), qu'aucune autre page ne dit. Pas les groupes du sommaire : rien que
 * des liens vers les pages, ils feraient de l'accueil un résultat pour presque chaque mot. Mises
 * après les autres pages, elles passent derrière elles à score égal.
 */
function homeSections(readme: string | undefined, toc: readonly TocGroup[]): GuideSection[] {
  if (readme === undefined) return []
  const groups = new Set(toc.map((g) => g.title))
  return pageSections(HOME_PAGE, readme).filter((s) => s.anchor || !groups.has(s.title))
}

/** Groupe du sommaire où se trouve une page (pour le fil d'Ariane). */
export const groupOf = (guide: Guide, page: string): TocGroup | undefined =>
  guide.toc.find((g) => g.pages.some((p) => p.page === page))
