import { useContext, useEffect, useState } from 'react'
import { FileExistsContext, FileLinkBase } from './FileLink'
import type { FileChecks } from './file-checks'

/**
 * Code en ligne qui désigne un fichier (fiche 272, recette de la rc.3) : un lien seulement si le
 * fichier existe dans le dossier de la conversation. Le rendu collecte les chemins candidats
 * (`want`) ; après lui, ceux qu'on ne connaît pas sont demandés à la mémoire de la conversation
 * (`FileChecks`), qui groupe les demandes. Tant qu'on ne sait pas, le code reste du code.
 */

/** Réponse en cours : on attend une pause du flux plutôt que de demander à chaque morceau. */
export const STREAMING_DELAY_MS = 300

/** Chemins candidats d'un message, et l'état de chacun tel que son dernier rendu l'a montré. */
class Candidates {
  private rendering = new Map<string, boolean | undefined>()
  private shown: string[] = []
  private signature = ''
  /** Écouteur de la mémoire pour ce message (posé par son abonnement). */
  private listener: (() => void) | undefined
  listen(listener: (() => void) | undefined): void {
    this.listener = listener
  }
  /** Après le rendu, l'écouteur revérifie : une réponse a pu arriver entre-temps. */
  wake(): void {
    if (this.listener) queueMicrotask(this.listener)
  }
  /** Nouveau rendu : la liste repart de zéro (remplie par le plugin rehype). */
  reset(): void {
    this.rendering = new Map()
  }
  readonly add = (href: string): void => {
    if (!this.rendering.has(href)) this.rendering.set(href, undefined)
  }
  /** État lu par le rendu, retenu pour savoir plus tard s'il a changé. */
  seen(href: string, status: boolean | undefined): boolean | undefined {
    this.rendering.set(href, status)
    return status
  }
  /** Après le rendu : la liste affichée, et ce que le rendu en a montré (lien ou non). */
  commit(): string[] {
    this.shown = [...this.rendering.keys()]
    this.signature = Candidates.sign([...this.rendering.values()])
    return this.shown
  }
  /** Un chemin affiché est-il devenu un lien, ou a-t-il cessé de l'être, depuis le dernier rendu ? */
  changed(read: (href: string) => boolean | undefined): boolean {
    const next = Candidates.sign(this.shown.map(read))
    if (next === this.signature) return false
    this.signature = next
    return true
  }
  /** Seul l'affichage compte : un « non » revérifié qui reste « non » ne refait aucun rendu. */
  private static sign(statuses: Array<boolean | undefined>): string {
    return statuses.map((status) => (status === true ? '1' : '0')).join('')
  }
}

export interface InlineFiles {
  /** Vrai : le fichier existe ; faux : non ; `undefined` : pas encore su (ou personne à qui demander). */
  isFile: (href: string) => boolean | undefined
  /** Chemin candidat vu par ce rendu. */
  want: (href: string) => void
  /** Lien cliqué vers un fichier introuvable (fiche 272, D2) : barré. */
  isGone: (href: string) => boolean
}

export function useInlineFiles(streaming: boolean): InlineFiles {
  const checks: FileChecks | null = useContext(FileExistsContext)
  const base = useContext(FileLinkBase)
  const [candidates] = useState(() => new Candidates())
  const [, rerender] = useState(0)
  candidates.reset()
  // Un nouveau rendu seulement quand l'un des chemins de ce message change d'état.
  useEffect(() => {
    if (!checks) return
    const read = (href: string) => checks.status(base, href)
    const listener = () => {
      if (candidates.changed(read)) rerender((n) => n + 1)
    }
    candidates.listen(listener)
    const off = checks.subscribe(listener)
    return () => {
      off()
      candidates.listen(undefined)
    }
  }, [checks, base, candidates])
  useEffect(() => {
    if (!checks) return
    const read = (href: string) => checks.status(base, href)
    const shown = candidates.commit()
    // Réponse arrivée entre le rendu et ici : l'écouteur le voit, et refait le rendu.
    candidates.wake()
    const ask = shown.filter((href) => read(href) === undefined)
    if (ask.length === 0) return
    if (!streaming) {
      checks.request(base, ask)
      return
    }
    const timer = setTimeout(() => checks.request(base, ask), STREAMING_DELAY_MS)
    return () => clearTimeout(timer)
  })
  return {
    isFile: (href) => candidates.seen(href, checks?.status(base, href)),
    want: candidates.add,
    isGone: (href) => checks?.gone(base, href) === true
  }
}
