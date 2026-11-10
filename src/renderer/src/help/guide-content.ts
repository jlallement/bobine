/**
 * Contenu du guide embarqué au build (fiche 186) : Vite intègre le texte des pages et les images
 * de `docs/guide/`. Les pages d'une langue forment un morceau chargé à la demande : seule la
 * fenêtre d'aide le charge. Le renderer ne lit jamais le disque.
 */
import { parseGuide, type Guide, type GuideLang } from './guide'

const PAGE_LOADERS = import.meta.glob<string>('../../../../docs/guide/*/*.md', {
  query: '?raw',
  import: 'default'
})

/** Adresses des images du guide, par clé `fr/nom.png` (fichiers copiés par Vite). */
const IMAGE_URLS = import.meta.glob<string>('../../../../docs/guide/images/*/*.png', {
  query: '?url',
  import: 'default',
  eager: true
})

export const GUIDE_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_URLS).map(([path, url]) => [path.replace(/^.*\/images\//, ''), url])
)

/** Pages d'une langue, par nom de fichier sans `.md`. */
export async function loadGuidePages(lang: GuideLang): Promise<Record<string, string>> {
  const prefix = `../../../../docs/guide/${lang}/`
  const entries = await Promise.all(
    Object.entries(PAGE_LOADERS)
      .filter(([path]) => path.startsWith(prefix))
      .map(async ([path, load]) => [path.slice(prefix.length, -'.md'.length), await load()])
  )
  return Object.fromEntries(entries) as Record<string, string>
}

const cache = new Map<GuideLang, Promise<Guide>>()

/** Guide analysé d'une langue, gardé une fois chargé. */
export function loadGuide(lang: GuideLang): Promise<Guide> {
  let guide = cache.get(lang)
  if (!guide) {
    guide = loadGuidePages(lang).then((pages) => parseGuide(lang, pages))
    cache.set(lang, guide)
  }
  return guide
}
