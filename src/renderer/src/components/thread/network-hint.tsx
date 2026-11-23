import type { ReactNode } from 'react'

const SLOT = '\u0000'

/**
 * Texte traduit dont une valeur (adresse du proxy, déjà masquée par le main) s'affiche en code :
 * la clé est rendue avec un repère à la place de la valeur, puis découpée autour de lui.
 * L'adresse ne se coupe jamais (fiche 276, T5) : d'une seule pièce avec ce qui la colle de part et
 * d'autre (« ( » et « ) »), « … » si elle ne tient pas, entière en infobulle.
 */
export function withCode(render: (slot: string) => string, value: string): ReactNode[] {
  const parts = render(SLOT).split(SLOT)
  const out: ReactNode[] = []
  let before = parts[0] ?? ''
  for (let i = 1; i < parts.length; i++) {
    const glued = /\S*$/.exec(before)?.[0] ?? ''
    const part = parts[i] ?? ''
    const after = /^\S*/.exec(part)?.[0] ?? ''
    out.push(
      before.slice(0, before.length - glued.length),
      <span className="network-addr" key={i}>
        {glued}
        <code title={value}>{value}</code>
        {after}
      </span>
    )
    before = part.slice(after.length)
  }
  out.push(before)
  return out.filter((node) => node !== '')
}
