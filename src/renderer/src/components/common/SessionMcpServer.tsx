/**
 * Un serveur MCP de l'agent dans le menu « Réglages de la session » (fiches 060 et 293), en
 * lecture seule : pastille et une ligne d'état. Un serveur ordinaire montre le résultat de
 * « Tester » ; un serveur que l'agent connecte lui-même (`authPreset`) n'est jamais testé par
 * Bobine : il montre l'état de sa connexion (mêmes clés et même magasin que Réglages › Serveurs
 * MCP), et tant qu'il n'est pas connu un libellé neutre et vrai, jamais « pas encore testé ».
 */
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { useTranslation } from 'react-i18next'
import type { McpAuthState, McpServerEntry } from '@shared/mcp'
import { mcpKey, mcpStatus } from '../../mcp-status'
import { McpAuthDot, dotOf } from '../settings/McpAuth'
import { McpDot } from '../settings/McpSettings'

export function SessionMcpServer({
  profileId,
  agent,
  server,
  auth,
  onOpen
}: {
  profileId: string
  /** Nom de l'agent (« connexion par OpenCode »). */
  agent: string
  server: McpServerEntry
  /**
   * États de connexion lus à l'ouverture du menu (gardés tels quels tant qu'il est ouvert : il ne
   * change pas de taille sous le pointeur, fiche 234) ; `undefined` : pas (encore) connus.
   */
  auth: Record<string, McpAuthState> | undefined
  onOpen: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const scope =
    server.scope === 'global' ? t('sessionSettings.mcp.global') : t('sessionSettings.mcp.folder')
  if (server.authPreset) {
    const state = auth?.[server.name]
    const dot = dotOf(server, state)
    return (
      <Dropdown.Item
        className="menu-item"
        onSelect={() => onOpen?.()}
        data-testid="session-mcp"
        data-state={dot.state}
        data-auth={state?.status ?? 'unknown'}
      >
        <span className="menu-icon session-mcp-dot">
          <McpAuthDot server={server} state={state} />
        </span>
        <span className="menu-text">
          <div className="menu-title">{server.name}</div>
          <div className="menu-desc">
            {!server.enabled
              ? t('sessionSettings.mcp.disabled')
              : state
                ? t(`mcp.state.${dot.label}`)
                : t('sessionSettings.mcp.agentAuth', { agent })}
            {' · '}
            {scope}
          </div>
        </span>
      </Dropdown.Item>
    )
  }
  const status = mcpStatus(mcpKey(profileId, server))
  return (
    <Dropdown.Item
      className="menu-item"
      onSelect={() => onOpen?.()}
      title={
        status && status !== 'testing'
          ? status.ok
            ? t('sessionSettings.mcp.toolsTip', { tools: status.tools.join(', ') })
            : status.error
          : undefined
      }
      data-testid="session-mcp"
      data-state={
        !server.enabled
          ? 'off'
          : status === undefined || status === 'testing'
            ? 'testing'
            : status.ok
              ? 'ok'
              : 'error'
      }
    >
      <span className="menu-icon session-mcp-dot">
        <McpDot server={server} status={status} />
      </span>
      <span className="menu-text">
        <div className="menu-title">{server.name}</div>
        <div className="menu-desc">
          {!server.enabled
            ? t('sessionSettings.mcp.disabled')
            : status === undefined || status === 'testing'
              ? t('sessionSettings.mcp.testing')
              : status.ok
                ? t('sessionSettings.mcp.tools', { count: status.tools.length })
                : t('sessionSettings.mcp.error')}
          {' · '}
          {scope}
        </div>
      </span>
    </Dropdown.Item>
  )
}
