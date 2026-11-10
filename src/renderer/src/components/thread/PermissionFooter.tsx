import { useContext, type MouseEvent, type ReactNode } from 'react'
import type { ToolPermission } from '@shared/permissions'
import type { TranscriptItem } from '@shared/transcript'
import { GlobalRuleSection } from './GlobalRuleSection'
import { AgentCardContext } from './agent-card-context'

/**
 * Pied d'une carte d'autorisation EN ATTENTE, sous la note de portée de « Toujours » (fiche 214).
 * Y vit la section « Pour tous les projets » de la carte de commande de Bob (fiche 215, composant
 * `GlobalRuleSection`) : seulement pour une commande, absente d'une carte à risque. Le pied ne
 * change ni les boutons ni la réponse de la carte.
 */
export function PermissionFooter({
  item,
  permission,
  command,
  risky,
  accepts,
  onRespond
}: {
  item: Extract<TranscriptItem, { kind: 'tool' }>
  permission: ToolPermission
  command: string | undefined
  risky: boolean
  accepts: (event: MouseEvent) => boolean
  onRespond: (requestId: string, optionId: string | null) => void
}): ReactNode {
  const agent = useContext(AgentCardContext)
  if (item.toolKind !== 'execute') return null
  return (
    <GlobalRuleSection
      command={command}
      permission={permission}
      risky={risky}
      accepts={accepts}
      onRespond={onRespond}
      alwaysScoped={agent?.alwaysScope !== undefined}
    />
  )
}
