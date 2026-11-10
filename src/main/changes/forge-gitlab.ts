/**
 * GitLab par `glab` (fiche 189, ADR-0041) : connexion à l'hôte, MR ouverte vers la base, MR déjà
 * ouverte de la branche. La branche est poussée par git avant (`WorktreeCycle`), jamais par
 * `glab`. Pas de suivi du pipeline pour l'instant (`tracks: false`).
 *
 * Sorties relevées avec `glab` 1.128 contre un GitLab CE local : `fixtures/glab/`.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ForgeAdapter } from './forge'
import { firstUrl, forgeFailure } from './forge'

/** Une MR telle que `glab mr list --output json` la rend (ce qui sert ici). */
interface MrJson {
  web_url?: unknown
  title?: unknown
  state?: unknown
  source_branch?: unknown
}

/** MR ouverte d'une branche dans la sortie de `glab mr list --output json`. */
export function openMergeRequest(
  json: string,
  branch: string
): { url: string; title?: string } | undefined {
  let list: unknown
  try {
    list = JSON.parse(json)
  } catch {
    return undefined
  }
  if (!Array.isArray(list)) return undefined
  for (const item of list as MrJson[]) {
    if (!item || typeof item !== 'object') continue
    if (item.state !== 'opened' || item.source_branch !== branch) continue
    if (typeof item.web_url !== 'string' || !/^https?:\/\//.test(item.web_url)) continue
    return {
      url: item.web_url,
      ...(typeof item.title === 'string' ? { title: item.title } : {})
    }
  }
  return undefined
}

/** Hôte déclaré à `glab` (`hosts:` de sa configuration), et son hôte SSH s'il en a un. */
export interface GlabHost {
  host: string
  sshHost?: string
}

/**
 * Hôtes de la configuration de `glab` (`config.yml`), lus sans rien lancer ni envoyer : c'est la
 * preuve qu'un hôte est un GitLab que l'utilisateur a déclaré (ADR-0041). YAML simple de `glab` :
 * `hosts:`, puis une clé par hôte, puis ses réglages plus indentés.
 */
export function parseGlabHosts(yaml: string): GlabHost[] {
  const hosts: GlabHost[] = []
  let inHosts = false
  let entryIndent: number | undefined
  for (const raw of yaml.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (indent === 0) {
      inHosts = /^hosts:\s*$/.test(line)
      entryIndent = undefined
      continue
    }
    if (!inHosts) continue
    entryIndent ??= indent
    const text = line.trim()
    if (indent === entryIndent) {
      const key = /^["']?(.+?)["']?:$/.exec(text)?.[1]
      if (key) hosts.push({ host: key.toLowerCase() })
      continue
    }
    const ssh = /^ssh_host:\s*["']?([^"'\s]+)["']?$/.exec(text)?.[1]
    const current = hosts.at(-1)
    if (ssh && current && indent > entryIndent) current.sshHost = ssh.toLowerCase()
  }
  return hosts
}

/**
 * Fichier de configuration que `glab` lit, dans son ordre (relevé avec `glab config path`, `glab`
 * 1.128, `HOME` temporaire) : `GLAB_CONFIG_DIR` ; `~/.config/glab-cli` s'il existe (ancien
 * emplacement, prioritaire) ; `XDG_CONFIG_HOME/glab-cli` ; sinon le dossier de configuration du
 * système (`~/Library/Application Support/glab-cli` sur macOS, `~/.config/glab-cli` ailleurs).
 */
export function glabConfigFile(
  env: NodeJS.ProcessEnv,
  home: string,
  platform: NodeJS.Platform = process.platform,
  exists: (path: string) => boolean = existsSync
): string {
  if (env['GLAB_CONFIG_DIR']) return join(env['GLAB_CONFIG_DIR'], 'config.yml')
  const legacy = join(home, '.config', 'glab-cli', 'config.yml')
  if (exists(legacy)) return legacy
  if (env['XDG_CONFIG_HOME']) return join(env['XDG_CONFIG_HOME'], 'glab-cli', 'config.yml')
  return platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'glab-cli', 'config.yml')
    : legacy
}

/** Hôtes déclarés à `glab` sur cette machine ; aucun si la configuration est absente ou illisible. */
export async function readGlabHosts(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir()
): Promise<GlabHost[]> {
  try {
    return parseGlabHosts(await readFile(glabConfigFile(env, home), 'utf8'))
  } catch {
    return []
  }
}

/** L'hôte de `glab` qui sert ce nom d'hôte (web, avec ou sans port, ou SSH). */
export function glabHostFor(hosts: readonly GlabHost[], hostname: string): string | undefined {
  const name = hostname.toLowerCase()
  return hosts.find(
    (h) => h.host === name || h.host.replace(/:\d+$/, '') === name || h.sshHost === name
  )?.host
}

/**
 * Dossier où lancer `glab mr` : avec `-R`, hors du dépôt (`glab` y lirait les dépôts distants et
 * refuserait un remote SSH dont l'hôte n'est pas celui du web, relevé contre un GitLab réel) ;
 * sans, dans le worktree.
 */
function whereToRun(request: { cwd: string; repo?: string }): string {
  return request.repo ? tmpdir() : request.cwd
}

/** Délais de `glab` : au-delà, l'hôte est tenu pour injoignable. */
const AUTH_TIMEOUT_MS = 20_000
const CREATE_TIMEOUT_MS = 60_000

export const gitlabForge: ForgeAdapter = {
  kind: 'gitlab',
  tool: 'glab',
  noun: 'mr',
  tracks: false,
  async auth(run, path, host) {
    // GitLab : toujours un hôte (gitlab.com compris), `glab` en connaît plusieurs.
    const auth = await run(path, ['auth', 'status', '--hostname', host ?? 'gitlab.com'], {
      timeoutMs: AUTH_TIMEOUT_MS
    })
    if (auth.code === 0) return { ok: true, path }
    // Arrêté au bout du délai (hôte qui ne répond pas, VPN coupé) : rien à lire dans sa sortie.
    if (auth.timedOut) return { ok: false, reason: 'unreachable', path }
    const output = `${auth.stderr}\n${auth.stdout.toString('utf8')}`
    if (/has not been authenticated/i.test(output.replace(/\s+/g, ' '))) {
      return { ok: false, reason: 'not-logged', path }
    }
    // Jeton révoqué (401), injoignable, certificat ; sinon une sortie que rien ne reconnaît.
    return { ok: false, reason: forgeFailure(output) ?? 'unexpected', path }
  },
  async create(run, path, request) {
    // `--opt=valeur` : un titre qui commence par « - » reste un titre. La description passe par
    // l'entrée standard (`--description-file -`) : « - » seul ouvrirait un éditeur avec
    // `--description`, et l'entrée fermée coupe court à toute question.
    const created = await run(
      path,
      [
        'mr',
        'create',
        ...(request.repo ? [`--repo=${request.repo}`] : []),
        `--source-branch=${request.branch}`,
        `--target-branch=${request.base}`,
        `--title=${request.title}`,
        '--description-file',
        '-',
        '--yes'
      ],
      { cwd: whereToRun(request), timeoutMs: CREATE_TIMEOUT_MS, input: request.body }
    )
    const url = firstUrl(created.stdout.toString('utf8'))
    if (created.code === 0 && url) return { url }
    return {
      code: created.code,
      stderr: created.stderr,
      ...(created.timedOut ? { timedOut: true as const } : {})
    }
  },
  async findOpen(run, path, request) {
    const listed = await run(
      path,
      [
        'mr',
        'list',
        ...(request.repo ? [`--repo=${request.repo}`] : []),
        `--source-branch=${request.branch}`,
        '--output',
        'json'
      ],
      { cwd: whereToRun(request), timeoutMs: 30_000 }
    )
    return listed.code === 0
      ? openMergeRequest(listed.stdout.toString('utf8'), request.branch)
      : undefined
  }
}
