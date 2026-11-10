import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AlwaysScope } from '@shared/agent'
import { visibleText } from '@shared/command-view'
import type { PermissionRisk } from '@shared/permissions'

/**
 * Bandeau d'une carte d'autorisation à risque (fiche 211, maquette validée) : une ligne par risque
 * repéré par le main (écriture hors du dossier, fichier caché du dossier personnel, dossier du
 * système, droits d'administrateur). Lu avant les boutons. Un avertissement : son absence ne dit
 * jamais que l'appel est sûr, et aucune phrase ne le prétend.
 */
export function PermissionRisks({ risks }: { risks: readonly PermissionRisk[] }) {
  const { t } = useTranslation()
  if (risks.length === 0) return null
  return (
    <div className="pc-risks" role="note" data-testid="permission-risks">
      <TriangleAlert size={15} className="pc-risks-icon" aria-hidden />
      <ul>
        {risks.map((risk) => (
          <li
            key={
              risk.kind === 'privilege' ? `${risk.kind}:${risk.via}` : `${risk.kind}:${risk.path}`
            }
          >
            {risk.kind === 'privilege' ? (
              t('toolCall.permission.risk.privilege', { via: risk.via })
            ) : (
              <>
                {t(`toolCall.permission.risk.${riskKey(risk.kind)}`)}{' '}
                <code>{visibleText(risk.path)}</code>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const RISK_KEYS = {
  'outside-folder': 'outside',
  'home-dotfile': 'dotfile',
  'system-path': 'system'
} as const satisfies Record<Exclude<PermissionRisk['kind'], 'privilege'>, string>

const riskKey = (kind: Exclude<PermissionRisk['kind'], 'privilege'>) => RISK_KEYS[kind]

/**
 * Sous les boutons d'une carte ordinaire où l'agent offre « Toujours autoriser » pour un outil que
 * l'app ne retient pas elle-même (commande, écriture) : la portée de « toujours » est celle de
 * l'agent, pas de Bobine (fiche 211).
 */
/**
 * Précision tirée du profil de l'agent (fiche 214) : ce que couvre son « Toujours », par genre
 * d'outil. Rien pour un genre que le profil ne déclare pas : on ne devine pas.
 */
export function AlwaysScopeNote({
  scope,
  kind,
  agent
}: {
  scope: AlwaysScope
  kind: string | undefined
  agent: string
}) {
  const { t } = useTranslation()
  const key = scopeKey(kind)
  if (!key || !scope.covers[key]) return null
  // Le nom de l'agent en gras, le reste tel quel (maquette 214-2) : une seule note.
  const [before = '', after = ''] = t(`toolCall.permission.alwaysScope.${key}`, {
    agent: AGENT_MARK
  }).split(AGENT_MARK)
  return (
    <div className="pc-note" data-testid="permission-always-scope">
      {before}
      <strong>{agent}</strong>
      {after}
    </div>
  )
}

/** Marque du nom de l'agent dans la note de portée, remplacée par son nom en gras. */
const AGENT_MARK = '\u0000'

const scopeKey = (kind: string | undefined) =>
  kind === 'execute' ? 'execute' : kind === 'edit' ? 'edit' : undefined

/** La portée déclarée par le profil dit-elle ce que couvre « toujours » pour ce genre ? */
export const scopeCovers = (scope: AlwaysScope, kind: string | undefined): boolean => {
  const key = scopeKey(kind)
  return !!key && !!scope.covers[key]
}

export function AgentAlwaysNote() {
  const { t } = useTranslation()
  return (
    <div className="pc-note" data-testid="permission-agent-always-note">
      {t('toolCall.permission.agentAlwaysNote')}
    </div>
  )
}
