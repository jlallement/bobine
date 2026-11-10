import type { ReactNode } from 'react'

/** Texte avec des passages surlignés (commandes à exécuter repérées, fiche 182). */
export function Highlighted({ text, passages }: { text: string; passages: [number, number][] }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of passages) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark key={start} className="memory-command" data-testid="memory-command">
        {text.slice(start, end)}
      </mark>
    )
    at = end
  }
  parts.push(text.slice(at))
  return <>{parts}</>
}
