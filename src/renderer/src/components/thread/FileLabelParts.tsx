import { useLayoutEffect, useRef, useState } from 'react'
import type { LabelFile } from '@shared/tool-label'
import { useDisplayText } from '../../presentation'

/**
 * Un seul observateur de taille pour toutes les lignes d'outil (un fil peut en compter des
 * centaines) : chaque ligne y inscrit son rappel.
 */
const callbacks = new WeakMap<Element, () => void>()
let observer: ResizeObserver | undefined
function observe(element: Element, callback: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) callbacks.get(entry.target)?.()
  })
  callbacks.set(element, callback)
  observer.observe(element)
  return () => {
    callbacks.delete(element)
    observer?.unobserve(element)
  }
}

/** Largeur gardée au dossier coupé : de quoi montrer « …/ » (voir `.tool-file-dir`). */
const STUB_EM = 1

/**
 * Libellé d'un outil de fichier sur la ligne d'outil (fiche 203, correctif de recette) : le texte,
 * puis le dossier, coupé en premier et par le début (`rtl`, texte isolé en LTR comme l'en-tête du
 * diff), réduit au plus à « …/ », puis le nom. Quand le nom ne tient qu'en effaçant aussi « …/ »,
 * le dossier n'est pas affiché du tout (jamais un « / » seul, qu'on lirait comme un chemin
 * absolu) : l'extension reste visible. Le nom n'est coupé (à la fin) que s'il ne tient pas seul.
 * Mesure : largeur de la ligne, largeurs naturelles du texte et du nom (`scrollWidth`) ; avant la
 * mise en page (essais sans rendu), le dossier reste affiché. Chemin entier en infobulle (ligne).
 */
export function FileLabelParts({ file }: { file: LabelFile }) {
  const show = useDisplayText()
  const name = useRef<HTMLSpanElement>(null)
  const [noDir, setNoDir] = useState(false)
  useLayoutEffect(() => {
    const label = name.current?.parentElement
    const title = label?.parentElement
    if (!file.dir || !label || !title) return
    const measure = () => {
      const width = title.clientWidth
      const nameWidth = name.current?.scrollWidth ?? 0
      if (width === 0 || nameWidth === 0) return setNoDir(false)
      const text = [...label.querySelectorAll('.tool-file-text')].reduce(
        (sum, e) => sum + e.scrollWidth,
        0
      )
      const stub = STUB_EM * parseFloat(getComputedStyle(label).fontSize || '13')
      setNoDir(text + nameWidth + stub > width + 0.5)
    }
    measure()
    return observe(title, measure)
  }, [file.dir, file.name, file.before, file.after])
  return (
    <>
      {file.before && <span className="tool-file-text">{show(file.before)}</span>}
      {file.dir && !noDir && (
        <span className="tool-file-dir">
          <bdi dir="ltr">{show(file.dir)}</bdi>
        </span>
      )}
      <span className="tool-file-name" data-testid="tool-label-name" ref={name}>
        {file.name}
      </span>
      {file.after && <span className="tool-file-text">{show(file.after)}</span>}
    </>
  )
}
