/**
 * Liens des pages du guide (fiche 186). Ce sont des liens relatifs, écrits pour GitHub ; dans
 * l'app, chacun devient : une page de l'aide (même langue ou l'autre), les Nouveautés, ou une
 * adresse `https` ouverte dans le navigateur du système. Tout le reste est désactivé.
 */
import { REPOSITORY_URL } from '@shared/issue-url'
import type { GuideLang } from './guide'

export type GuideLink =
  | { kind: 'page'; lang: GuideLang; page: string; anchor?: string }
  | { kind: 'changelog' }
  | { kind: 'external'; url: string }
  | { kind: 'none' }

/** Base fictive : sert seulement à résoudre les chemins relatifs comme le ferait GitHub. */
const BASE = 'https://guide.invalid/'

export function resolveGuideLink(href: string, lang: GuideLang, page: string): GuideLink {
  if (/^https?:\/\//i.test(href)) return { kind: 'external', url: href }
  // Pas d'autre schéma (`javascript:`, `file:`, `mailto:`…), ni de chemin absolu.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) return { kind: 'none' }
  let url: URL
  try {
    url = new URL(href, `${BASE}docs/guide/${lang}/${page}.md`)
  } catch {
    return { kind: 'none' }
  }
  if (url.origin !== new URL(BASE).origin) return { kind: 'none' }
  let anchor: string | undefined
  try {
    anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
  } catch {
    // `%` mal formé : pas d'ancre plutôt qu'une erreur au rendu de la page.
    anchor = undefined
  }
  const guidePage = /^\/docs\/guide\/(fr|en)\/([a-z0-9-]+|README)\.md$/.exec(url.pathname)
  if (guidePage) {
    return {
      kind: 'page',
      lang: guidePage[1] as GuideLang,
      page: guidePage[2] ?? page,
      ...(anchor ? { anchor } : {})
    }
  }
  if (/^\/CHANGELOG(\.en)?\.md$/.test(url.pathname)) return { kind: 'changelog' }
  // Un autre fichier du dépôt (installation…) : sur GitHub.
  if (/^\/[\w./-]+$/.test(url.pathname) && !url.pathname.includes('..')) {
    return { kind: 'external', url: `${REPOSITORY_URL}/blob/main${url.pathname}${url.hash}` }
  }
  return { kind: 'none' }
}

/** Clé d'une image du guide (`fr/accueil.png`) depuis son chemin relatif dans une page. */
export function guideImageKey(src: string, lang: GuideLang, page: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/')) return undefined
  try {
    const url = new URL(src, `${BASE}docs/guide/${lang}/${page}.md`)
    return /^\/docs\/guide\/images\/((?:fr|en)\/[\w.-]+\.png)$/.exec(url.pathname)?.[1]
  } catch {
    return undefined
  }
}
