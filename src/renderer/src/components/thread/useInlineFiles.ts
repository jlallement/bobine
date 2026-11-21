import { useContext, useEffect, useRef, useState } from 'react'
import { FileExistsContext, FileLinkBase, type CheckFileLinks } from './FileLink'

/**
 * Code en ligne qui désigne un fichier (fiche 272, recette de la rc.3) : un lien seulement si le
 * fichier existe dans le dossier de la conversation. Le rendu collecte les chemins candidats
 * (`want`) ; après lui, un seul appel groupé demande ceux qu'on ne connaît pas encore. Tant qu'on
 * ne sait pas, le code reste du code (`isFile` : `undefined`).
 *
 * Fichiers trouvés retenus par vérificateur (une conversation) : un message rendu de nouveau (fil
 * rouvert, conversation reprise) les montre en liens d'emblée, sans passer par du code. Un fichier
 * absent est redemandé à chaque nouveau rendu du message : il a pu être créé depuis.
 */

/** Chemins demandés par appel (même borne que le main). */
const MAX_ASKED = 200
/** Réponse en cours : on attend une pause du flux plutôt que de demander à chaque morceau. */
const STREAMING_DELAY_MS = 300
/** Fichiers trouvés retenus par conversation ; au-delà, on repart de zéro. */
const MAX_REMEMBERED = 2000

const found = new WeakMap<CheckFileLinks, Set<string>>()

const keyOf = (base: string | undefined, href: string) => `${base ?? ''}\0${href}`

function remember(check: CheckFileLinks, keys: readonly string[]): void {
  let known = found.get(check)
  if (!known || known.size + keys.length > MAX_REMEMBERED) {
    known = new Set()
    found.set(check, known)
  }
  for (const key of keys) known.add(key)
}

/** Chemins candidats d'un rendu. */
class Wanted {
  private hrefs = new Set<string>()
  reset(): void {
    this.hrefs = new Set()
  }
  readonly add = (href: string): void => {
    this.hrefs.add(href)
  }
  list(): string[] {
    return [...this.hrefs]
  }
}

export interface InlineFiles {
  /** Vrai : le fichier existe ; faux : non ; `undefined` : pas encore su (ou personne à qui demander). */
  isFile: (href: string) => boolean | undefined
  /** Chemin candidat vu par ce rendu. */
  want: (href: string) => void
}

export function useInlineFiles(streaming: boolean): InlineFiles {
  const check = useContext(FileExistsContext)
  const base = useContext(FileLinkBase)
  const [answers, setAnswers] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const asked = useRef(new Set<string>())
  // Rempli par le rendu en cours (plugin rehype), lu par l'effet qui le suit.
  const [wanted] = useState(() => new Wanted())
  wanted.reset()
  const isFile = (href: string): boolean | undefined => {
    const answer = answers.get(href)
    if (answer !== undefined) return answer
    return check && found.get(check)?.has(keyOf(base, href)) ? true : undefined
  }
  useEffect(() => {
    if (!check) return
    const ask = wanted
      .list()
      .filter((href) => isFile(href) === undefined && !asked.current.has(href))
      .slice(0, MAX_ASKED)
    if (ask.length === 0) return
    const timer = setTimeout(
      () => {
        for (const href of ask) asked.current.add(href)
        check(ask, base)
          .then((existing) => {
            const yes = new Set(existing)
            remember(
              check,
              existing.map((href) => keyOf(base, href))
            )
            setAnswers((previous) => {
              const next = new Map(previous)
              for (const href of ask) next.set(href, yes.has(href))
              return next
            })
          })
          // Vérification impossible : le code reste du code, redemandé au prochain rendu.
          .catch(() => {
            for (const href of ask) asked.current.delete(href)
          })
      },
      streaming ? STREAMING_DELAY_MS : 0
    )
    return () => clearTimeout(timer)
  })
  return { isFile, want: wanted.add }
}
