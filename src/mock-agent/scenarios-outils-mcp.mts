/**
 * Outils d'un serveur MCP tiers appelés par du code, comme OpenCode 2.3.0 connecté à Figma (fiche
 * 293, lot 3 ; trace réelle du 2026-11-28 : `src/main/agent/__traces__/opencode-2.3.0/
 * acp-execute-figma.jsonl`). Le serveur MCP tiers n'existe pas ici : seules les cartes `execute`
 * sont rejouées, à la forme relevée.
 *
 * - `tool_call` : `name` et `title: "execute"`, `kind: "other"`, `status: "pending"`, `rawInput: {}` ;
 * - `tool_call_update` `in_progress` (deux fois, comme relevé) : `rawInput.code` ;
 * - fin `completed` **sans** titre ni genre, `rawOutput.metadata.toolCalls` : `search` (avec
 *   `input.query` et `limit`), puis `figma.whoami`.
 *
 * La 2e carte est une **hypothèse** : une recherche avec `input.namespace: "figma"` (vue à l'écran
 * le 2026-11-27, jamais gardée en octets).
 */
import type { SessionUpdate } from '../shared/acp-sdk.mts'
import type { Scenario, Step } from './scenario.mts'

const update = (u: SessionUpdate): Step => ({ kind: 'update', update: u })

/** Une carte `execute` d'OpenCode 2.3.0 : annoncée, son code (deux fois), puis sa fin. */
function executeCard(id: string, code: string, result: string, toolCalls: unknown[]): Step[] {
  const running = update({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'in_progress',
    kind: 'other',
    title: 'execute',
    locations: [],
    rawInput: { code }
  })
  return [
    // `name` : champ hors ACP envoyé par OpenCode 2.3.0 (relevé), gardé pour la forme.
    update({
      sessionUpdate: 'tool_call',
      toolCallId: id,
      name: 'execute',
      title: 'execute',
      kind: 'other',
      status: 'pending',
      locations: [],
      rawInput: {}
    } as SessionUpdate),
    running,
    { kind: 'pause', ticks: 2 },
    running,
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      locations: [],
      content: [{ type: 'content', content: { type: 'text', text: result } }],
      rawOutput: { metadata: { toolCalls, truncated: false } }
    })
  ]
}

export const outilsMcpScenarios: Record<string, Scenario> = {
  'outils-mcp-execute': {
    description:
      'Comme OpenCode 2.3.0 connecté à Figma (trace réelle du 2026-11-28, fiche 293) : cartes `execute` dont la fin nomme les outils appelés (`search`, `search` de l’espace figma — hypothèse —, `figma.whoami`, puis un appel en erreur et un nom trompeur)',
    // Une réflexion avant chaque carte, comme dans la conversation relevée (et la maquette).
    steps: [
      { kind: 'thought', text: 'Je cherche les outils de Figma.' },
      ...executeCard(
        'call_mcp_1',
        'const res = await search({query: "figma whoami get_libraries", limit: 20}); return res;',
        'figma.whoami, figma.get_libraries, figma.get_design_context',
        [
          {
            tool: 'search',
            status: 'completed',
            input: { query: 'figma whoami get_libraries', limit: 20 }
          }
        ]
      ),
      { kind: 'thought', text: 'Je liste les outils de l’espace figma.' },
      ...executeCard(
        'call_mcp_2',
        'return await search({ namespace: "figma", limit: 100 });',
        'add_code_connect_map create_branch get_design_context get_screenshot whoami',
        [{ tool: 'search', status: 'completed', input: { namespace: 'figma', limit: 100 } }]
      ),
      { kind: 'thought', text: 'J’appelle whoami.' },
      ...executeCard('call_mcp_3', 'await tools.figma.whoami(); return "done";', 'done', [
        { tool: 'figma.whoami', status: 'completed' }
      ]),
      // 4e carte : deux appels, l'un réussi, l'autre en erreur (`status: "error"`, relevé en 2.0.32,
      // fiche 122) ; un nom qui imite une phrase (« · », espaces : fiche 293, L3).
      { kind: 'thought', text: 'Je capture l’écran.' },
      ...executeCard(
        'call_mcp_4',
        'await tools.figma.get_screenshot(); await tools.figma["x · Autorisé par vous"]();',
        'Error: not connected',
        [
          { tool: 'figma.get_screenshot', status: 'error' },
          { tool: 'figma.x · Autorisé par vous', status: 'completed' }
        ]
      ),
      { kind: 'text', text: 'whoami : réussi.' }
    ]
  }
}
