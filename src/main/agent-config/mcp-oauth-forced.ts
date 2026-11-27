/**
 * Fausse commande de connexion des essais de bout en bout (fiche 293), sur le modèle de
 * `BOBINE_GH` pour `gh` : jamais le vrai agent, jamais Figma, aucun réseau. Contrairement à
 * `BOBINE_GH`, elle est **gardée** : sans effet dans l'app installée (`isPackaged`), où rien ne
 * peut remplacer la commande de l'agent.
 *
 * - `BOBINE_FAKE_MCP_AUTH` : script Node lancé par l'exécutable de l'app (`ELECTRON_RUN_AS_NODE=1`,
 *   comme l'agent factice) à la place de la commande de l'agent, avec les mêmes arguments ; vide :
 *   commande introuvable (« agent absent »). Aucun shell, aucun script `sh` : portable.
 * - `BOBINE_FAKE_MCP_AUTH_MS` : durée d'une tentative raccourcie (« délai » en essai), et celle de
 *   l'attente de la page, au plus.
 *
 * Pur, sans `electron` : l'exécutable et le lancement sont donnés par l'appelant.
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import type { McpOAuthAppDeps } from './mcp-settings'

type Start = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => { child: ChildProcess }

export interface ForcedMcpAuth {
  /** Script de la fausse commande ; `undefined` : commande introuvable. */
  script: string | undefined
  /** Durée d'une tentative, raccourcie. */
  attemptMs: number | undefined
  /** Ce qui remplace, dans le moteur, la recherche et le lancement de la commande de l'agent. */
  deps(execPath: string, start: Start): Partial<McpOAuthAppDeps>
}

export function forcedMcpAuth(ctx: {
  isPackaged: boolean
  env: NodeJS.ProcessEnv
}): ForcedMcpAuth | undefined {
  const raw = ctx.env['BOBINE_FAKE_MCP_AUTH']
  if (ctx.isPackaged || raw === undefined) return undefined
  const script = raw || undefined
  const ms = Number(ctx.env['BOBINE_FAKE_MCP_AUTH_MS'])
  const attemptMs = Number.isInteger(ms) && ms > 0 ? ms : undefined
  return {
    script,
    attemptMs,
    deps: (execPath, start) => ({
      findCommand: () => (script ? execPath : undefined),
      start: (_command, args, options) => {
        // Commande « introuvable » : rien n'est lancé, jamais l'exécutable de l'app sans script.
        if (!script) throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
        return start(execPath, [script, ...args], {
          ...options,
          env: { ...options.env, ELECTRON_RUN_AS_NODE: '1' }
        }).child
      },
      ...(attemptMs ? { limits: { attemptMs, noPageMs: Math.min(attemptMs, 30_000) } } : {})
    })
  }
}
