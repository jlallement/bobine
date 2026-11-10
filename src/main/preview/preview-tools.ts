/**
 * Outils « lancer l'app » (fiche 030) : l'agent démarre le serveur de dev du projet par son nom,
 * l'ouvre dans le navigateur intégré et lit ses journaux. Comme `preview_*` de Claude Code.
 */
import { basename } from 'node:path'
import { siteToApprove } from '@shared/browser'
import {
  commandLine,
  LAUNCH_FILES,
  LAUNCH_FORMAT_HELP,
  launches,
  type LaunchConfig
} from '@shared/launch'
import type { AppTool, AppToolModule, ToolContext, ToolResult } from '../mcp/tools'
import { panelToolFactory, textResult } from '../mcp/tools'
import type { CommandMemory } from '../approvals'
import { approveCommand } from '../mcp/command-approval'
import { readLaunchConfigs, type DevServers } from './dev-servers'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'

/**
 * Attente maximale dans un appel d'outil : Bob abandonne un appel au bout d'environ 60 s. Au-delà,
 * l'outil répond « encore en cours » et l'agent le rappelle (le travail continue en fond).
 */
export const TOOL_BUDGET_MS = 40_000

export interface PreviewToolsOptions {
  servers: DevServers
  /** Ouvre l'adresse dans le navigateur intégré de la conversation. */
  openInBrowser: (conversationId: string, url: string) => Promise<void>
  /** Remplaçable pour les tests. */
  budgetMs?: number
  /** Lecture du fichier de lancement (remplaçable pour les tests). */
  readConfigs?: typeof readLaunchConfigs
  /** Commandes « toujours » lancées dans un dossier (fiche 072). */
  always?: CommandMemory
}

export function previewToolsModule(options: PreviewToolsOptions): AppToolModule {
  /** Commandes déjà acceptées par l'utilisateur (dossier + commande), pour la session de l'app. */
  const approved = new Set<string>()
  return {
    id: 'preview',
    about: {
      title: 'appToolFamilies.preview.title',
      summary: 'appToolFamilies.preview.summary',
      condition: 'appToolFamilies.always',
      // `preview_start` : la première fois qu'une commande est lancée dans ce dossier.
      approval: 'appToolFamilies.preview.approval'
    },
    tools: (context) => createTools(context, options, approved)
  }
}

