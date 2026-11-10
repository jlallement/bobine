import { useState, type ReactNode } from 'react'

/**
 * `<details>` dont le contenu n'est rendu qu'à la première ouverture (fiche 192). Un fil compte des
 * centaines de cartes repliées (diffs, sorties de commandes) : les rendre toutes à l'ouverture de
 * la conversation coûtait des secondes et des centaines de milliers de nœuds, pour un contenu que
 * personne n'a déplié. Une fois ouvert, le contenu reste rendu (refermer ne perd rien : remarque
 * en cours, défilement d'une sortie). La recherche dans le fil ne voyait déjà pas le détail replié.
 */
export function LazyDetails({
  className,
  summary,
  children
}: {
  className?: string
  summary: ReactNode
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  return (
    <details
      className={className}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      {summary}
      {opened && children}
    </details>
  )
}
