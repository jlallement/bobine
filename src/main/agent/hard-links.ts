/**
 * Fichiers à plusieurs noms (liens physiques, fiche 230). Un fichier ordinaire dont le nombre de
 * liens (`nlink`) dépasse 1 est le même contenu qu'un autre nom, peut-être hors du dossier : y écrire
 * modifie aussi cet autre fichier, le lire lit cet autre fichier. `realpath` ne le voit pas (il n'y
 * a pas de lien à suivre) : seul `nlink` le dit.
 *
 * Un fichier absent, un dossier, un lien symbolique (`lstat`) ne sont pas concernés ici : les
 * règles qui les traitent sont ailleurs (`write-area.ts`, `permission-risk.ts`).
 */
import { lstatSync, type Stats } from 'node:fs'

/** Le `stat` d'un fichier ordinaire qui a d'autres noms. */
export const sharesContent = (stat: Pick<Stats, 'isFile' | 'nlink'>): boolean =>
  stat.isFile() && stat.nlink > 1

/** Le fichier `path` (sans suivre de lien symbolique) existe et a d'autres noms. */
export function hasOtherNames(path: string): boolean {
  try {
    return sharesContent(lstatSync(path))
  } catch {
    return false // Absent (à créer) ou illisible : rien à dire ici.
  }
}
