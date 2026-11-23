import type { ReactNode } from 'react'

const SLOT = '\u0000'

/**
 * Texte traduit dont une valeur (adresse du proxy, déjà masquée par le main) s'affiche en code :
 * la clé est rendue avec un repère à la place de la valeur, puis découpée autour de lui.
 */
export function withCode(render: (slot: string) => string, value: string): ReactNode[] {
  return render(SLOT)
    .split(SLOT)
    .flatMap((part, i) => (i === 0 ? [part] : [<code key={i}>{value}</code>, part]))
}
