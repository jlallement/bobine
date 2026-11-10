/**
 * État des serveurs MCP (fiche 060) : résultats de « Tester », partagés entre Réglages › Serveurs
 * MCP et « Réglages de la session », gardés quelques minutes pour ne pas relancer un serveur à
 * chaque ouverture. Rien n'est enregistré.
 */
import { useSyncExternalStore } from 'react'
import type { McpServerEntry, McpTestResult } from '@shared/mcp'
import { ipcErrorText } from './ipc-errors'

/** Au-delà, un serveur est testé de nouveau à l'ouverture. */
const FRESH_MS = 5 * 60_000

export type McpStatus = McpTestResult | 'testing'

const cache = new Map<string, { status: McpStatus; at: number }>()
const listeners = new Set<() => void>()
let version = 0

const changed = () => {
  version++
  for (const listener of listeners) listener()
}

export const mcpKey = (profileId: string, server: Pick<McpServerEntry, 'scope' | 'name'>) =>
  `${profileId}:${server.scope}:${server.name}`

export function mcpStatus(key: string): McpStatus | undefined {
  return cache.get(key)?.status
}

/** Teste un serveur (même s'il a déjà un résultat récent). */
export async function testMcpServer(profileId: string, server: McpServerEntry): Promise<void> {
  const key = mcpKey(profileId, server)
  cache.set(key, { status: 'testing', at: Date.now() })
  changed()
  const result = await window.api.mcp
    .test(profileId, server.scope, server.name)
    .catch((e: unknown): McpTestResult => ({
      ok: false,
      error: ipcErrorText(e),
      ms: 0
    }))
  cache.set(key, { status: result, at: Date.now() })
  changed()
}

/**
 * Teste l'un après l'autre (chaque serveur peut lancer un processus) les serveurs activés ;
 * `onlyStale` : ceux sans résultat récent.
 */
export async function testMcpServers(
  profileId: string,
  servers: readonly McpServerEntry[],
  onlyStale = false
): Promise<void> {
  for (const server of servers) {
    if (!server.enabled) continue
    const known = cache.get(mcpKey(profileId, server))
    if (onlyStale && known && (known.status === 'testing' || Date.now() - known.at < FRESH_MS)) {
      continue
    }
    await testMcpServer(profileId, server)
  }
}

/** Re-rend le composant quand un résultat change. */
export function useMcpStatuses(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
}
