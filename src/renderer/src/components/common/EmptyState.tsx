import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * État vide commun (fiche 185, idée P10) : une icône, un titre, une phrase, une action. Partout
 * pareil, pour qu'un écran sans contenu ait l'air fini plutôt que cassé.
 */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  accent = false,
  level,
  testId
}: {
  icon: LucideIcon
  title: string
  text?: ReactNode
  action?: ReactNode
  /** Icône à la couleur d'accent : un vide qui invite à commencer (pas un résultat manqué). */
  accent?: boolean
  /** Niveau du titre dans la page : sous un titre de niveau 2, un vide est de niveau 3. */
  level: 2 | 3
  testId?: string
}) {
  return (
    <div className="empty-state" data-testid={testId}>
      <Icon size={26} className={accent ? 'empty-state-icon accent' : 'empty-state-icon'} />
      {level === 2 ? (
        <h2 className="empty-state-title">{title}</h2>
      ) : (
        <h3 className="empty-state-title">{title}</h3>
      )}
      {text && <p className="empty-state-text">{text}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
