/**
 * Forge du dépôt distant (fiche 189, ADR-0041) : GitHub par `gh`, GitLab par `glab`, choisie
 * d'après l'URL du dépôt distant. Ce module ne lance rien : il lit une URL, range une erreur,
 * masque ce qui ne doit pas aller au journal. Les commandes sont dans `forge-github.ts` et
 * `forge-gitlab.ts` ; le choix et l'état des outils, dans `WorktreeCycle`.
 */
import type { Run } from '../simulator/run'

export type ForgeKind = 'github' | 'gitlab'

/** Hôte d'un dépôt distant : nom, port éventuel, et s'il est joint en SSH. */
export interface RemoteHost {
  /** Nom d'hôte, en minuscules, sans port ni identifiant. */
  hostname: string
  port?: number
  ssh: boolean
}

/**
 * Hôte d'une URL de dépôt distant : `git@hôte:groupe/projet.git`, `ssh://git@hôte:2222/…`,
 * `https://hôte[:port]/sous/chemin/groupe/projet.git`. `undefined` pour un dépôt local (chemin,
 * `file://`) ou une URL illisible.
 */
export function remoteHost(url: string): RemoteHost | undefined {
  const value = url.trim()
  if (!value) return undefined
  // Transport de git (`ext::commande`, `fd::…`) : jamais un hôte.
  if (/^[a-z][a-z0-9+.-]*::/i.test(value)) return undefined
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value)?.[1]?.toLowerCase()
  if (scheme) {
    if (scheme === 'file') return undefined
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return undefined
    }
    const hostname = parsed.hostname.toLowerCase()
    if (!validHostname(hostname)) return undefined
    const port = parsed.port ? Number(parsed.port) : undefined
    return { hostname, ...(port ? { port } : {}), ssh: scheme === 'ssh' || scheme === 'git+ssh' }
  }
  // Forme `scp` de git : un `:` avant tout `/`, et pas une lettre de lecteur Windows (`C:\`).
  const scp =
    /^(?:[^@/\s]+@)?(\[[0-9a-f:.]+\])(?::.*)?$/i.exec(value) ??
    /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(value)
  const host = scp?.[1]?.toLowerCase()
  if (host && !/^[a-z]$/.test(host) && validHostname(host)) return { hostname: host, ssh: true }
  return undefined
}

/**
 * Nom d'hôte sûr à passer à un outil (`ssh -G`, `--hostname`) : lettres, chiffres, points et
 * tirets, sans tiret en tête (`-oProxyCommand=…` n'en est pas un), ou une adresse IPv6 entre
 * crochets.
 */
export function validHostname(name: string): boolean {
  return (
    /^\[[0-9a-f:.]+\]$/i.test(name) ||
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i.test(name)
  )
}

/**
 * Nom de l'hôte tel que les outils le connaissent (`gh auth status --hostname`, `glab auth status
 * --hostname`) : le port d'une URL web en fait partie, celui de SSH non (c'est un autre service
 * de la même instance).
 */
export function toolHost(host: RemoteHost): string {
  return host.port && !host.ssh ? `${host.hostname}:${host.port}` : host.hostname
}

/** Forge connue d'avance par son nom d'hôte ; `undefined` : à demander aux outils. */
export function knownForge(hostname: string): ForgeKind | undefined {
  if (hostname === 'github.com' || hostname === 'ssh.github.com' || hostname.endsWith('.ghe.com')) {
    return 'github'
  }
  if (hostname === 'gitlab.com' || hostname === 'altssh.gitlab.com') return 'gitlab'
  return undefined
}

/**
 * Variables qui portent un jeton ou désignent un hôte par défaut : retirées de l'environnement de
 * toute commande lancée vers un hôte que l'utilisateur n'a pas déclaré à l'outil (l'URL du dépôt
 * distant peut avoir été écrite par un agent), pour qu'aucun jeton ne parte vers lui.
 */
export const TOKEN_VARIABLES = [
  'GITLAB_TOKEN',
  'GITLAB_ACCESS_TOKEN',
  'OAUTH_TOKEN',
  'GITLAB_HOST',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'GH_HOST'
] as const

/** L'environnement sans les variables de jeton. */
export function tokenlessEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const removed: readonly string[] = TOKEN_VARIABLES
  return Object.fromEntries(Object.entries(env).filter(([name]) => !removed.includes(name)))
}

/** Forge devinée d'après le nom, quand aucun outil n'y est connecté (pour dire lequel connecter). */
export function guessedForge(hostname: string): ForgeKind | undefined {
  if (/(^|[.-])gitlab([.-]|$)/.test(hostname)) return 'gitlab'
  if (/(^|[.-])github([.-]|$)/.test(hostname)) return 'github'
  return undefined
}

/** Pourquoi une commande de la forge a échoué, si on le reconnaît. */
export type ForgeFailure =
  | 'not-logged'
  | 'unreachable'
  | 'certificate'
  | 'denied'
  | 'protected'
  | 'ssh-key'
  /** API ou projet introuvable (404) : GitLab sous un sous-chemin que glab ne connaît pas. */
  | 'not-found'

/**
 * Range la sortie d'erreur de `git push` ou de l'outil de la forge. L'ordre compte : un
 * certificat refusé ou une branche protégée disent aussi « refusé ».
 */
