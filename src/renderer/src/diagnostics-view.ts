/**
 * Diagnostic (fiche 061), côté interface : groupe des serveurs MCP (tests de la fiche 060), groupes
 * d'attente, ordre d'affichage.
 */
import type { DiagnosticCheck, DiagnosticGroup } from '@shared/diagnostics'
import type { McpAgentView } from '@shared/mcp'
import { mcpKey, type McpStatus } from './mcp-status'
import { t } from 'i18next'

/** L'erreur en une ligne (voir `McpSettings`). */
type Summarize = (error: string) => string

/** Serveurs MCP des agents installés : état de chaque serveur activé. */
export function mcpGroup(
  views: readonly McpAgentView[] | 'loading' | 'error',
  status: (key: string) => McpStatus | undefined,
  summarize: Summarize
): DiagnosticGroup {
  const group = (checks: DiagnosticCheck[]): DiagnosticGroup => ({
    id: 'mcp',
    title: t('diagnostics.group.mcp'),
    checks
  })
  if (views === 'loading') {
    return group([
      {
        id: 'list',
        label: t('diagnostics.mcp.servers'),
        level: 'pending',
        detail: t('diagnostics.mcp.reading')
      }
    ])
  }
  if (views === 'error') {
    return group([
      {
        id: 'list',
        label: t('diagnostics.mcp.servers'),
        level: 'warning',
        detail: t('diagnostics.mcp.unreadable'),
        action: 'open-mcp-settings'
      }
    ])
  }
  const checks: DiagnosticCheck[] = []
  for (const view of views) {
    if (view.error) {
      checks.push({
        id: `${view.profileId}:file`,
        label: t('diagnostics.mcp.file', { agent: view.label }),
        level: 'warning',
        detail: view.error,
        fix: t('diagnostics.mcp.fileFix'),
        action: 'open-mcp-settings'
      })
    }
    for (const server of view.servers) {
      const label = t(
        server.scope === 'project'
          ? 'diagnostics.mcp.serverFolder'
          : 'diagnostics.mcp.serverGlobal',
        { name: server.name, agent: view.label }
      )
      const id = mcpKey(view.profileId, server)
      const result = status(id)
      if (!server.enabled) {
        checks.push({ id, label, level: 'optional', detail: t('diagnostics.mcp.disabled') })
      } else if (result === undefined || result === 'testing') {
        checks.push({ id, label, level: 'pending', detail: t('diagnostics.mcp.testing') })
      } else if (result.ok) {
        const name = result.server
          ? `${result.server.name}${result.server.version ? ` ${result.server.version}` : ''} · `
          : ''
        checks.push({
          id,
          label,
          level: 'ok',
          detail: `${name}${t('diagnostics.mcp.tools', { count: result.tools.length })}`
        })
      } else {
        checks.push({
          id,
          label,
          level: 'error',
          detail: summarize(result.error),
          fix: t('diagnostics.mcp.errorFix'),
          action: 'open-mcp-settings'
        })
      }
    }
  }
  if (checks.length === 0) {
    checks.push({
      id: 'none',
      label: t('diagnostics.mcp.servers'),
      level: 'optional',
      detail: t('diagnostics.mcp.none'),
      action: 'open-mcp-settings'
    })
  }
  return group(checks)
}

/** Groupe d'un agent pendant son essai. */
export function pendingAgentGroup(profileId: string, label: string): DiagnosticGroup {
  return {
    id: `agent:${profileId}`,
    title: label,
    checks: [
      {
        id: 'start',
        label: t('diagnostics.view.starting'),
        level: 'pending',
        detail: t('diagnostics.view.trialRunning')
      }
    ]
  }
}

/** Groupes de l'app pendant leur vérification. */
export function pendingSystem(): DiagnosticGroup[] {
  return [
    {
      id: 'app',
      title: 'Bobine',
      checks: [
        {
          id: 'version',
          label: t('diagnostics.view.version'),
          level: 'pending',
          detail: t('diagnostics.view.checking')
        }
      ]
    }
  ]
}

/** Groupe des fournisseurs de modèles (fiche 104) pendant leur test. */
export function pendingProvidersGroup(): DiagnosticGroup {
  return {
    id: 'providers',
    title: t('diagnostics.group.providers'),
    checks: [
      {
        id: 'list',
        label: t('diagnostics.providers.label'),
        level: 'pending',
        detail: t('diagnostics.mcp.testing')
      }
    ]
  }
}

const ORDER = ['app', 'environment', 'agent:', 'mcp', 'providers', 'ios', 'android']

/**
 * Ordre d'affichage : l'app, l'environnement, les agents (ordre des profils), MCP, fournisseurs de
 * modèles, simulateurs.
 */
export function orderGroups(groups: readonly DiagnosticGroup[]): DiagnosticGroup[] {
  const rank = (id: string) => {
    const i = ORDER.findIndex((prefix) =>
      prefix.endsWith(':') ? id.startsWith(prefix) : id === prefix
    )
    return i === -1 ? ORDER.length : i
  }
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group.id) - rank(b.group.id) || a.index - b.index)
    .map(({ group }) => group)
}