function createTools(
  context: ToolContext,
  options: PreviewToolsOptions,
  approved: Set<string>
): AppTool[] {
  const { servers } = options
  const workspace = context.workspace
  const budget = options.budgetMs ?? TOOL_BUDGET_MS
  const read = options.readConfigs ?? readLaunchConfigs

  const configs = (): LaunchConfig[] | ToolResult => {
    let found
    try {
      found = read(workspace)
    } catch (error) {
      return textResult(`Fichier de lancement invalide — ${messageOf(error)}`, true)
    }
    if (!found) {
      return textResult(
        `No launch configuration in this project. Create ${LAUNCH_FILES[0]} (relative to ${workspace}) ` +
          `with the command that starts the dev server and its port, then call preview_start again.\n` +
          LAUNCH_FORMAT_HELP,
        true
      )
    }
    return found.configs
  }

  const pick = (list: LaunchConfig[], name: unknown): LaunchConfig | ToolResult => {
    const names = list.map((c) => c.name).join(', ')
    if (typeof name === 'string' && name) {
      return (
        list.find((c) => c.name === name) ??
        textResult(`Configuration inconnue : ${name} (disponibles : ${names})`, true)
      )
    }
    if (list.length === 1 && list[0]) return list[0]
    return textResult(`Précisez \`name\` parmi : ${names}`, true)
  }

  /** L'utilisateur voit la commande exacte avant le premier lancement ; `undefined` = accordé. */
  const approve = async (config: LaunchConfig): Promise<ToolResult | undefined> => {
    if (!launches(config)) return undefined
    const command = commandLine(config)
    return approveCommand(context, {
      workspace,
      command,
      question: t('approvals.preview.question', {
        name: config.name,
        folder: basename(workspace),
        command
      }),
      header: t('approvals.preview.header'),
      allow: t('approvals.preview.allow'),
      allowDescription: config.port
        ? t('approvals.preview.allowDescriptionPort', { port: config.port })
        : t('approvals.preview.allowDescription'),
      session: approved,
      key: `${workspace}\u0000${command}`,
      ...(options.always ? { always: options.always } : {}),
      texts: {
        retry: `J’ai autorisé « ${command} » : relance preview_start.`,
        refusedByUser: `Je ne veux pas lancer « ${command} ».`,
        pending:
          'The user has not approved the command yet. End your turn now; their decision will arrive as their next message.',
        refused: `The user refused to run "${command}". Do not try again.`
      }
    })
  }

  // Autorisés sans demander : `preview_start` montre lui-même la commande à l'utilisateur avant
  // de la lancer.
  const tool = panelToolFactory('browser')

  return [
    tool(
      'preview_start',
      `Start the project's dev server by name (from ${LAUNCH_FILES[0]}), or reuse it if already running, then open it in the browser panel of the app. Waits up to ${Math.round(budget / 1000)} s; if still starting, call it again. Then check the page with the browser_* tools and the server output with preview_logs. ${LAUNCH_FORMAT_HELP}`,
      { name: { type: 'string', description: 'Configuration name (optional if only one).' } },
      async (args) => {
        const list = configs()
        if (!Array.isArray(list)) return list
        const config = pick(list, args['name'])
        if (!('name' in config)) return config
        const refused = await approve(config)
        if (refused) return refused
        const outcome = await servers.start(workspace, config, budget)
        const { server } = outcome
        if (outcome.state === 'failed') {
          return textResult(
            `Server "${config.name}" did not start (${server.status}).\nLast output:\n${outcome.tail.join('\n')}`,
            true
          )
        }
        if (outcome.state === 'starting') {
          return textResult(
            `Server "${config.name}" is still starting (no answer on its port yet). Call preview_start again to keep waiting, or read preview_logs.\nLast output:\n${outcome.tail.slice(-10).join('\n')}`
          )
        }
        const local = !siteToApprove(server.url)
        // La page qui ne s'ouvre pas n'empêche pas le serveur de tourner : on le dit à l'agent.
        const opened = local
          ? await options
              .openInBrowser(context.conversationId, server.url)
              .then(() => undefined, messageOf)
          : 'not local'
        return textResult(
          [
            `Server "${config.name}" ${outcome.reused ? 'already running' : server.status === 'attached' ? 'found already running' : 'started'}: ${server.url}${server.pid ? ` (pid ${server.pid})` : ''}.`,
            opened === undefined
              ? 'Opened in the browser panel: use browser_screenshot / browser_read_page to check it.'
              : local
                ? `Could not open it in the browser panel (${opened}): check preview_logs.`
                : 'Open it with browser_navigate.'
          ].join('\n')
        )
      }
    ),
    tool(
      'preview_list',
      'List the dev servers started for this project and the available launch configurations.',
      {},
      async () => {
        const running = servers.list(workspace)
        const list = configs()
        const lines = running.map(
          (s) => `- ${s.name}: ${s.status}, ${s.url}${s.pid ? `, pid ${s.pid}` : ''} — ${s.command}`
        )
        const available = Array.isArray(list)
          ? list
              .filter((c) => !running.some((s) => s.name === c.name))
              .map((c) => `- ${c.name}: not started — ${commandLine(c) || c.url}`)
          : []
        const all = [...lines, ...available]
        return textResult(
          all.length
            ? all.join('\n')
            : `No dev server and no launch configuration yet. ${LAUNCH_FORMAT_HELP}`
        )
      }
    ),
    tool(
      'preview_logs',
      'Output (stdout/stderr) of a dev server started with preview_start: build errors, stack traces…',
      {
        name: { type: 'string' },
        level: { type: 'string', enum: ['all', 'error'], description: 'Default: all.' },
        search: { type: 'string', description: 'Only lines containing this text.' },
        lines: { type: 'number', description: 'Max lines (default 50).' }
      },
      async (args) => {
        const running = servers.list(workspace)
        const name =
          typeof args['name'] === 'string'
            ? args['name']
            : running.length === 1
              ? running[0]?.name
              : undefined
        if (!name) return textResult('Précisez `name` (voir preview_list).', true)
        const lines = servers.logs(workspace, name, {
          errorsOnly: args['level'] === 'error',
          ...(typeof args['search'] === 'string' ? { search: args['search'] } : {}),
          lines: typeof args['lines'] === 'number' ? Math.min(500, Math.max(1, args['lines'])) : 50
        })
        return textResult(lines.length ? lines.join('\n') : '(aucune ligne)')
      }
    ),
    tool(
      'preview_stop',
      'Stop a dev server started with preview_start.',
      { name: { type: 'string' } },
      async (args) => {
        const name = typeof args['name'] === 'string' ? args['name'] : ''
        return servers.stop(workspace, name)
          ? textResult(`Server "${name}" stopped.`)
          : textResult(`No server "${name}" for this project.`, true)
      },
      ['name']
    )
  ]
}
