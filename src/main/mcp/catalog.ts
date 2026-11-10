/**
 * Outils de Bobine tels que l'utilisateur les voit (fiche 099) : par famille dans Réglages ›
 * Serveurs MCP, et ceux que reçoit une conversation dans son menu ⚙. Tout vient des modules
 * (`tools`, `catalog`, `enabled`) : un outil ajouté à un module apparaît sans autre changement.
 * Fiche 109 : poids estimé de chaque famille dans le contexte, et familles coupées par l'utilisateur.
 */
import type { AppToolFamily, ConversationAppTools } from '@shared/mcp'
import { estimateTokens } from '@shared/usage'
import { askUserModule } from './ask-user-tool'
import { moduleTools, type AppToolModule, type ToolContext, type ToolDefinition } from './tools'

/**
 * Contexte pour décrire les outils sans conversation à servir : `tools()` ne fait que préparer
 * des fermetures, et rien ici n'appelle un outil — ni donc `ask` ou `tellAgent`.
 */
function describeContext(workspace: string, conversationId: string): ToolContext {
  return {
    workspace,
    conversationId,
    ask: () => Promise.resolve(null),
    proposeChild: () => Promise.resolve({ action: 'refuse' }),
    tellAgent: () => {}
  }
}

/** Modules du serveur `bobine`, questions comprises (le pont les ajoute toujours en tête). */
const withQuestions = (modules: readonly AppToolModule[]) => [
  askUserModule(() => Promise.resolve({ text: '' })),
  ...modules
]

/** Jetons estimés des définitions telles que `tools/list` les envoie (nom, description, schéma). */
export const definitionsTokens = (definitions: readonly ToolDefinition[]): number =>
  definitions.reduce((sum, definition) => sum + estimateTokens(JSON.stringify(definition)), 0)

/**
 * Modules dont les familles coupées par l'utilisateur ne sont plus proposées (fiche 109). `off`
 * est relu à chaque ouverture de session : un changement vaut pour les sessions suivantes.
 */
export function switchedOff(
  modules: readonly AppToolModule[],
  off: () => ReadonlySet<string>
): AppToolModule[] {
  return modules.map((module) =>
    module.required || module.setting
      ? module
      : {
          ...module,
          enabled: (context) => !off().has(module.id) && (module.enabled?.(context) ?? true)
        }
  )
}

/** Toutes les familles d'outils, dans l'ordre où l'agent les reçoit, coupées comprises. */
export function appToolsCatalog(
  modules: readonly AppToolModule[],
  off: ReadonlySet<string> = new Set()
): AppToolFamily[] {
  const context = describeContext('', 'app-tools-catalog')
  return withQuestions(modules).map((module) => {
    const definitions = (module.catalog ?? module.tools)(context).map((tool) => tool.definition)
    return {
      id: module.id,
      ...module.about,
      tools: definitions.map(({ name, description }) => ({ name, description })),
      tokens: definitionsTokens(definitions),
      enabled: module.setting
        ? module.setting.enabled()
        : module.required === true || !off.has(module.id),
      ...(module.required ? { required: true } : {}),
      ...(module.setting ? { setting: module.setting.section } : {})
    }
  })
}

/** Définitions des outils qu'une conversation de ce dossier reçoit à l'ouverture de sa session. */
export function conversationTools(
  modules: readonly AppToolModule[],
  workspace: string,
  conversationId: string
): ToolDefinition[] {
  return moduleTools(withQuestions(modules), describeContext(workspace, conversationId)).map(
    (tool) => tool.definition
  )
}

/** Noms des outils qu'une conversation de ce dossier reçoit à l'ouverture de sa session. */
export function conversationToolNames(
  modules: readonly AppToolModule[],
  workspace: string,
  conversationId: string
): string[] {
  return conversationTools(modules, workspace, conversationId).map((tool) => tool.name)
}

/**
 * Outils de Bobine d'une conversation pour son menu ⚙ (fiches 099, 109) : ceux de sa session
 * ouverte (`live`), sinon ceux que son dossier recevrait, leur poids, et ce que la prochaine
 * session recevra si cela diffère (famille coupée ou rallumée, projet ajouté au dossier…).
 * `modules` : ceux que reçoivent les sessions, familles coupées déjà retirées (`switchedOff`).
 */
export function conversationAppTools(
  modules: readonly AppToolModule[],
  workspace: string,
  conversationId: string,
  live: readonly string[] | undefined
): ConversationAppTools {
  const next = conversationTools(modules, workspace, conversationId)
  if (live === undefined) return { names: next.map((t) => t.name), tokens: definitionsTokens(next) }
  // Définitions de toutes les familles, coupées comprises, pour peser les outils de la session.
  const all = new Map(
    withQuestions(modules)
      .flatMap((module) =>
        (module.catalog ?? module.tools)(describeContext(workspace, conversationId))
      )
      .map((tool) => [tool.definition.name, tool.definition] as const)
  )
  const nextNames = next.map((t) => t.name)
  const same = live.length === nextNames.length && live.every((name) => nextNames.includes(name))
  return {
    names: [...live],
    tokens: definitionsTokens(live.flatMap((name) => all.get(name) ?? [])),
    // Un agent qui n'a reçu aucun outil (MCP par HTTP non pris en charge) n'en recevra pas plus.
    ...(same || live.length === 0 ? {} : { next: nextNames.length })
  }
}
