/**
 * GitHub par `gh` (fiches 110, 176 ; ADR-0041) : les mêmes commandes qu'avant l'adaptateur, pour
 * que rien ne change sur GitHub. Le suivi de la PR (`pr-watch.ts`) reste l'implémentation GitHub
 * du suivi (`tracks`).
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ForgeAdapter } from './forge'
import { firstUrl } from './forge'

export const githubForge: ForgeAdapter = {
  kind: 'github',
  tool: 'gh',
  noun: 'pr',
  tracks: true,
  async auth(run, path, host) {
    // github.com et dépôt local : `gh auth status` sans hôte, comme avant (fiche 176).
    const args = host ? ['auth', 'status', '--hostname', host] : ['auth', 'status']
    const auth = await run(path, args, { timeoutMs: 15_000 })
    return auth.code === 0 ? { ok: true, path } : { ok: false, reason: 'not-logged', path }
  },
  async create(run, path, request) {
    const created = await run(
      path,
      [
        'pr',
        'create',
        '--base',
        request.base,
        '--head',
        request.branch,
        '--title',
        request.title,
        '--body',
        request.body
      ],
      { cwd: request.cwd, timeoutMs: 60_000 }
    )
    const url = firstUrl(created.stdout.toString('utf8'))
    return created.code === 0 && url ? { url } : { code: created.code, stderr: created.stderr }
  },
  async findOpen(run, path, request) {
    const existing = await run(
      path,
      ['pr', 'view', request.branch, '--json', 'url', '--jq', '.url'],
      { cwd: request.cwd, timeoutMs: 30_000 }
    )
    const found = existing.stdout.toString('utf8').trim()
    return existing.code === 0 && /^https?:\/\//.test(found) ? { url: found } : undefined
  }
}

/** Hôtes connectés à `gh` (clés de `hosts.yml`), lus sans rien lancer ni envoyer. */
export function parseGhHosts(yaml: string): string[] {
  return yaml
    .split('\n')
    .map((line) => /^["']?([^\s#"':][^"':]*(?::\d+)?)["']?:\s*$/.exec(line.trimEnd())?.[1])
    .filter((host): host is string => !!host)
    .map((host) => host.toLowerCase())
}

/** `hosts.yml` de `gh` : `GH_CONFIG_DIR`, sinon `XDG_CONFIG_HOME/gh`, sinon `~/.config/gh`. */
export async function readGhHosts(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir()
): Promise<string[]> {
  const dir = env['GH_CONFIG_DIR'] || join(env['XDG_CONFIG_HOME'] || join(home, '.config'), 'gh')
  try {
    return parseGhHosts(await readFile(join(dir, 'hosts.yml'), 'utf8'))
  } catch {
    return []
  }
}
