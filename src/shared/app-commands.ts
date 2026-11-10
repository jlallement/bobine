/**
 * Commandes « / » fournies par l'app (fiche 039), comme les commandes intégrées de Claude Code :
 * mélangées à celles de l'agent dans le même menu, traitées par l'app.
 */
import { t } from 'i18next'
import type { AgentCommand, SessionControl } from './agent'
import { contextRatio, formatCost, formatTokens, type ConversationUsage } from './usage'

export type AppCommandName =
  | 'clear'
  | 'compact'
  | 'context'
  | 'cost'
  | 'model'
  | 'mode'
  | 'init'
  | 'review'
  | 'split'
  | 'btw'
  | 'help'

/**
 * `/split` (fiche 118) : le message tapé après elle part avec une demande de découpage en
 * conversations filles (`CHILDREN_REQUEST`). Le nom n'est pas traduit, comme les autres.
 */
export const CHILDREN_COMMAND = 'split'

export const APP_COMMANDS: (AgentCommand & { name: AppCommandName })[] = [
  {
    name: 'clear',
    get description() {
      return t('appCommands.list.clear')
    },
    source: 'app'
  },
  {
    name: 'compact',
    get description() {
      return t('appCommands.list.compact')
    },
    source: 'app'
  },
  {
    name: 'context',
    get description() {
      return t('appCommands.list.context')
    },
    source: 'app'
  },
  {
    name: 'cost',
    get description() {
      return t('appCommands.list.cost')
    },
    source: 'app'
  },
  {
    name: 'model',
    get description() {
      return t('appCommands.list.model')
    },
    get hint() {
      return t('appCommands.hint.name')
    },
    source: 'app'
  },
  {
    name: 'mode',
    get description() {
      return t('appCommands.list.mode')
    },
    get hint() {
      return t('appCommands.hint.name')
    },
    source: 'app'
  },
  {
    name: 'init',
    get description() {
      return t('appCommands.list.init')
    },
    source: 'app'
  },
  {
    name: 'review',
    get description() {
      return t('appCommands.list.review')
    },
    source: 'app'
  },
  {
    name: CHILDREN_COMMAND,
    get description() {
      return t('appCommands.list.split')
    },
    get hint() {
      return t('appCommands.hint.message')
    },
    source: 'app'
  },
  {
    // Aparté (fiche 180) : nom de Claude Code, non traduit comme les autres commandes.
    name: 'btw',
    get description() {
      return t('appCommands.list.btw')
    },
    get hint() {
      return t('appCommands.hint.question')
    },
    source: 'app'
  },
  {
    name: 'help',
    get description() {
      return t('appCommands.list.help')
    },
    source: 'app'
  }
]

/** Consignes envoyées à l'agent par `/init` et `/review`. */
export const AGENT_PROMPTS: Partial<Record<AppCommandName, string>> = {
  init:
    'Analyse ce projet (structure, langages, commandes de build et de test, conventions) puis crée un ' +
    'fichier AGENTS.md à la racine — ou complète celui qui existe — avec les consignes utiles à un ' +
    'agent de code : comment installer, lancer, tester, et les règles à respecter. Reste concis.',
  review:
    'Fais une revue des modifications en cours dans ce projet (git status et git diff) : bugs, cas ' +
    'oubliés, sécurité, lisibilité. Classe les remarques par gravité et ne modifie aucun fichier.'
}

