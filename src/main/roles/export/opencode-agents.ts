/**
 * Agents d'OpenCode (fiche 223, phase 4, ADR-0047) : un fichier Markdown par agent,
 * `~/.config/opencode/agents/<id>.md` (suit `XDG_CONFIG_HOME`) ou `<dossier>/.opencode/agents/<id>.md`.
 * Format de la documentation publique d'OpenCode 2 (« Agents », « Permissions ») : en-tête
 * `description`, `mode`, `permissions` (règles `action` / `resource` / `effect`, la dernière qui
 * correspond l'emporte), corps = consigne, qui remplace la consigne de base pour cet agent.
 * Vérifié par `pnpm opencode-probe --offline` (2.2.5) : l'agent est listé par ACP.
 *
 * - toujours `mode: primary` : un sous-agent ou un agent caché n'est pas proposé par ACP ;
 * - lecture seule : `edit`, `shell` et `subagent` refusés ; les outils MCP (ceux de Bobine
 *   compris, actions `<serveur>_<outil>`) et `execute` ne le sont pas.
 *
 * Un fichier par agent : le fichier entier est à Bobine ; le retirer le supprime.
 */
import { join } from 'node:path'
import { stringify } from 'yaml'
import {
  exportedPrompt,
  fingerprint,
  shownPath,
  type ExportedRole,
  type RoleExportAdapter
} from './format.ts'

/** Agents d'OpenCode 2 (visibles et cachés) : un fichier du même nom les remplacerait. */
export const OPENCODE_RESERVED = [
  'build',
  'plan',
  'general',
  'explore',
  'compaction',
  'title',
  'summary'
] as const

/** Lecture seule (V2) : modifications, commandes et sous-agents refusés. */
export const OPENCODE_READ_ONLY_PERMISSIONS = ['edit', 'shell', 'subagent'].map((action) => ({
  action,
  resource: '*',
  effect: 'deny'
}))

/** Le fichier écrit pour un rôle. */
export function openCodeAgentFile(role: ExportedRole): string {
  const header = {
    description: role.description,
    mode: 'primary',
    ...(role.readOnly ? { permissions: OPENCODE_READ_ONLY_PERMISSIONS } : {})
  }
  return `---\n${stringify(header, { lineWidth: 0 })}---\n${exportedPrompt(role)}\n`
}

export const OPENCODE_AGENTS: RoleExportAdapter = {
  format: 'opencode-agents',
  place: (scope, id, loc, workspace) => {
    const root = scope === 'user' ? loc.home : (workspace ?? '')
    const config = loc.xdgConfigHome ?? join(loc.home, '.config')
    const file =
      scope === 'user'
        ? join(config, 'opencode', 'agents', `${id}.md`)
        : join(root, '.opencode', 'agents', `${id}.md`)
    // `XDG_CONFIG_HOME` hors du dossier personnel : chemin affiché en entier.
    return { file, root, shown: shownPath(file, root, scope) }
  },
  reserved: OPENCODE_RESERVED,
  entryText: openCodeAgentFile,
  fingerprintOf: (role) => fingerprint(openCodeAgentFile(role)),
  find: (text) =>
    text === undefined ? { kind: 'absent' } : { kind: 'present', fingerprint: fingerprint(text) },
  put: (_text, role) => {
    const text = openCodeAgentFile(role)
    return { text, fingerprint: fingerprint(text) }
  },
  drop: () => ({ text: null })
}
