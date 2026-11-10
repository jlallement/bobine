import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { basename } from '../common/Menus'

/**
 * Sections et dossiers de la barre latérale (fiche 131) : un en-tête en petites capitales qui
 * replie sa section, et des dossiers (projets) qui se replient aussi ; chaque repli est gardé sur ce
 * poste. Une section vide n'est pas affichée : la barre latérale ne la rend pas.
 */

/** Préférences d'affichage propres à ce poste (stockage local, facultatif). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Stockage indisponible : le choix vaut pour cette session.
  }
}

/**
 * Liste de ce qui est replié (sections, dossiers), gardée sous `key`. `toggle` replie ou déplie ;
 * `isFolded` lit l'état.
 */
export function useFoldedSet(key: string): {
  isFolded: (id: string) => boolean
  toggle: (id: string) => void
  unfold: (ids: readonly string[]) => void
} {
  const [folded, setFolded] = useState<string[]>(() => {
    const value = readLocal<unknown>(key, [])
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  })
  const unfold = useCallback(
    (ids: readonly string[]) => {
      setFolded((current) => {
        const next = current.filter((id) => !ids.includes(id))
        if (next.length === current.length) return current
        writeLocal(key, next)
        return next
      })
    },
    [key]
  )
  return {
    unfold,
    isFolded: (id) => folded.includes(id),
    toggle: (id) => {
      const next = folded.includes(id) ? folded.filter((f) => f !== id) : [...folded, id]
      setFolded(next)
      writeLocal(key, next)
    }
  }
}

/**
 * Section repliable : l'en-tête (son nom, puis le chevron, puis ses outils, le filtre de Récents)
 * et ses lignes. Le chevron vient avant les outils : le filtre garde sa place, sur la verticale des
 * états des lignes, quand le chevron apparaît au survol.
 */
export function SidebarSection({
  id,
  label,
  folded,
  onToggle,
  tools,
  testId,
  toggleTestId,
  children
}: {
  id: string
  label: string
  folded: boolean
  onToggle: () => void
  tools?: ReactNode
  testId?: string
  toggleTestId?: string
  children: ReactNode
}) {
  return (
    <section
      className={`sidebar-group${folded ? ' folded' : ''}`}
      data-section={id}
      data-testid={testId}
    >
      <div className="sidebar-section">
        <button
          className="section-toggle"
          onClick={onToggle}
          aria-expanded={!folded}
          data-testid={toggleTestId ?? `section-toggle-${id}`}
        >
          <span className="section-label">{label}</span>
          <span className="section-chevron" aria-hidden>
            {folded ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
        {tools}
      </div>
      {!folded && children}
    </section>
  )
}

/**
 * Dossier du mode « Dossiers » : le nom du projet en gras, le chevron juste après lui, sans icône ni
 * compteur ; replié, seul le nom reste.
 */
export function FolderGroup({
  project,
  folded,
  onToggle,
  children
}: {
  project: string
  folded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={`folder-group${folded ? ' folded' : ''}`} data-testid="folder-group">
      <button
        className="folder-head"
        onClick={onToggle}
        aria-expanded={!folded}
        title={project}
        data-testid="folder-head"
      >
        <span className="label">{basename(project)}</span>
        {folded ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>
      {!folded && children}
    </div>
  )
}