/** Nom (sans « / ») de la commande de compaction de l'agent, si elle n'est pas `/compact`. */
const compactName = (compactCommand: string | undefined): string | undefined => {
  const name = compactCommand?.replace(/^\//, '').trim()
  return name && name !== 'compact' ? name : undefined
}

/**
 * Commandes de l'agent, avec sa commande de compaction quand il ne l'annonce pas (`/compress` de
 * Bob, déclarée par son profil, fiche 039) : elle figure dans la liste sous son vrai nom (fiche 126).
 */
export function withCompactCommand(
  agent: readonly AgentCommand[],
  compactCommand: string | undefined,
  agentLabel: string
): readonly AgentCommand[] {
  const name = compactName(compactCommand)
  if (!name || agent.some((c) => c.name === name)) return agent
  return [
    ...agent,
    { name, description: t('appCommands.list.agentCompact', { agent: agentLabel }) }
  ]
}

/**
 * Commandes du menu : celles de l'agent, puis les personnelles et du projet (fiche 045), puis
 * celles de l'app — chacune sans celles qui portent déjà un nom pris. Quand l'agent a sa propre
 * commande de compaction (`compactCommand`), `/compact` de l'app n'y figure pas : une seule entrée
 * pour la même action (tapée, elle marche toujours).
 */
export function mergeCommands(
  agent: readonly AgentCommand[],
  user: readonly AgentCommand[] = [],
  compactCommand?: string
): AgentCommand[] {
  const names = new Set(agent.map((c) => c.name))
  const own = user.filter((c) => !names.has(c.name))
  for (const c of own) names.add(c.name)
  const compact = compactName(compactCommand)
  if (compact && names.has(compact)) names.add('compact')
  return [...agent, ...own, ...APP_COMMANDS.filter((c) => !names.has(c.name))]
}

/**
 * Commande de l'app tapée dans la zone de saisie (`/nom arguments`), si ni l'agent ni l'utilisateur
 * n'ont une commande du même nom ; sinon `undefined` (le message part à l'agent tel quel).
 */
export function appCommandOf(
  text: string,
  agent: readonly AgentCommand[],
  user: readonly AgentCommand[] = []
): { name: AppCommandName; args: string } | undefined {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  if (!match) return undefined
  const name = match[1] as AppCommandName
  if (
    !APP_COMMANDS.some((c) => c.name === name) ||
    agent.some((c) => c.name === name) ||
    user.some((c) => c.name === name)
  ) {
    return undefined
  }
  return { name, args: (match[2] ?? '').trim() }
}

/** Remplissage du contexte, s'il est connu. */
function contextLine(usage: ConversationUsage | undefined): string | undefined {
  if (!usage?.context) return undefined
  const tokens = { used: formatTokens(usage.context.used), size: formatTokens(usage.context.size) }
  const ratio = contextRatio(usage)
  return ratio !== undefined
    ? t('usage.summary.contextPercent', { ...tokens, percent: Math.round(ratio * 100) })
    : t('usage.summary.context', tokens)
}

/** Jetons traités et coût, ce que l'agent en a dit. */
function costLines(usage: ConversationUsage | undefined): string[] {
  const lines: string[] = []
  if (usage?.tokens) {
    lines.push(
      t('usage.summary.tokens', {
        total: formatTokens(usage.tokens.total),
        input: formatTokens(usage.tokens.input),
        output: formatTokens(usage.tokens.output),
        count: usage.tokens.turns
      })
    )
  }
  if (usage?.cost) lines.push(t('usage.summary.cost', { cost: formatCost(usage.cost) }))
  return lines
}

/**
 * `/context` (fiche 126) : le remplissage du contexte, ou ce que l'agent ne transmet pas — et la
 * commande qui le résume, s'il y en a une.
 */
export function contextReport(
  usage: ConversationUsage | undefined,
  agentLabel: string,
  compactCommand?: string
): string {
  const line = contextLine(usage)
  if (line) return line
  const unknown = t('usage.summary.contextUnknown', { agent: agentLabel })
  return compactCommand
    ? `${unknown} ${t('usage.summary.compactHint', { command: compactCommand })}`
    : unknown
}

/** `/cost` (fiche 126) : jetons traités et coût. */
export function costReport(usage: ConversationUsage | undefined, agentLabel: string): string {
  const lines = costLines(usage)
  return lines.length ? lines.join('\n') : t('usage.summary.none', { agent: agentLabel })
}

/** Bilan complet (export Markdown) : contexte, jetons, coût. */
export function usageSummary(usage: ConversationUsage | undefined, agentLabel: string): string {
  const lines = [contextLine(usage), ...costLines(usage)].filter((l): l is string => !!l)
  return lines.length ? lines.join('\n') : t('usage.summary.none', { agent: agentLabel })
}

/**
 * Option d'un réglage désignée par son nom (`/model sonnet`) : valeur ou nom exacts, sinon le seul
 * nom qui contient le texte. `undefined` si rien ou plusieurs ne correspondent.
 */
export function pickOption(control: SessionControl, query: string) {
  if (control.type !== 'select') return undefined
  const q = query.trim().toLowerCase()
  const exact = control.options.find(
    (o) => String(o.value).toLowerCase() === q || o.name.toLowerCase() === q
  )
  if (exact) return exact
  const partial = control.options.filter(
    (o) => o.name.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)
  )
  return partial.length === 1 ? partial[0] : undefined
}