export function forgeFailure(raw: string): ForgeFailure | undefined {
  // `glab` coupe ses messages en colonnes : espaces et retours ramenés à un espace.
  const output = raw.replace(/\s+/g, ' ')
  if (
    /x509:|certificate signed by unknown authority|SSL certificate problem|server certificate verification failed|unable to get local issuer certificate|self[- ]signed certificate/i.test(
      output
    )
  ) {
    return 'certificate'
  }
  if (/protected branch|not allowed to (force )?push code to protected/i.test(output)) {
    return 'protected'
  }
  if (
    /has not been authenticated|not logged in|401 Unauthorized|HTTP Basic: Access denied|Authentication failed|invalid[_ ]token|token (is )?(expired|revoked)/i.test(
      output
    )
  ) {
    return 'not-logged'
  }
  // Clé SSH refusée : pas une question de rôle sur le projet.
  if (/Permission denied \(publickey|Host key verification failed/i.test(output)) return 'ssh-key'
  if (
    /not allowed to push code|403 Forbidden|returned error: 403|HTTP 403|You are not allowed|insufficient[_ ]scope/i.test(
      output
    )
  ) {
    return 'denied'
  }
  if (/\b404\b.{0,40}Not Found|404 Project Not Found/i.test(output)) return 'not-found'
  if (
    /Could not resolve host|no such host|Connection refused|connection refused|timed out|i\/o timeout|Network is unreachable|No route to host|Could not connect|dial tcp|Couldn't connect|context deadline exceeded|Client\.Timeout/i.test(
      output
    )
  ) {
    return 'unreachable'
  }
  return undefined
}

/**
 * Ce qui va au journal ou à l'écran : identifiants d'une URL (`https://oauth2:jeton@…`) et jetons
 * reconnaissables (GitLab, GitHub) masqués.
 */
export function redact(text: string): string {
  return text
    .replace(/\b(https?:\/\/)[^/\s@]+@/gi, '$1***@')
    .replace(/\b(glpat-|gloas-|glrt-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_-]+/g, '$1***')
}

/** État de l'outil d'une forge pour un hôte. */
export type ToolStatus =
  | { ok: true; path: string }
  | {
      ok: false
      /** `unexpected` : sortie que rien ne reconnaît (l'hôte est alors tenu pour inconnu). */
      reason: 'no-tool' | 'unexpected' | ForgeFailure
      path?: string
    }

/** Demande de fusion à ouvrir (« Ouvrir une PR / MR »). */
export interface ChangeRequest {
  cwd: string
  /**
   * Projet du dépôt distant réellement poussé, sans identifiants (`https://hôte/groupe/projet`) :
   * `glab -R`, pour qu'il ne choisisse pas un autre dépôt distant (fork, `upstream`).
   */
  repo?: string
  base: string
  branch: string
  title: string
  body: string
}

/** Ce qu'un adaptateur sait faire avec l'outil de sa forge (arguments toujours en tableau). */
export interface ForgeAdapter {
  kind: ForgeKind
  /** Nom de l'outil, pour le journal. */
  tool: string
  /** Mot de l'interface pour une demande de fusion : `pr` ou `mr` (clés de traduction). */
  noun: 'pr' | 'mr'
  /** Suivi des contrôles et fusion (fiche 176) : seulement GitHub pour l'instant. */
  tracks: boolean
  /** Connexion de l'outil à cet hôte (`undefined` : dépôt local ou github.com, sans `--hostname`). */
  auth(run: Run, path: string, host: string | undefined): Promise<ToolStatus>
  /** Ouvre la demande ; rend son lien, ou la sortie d'erreur de l'outil. */
  create(
    run: Run,
    path: string,
    request: ChangeRequest
  ): Promise<{ url: string } | { code: number; stderr: string; timedOut?: true }>
  /** Demande ouverte de la branche (lien et titre), ou `undefined`. */
  findOpen(
    run: Run,
    path: string,
    request: Pick<ChangeRequest, 'cwd' | 'branch' | 'repo'>
  ): Promise<{ url: string; title?: string } | undefined>
}

/**
 * Projet d'une URL de dépôt distant pour `glab -R` : `https://<hôte>/<chemin>` sans identifiants,
 * port SSH ni `.git` ; `undefined` si le chemin n'est pas lisible.
 */
export function projectRef(url: string, host: string): string | undefined {
  const value = url.trim()
  let path: string | undefined
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      path = new URL(value).pathname
    } catch {
      return undefined
    }
  } else path = /^(?:[^@/\s]+@)?(?:\[[^\]]+\]|[^:/\s]+):(.+)$/.exec(value)?.[1]
  const clean = path
    ?.replace(/^\/+/, '')
    .replace(/\.git\/?$/, '')
    .replace(/\/+$/, '')
  if (!clean || !/^[\w.~-]+(?:\/[\w.~-]+)+$/.test(clean)) return undefined
  // Pas de segment `.` ni `..` : un chemin de projet, rien d'autre.
  if (clean.split('/').some((part) => part === '.' || part === '..')) return undefined
  return `https://${host}/${clean}`
}

/** Premier lien `http(s)` d'une sortie. */
export function firstUrl(output: string): string | undefined {
  return output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^https?:\/\//.test(line))
}
