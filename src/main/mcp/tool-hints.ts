/**
 * Indices MCP des outils de l'app (fiche 165) : `readOnlyHint` pour ceux qui ne font que lire,
 * `destructiveHint: false` pour ceux qui n'agissent que dans l'app. Un agent peut s'en servir (Bob
 * IDE 2.3.0 les affiche). Prudence : sans indice, MCP tient un outil pour potentiellement
 * destructeur ; on n'en promet donc jamais plus que l'outil ne garantit (un clic dans une page, une
 * commande, une planche de captures qui rejoue des actions restent sans indice).
 */
import type { ToolDefinition } from './tools'

/** Outils qui ne modifient rien : captures, lectures, listes, journaux, questions. */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'ask_user',
  'browser_screenshot',
  'browser_read_page',
  'browser_get_page_text',
  'browser_find',
  'browser_console',
  'browser_network',
  'terminal_list',
  'terminal_read',
  'child_status',
  'ios_devices',
  'ios_screenshot',
  'ios_describe',
  'android_devices',
  'android_screenshot',
  'android_describe',
  'android_logcat',
  'preview_list',
  'preview_logs'
])

/** Outils qui changent l'état de l'app seulement (conversations filles), sans rien détruire. */
export const APP_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'start_child',
  'message_child',
  'message_parent',
  'recommend_merge'
])

/** Définition envoyée à l'agent (`tools/list`), avec ses indices. */
export function withHints(definition: ToolDefinition): ToolDefinition {
  const { name } = definition
  if (READ_ONLY_TOOLS.has(name)) return { ...definition, annotations: { readOnlyHint: true } }
  if (APP_ONLY_TOOLS.has(name)) {
    return {
      ...definition,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    }
  }
  return definition
}
