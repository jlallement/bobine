import { useEffect, useRef, useState } from 'react'
import { splitFilterLine, type FileRoot } from '@shared/files'

/** Attente après la dernière frappe avant de chercher (revue UX, point 8). */
export const FILTER_DELAY_MS = 80

/** Un fichier trouvé par le filtre : sa racine et son chemin relatif. */
export interface FilterHit {
  root: number
  path: string
  /** Invisible pour l'agent (fiche 155) : marqué comme dans l'arbre (M6). */
  excluded?: true
}

export type SearchRoot = (
  root: number,
  query: string
) => Promise<{ path: string; excluded?: true }[]>

/**
 * Filtre de l'onglet Fichiers (Q33) : une liste à plat, cherchée sur toutes les racines un instant
 * après la dernière frappe. Pendant une recherche, les derniers résultats restent affichés (ou
 * « Lecture… » s'il n'y en a pas encore) ; « aucun » n'est dit qu'après la réponse. Chaque recherche
 * porte un numéro : une réponse arrivée après une plus récente est jetée.
 */
export function useFileFilter(roots: readonly FileRoot[] | null, search: SearchRoot, refresh = 0) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ query: string; hits: FilterHit[] } | null>(null)
  const latest = useRef(0)
  const wanted = splitFilterLine(query)
  useEffect(() => {
    if (!wanted.query || !roots) return
    const ticket = ++latest.current
    const timer = setTimeout(() => {
      void Promise.all(
        roots.map((root) =>
          search(root.index, wanted.query)
            .then((found) => found.map((hit) => ({ ...hit, root: root.index })))
            .catch(() => [] as FilterHit[])
        )
      ).then((all) => {
        if (ticket === latest.current) setFound({ query: wanted.query, hits: all.flat() })
      })
    }, FILTER_DELAY_MS)
    return () => clearTimeout(timer)
    // `search` change à chaque rendu : la recherche ne dépend que de la saisie et des racines.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voir ci-dessus
  }, [roots, wanted.query, refresh])
  const active = !!wanted.query
  return {
    query,
    setQuery,
    /** Le filtre est en usage (texte tapé) : la liste remplace l'arbre. */
    active,
    /** Derniers résultats connus ; `null` tant qu'aucune réponse n'est arrivée. */
    hits: active ? (found?.hits ?? null) : null,
    /** Une réponse pour la saisie actuelle est attendue. */
    searching: active && found?.query !== wanted.query,
    /** Ligne demandée (`chemin:42`). */
    line: wanted.line
  }
}
