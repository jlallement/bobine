/**
 * Récupère quelques variables du shell de connexion. Une app lancée depuis le Finder n'hérite que
 * d'un environnement minimal : sans ça, `npx`, `bob` ou `opencode` sont introuvables (PATH), et
 * OpenCode chercherait sa configuration globale, skills comprises, ailleurs qu'en terminal
 * (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`).
 *
 * Un shell lent (fichiers rc qui chargent nvm, conda…) a 10 s ; au-delà, ou s'il ne rend pas de
 * PATH, le problème est dit (journal, « Relire le PATH » dans les Réglages — fiche 043).
 *
 * Sous Windows (fiche 229, ADR-0050), ni `$SHELL` ni shell de connexion : lancée par le menu
 * Démarrer, l'app a déjà l'environnement de l'utilisateur ; on relit seulement les variables
 * enregistrées (machine puis utilisateur, comme Windows les assemble), pour voir un agent installé
 * après le lancement. Le PATH y est coupé sur `;`, sans casse, sous la clé `Path`.
 */
import { execFile } from 'node:child_process'
import { t } from 'i18next'
import { pathKey, windowsPowerShell, type ProcessSystem } from './process-launch'

const MARKER = '__BOBINE_ENV__'
/** Attente maximale du shell de connexion. */
export const SHELL_TIMEOUT_MS = 10_000

/**
 * Variables reprises du shell : celles qui disent où les agents trouvent leurs outils et réglages,
 * et comment ils joignent le réseau (proxy, certificats d'entreprise).
 */
export const SHELL_VARIABLES = [
  'PATH',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  // Réseau d'entreprise (fiche 104) : proxy et certificats, pour tous les agents.
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS'
] as const
export type ShellVariable = (typeof SHELL_VARIABLES)[number]

export interface ShellEnvResult {
  values: Partial<Record<ShellVariable, string>>
  /** Pourquoi la lecture est incomplète (shell muet, trop lent, sans PATH). */
  problem?: string
  /** Durée de la lecture. */
  ms: number
}

/** Extrait les valeurs entre les marqueurs, en ignorant le bruit des fichiers rc ; vides omises. */
export function extractEnv(stdout: string): Partial<Record<ShellVariable, string>> {
  const match = new RegExp(`${MARKER}(.*?)${MARKER}END`, 's').exec(stdout)
  if (!match?.[1]) return {}
  const values = match[1].split(MARKER)
  const env: Partial<Record<ShellVariable, string>> = {}
  SHELL_VARIABLES.forEach((name, i) => {
    const value = values[i]?.trim()
    if (value) env[name] = value
  })
  return env
}

/**
 * PATH du shell d'abord (son ordre fait foi), puis les entrées actuelles absentes, sans doublon.
 * Sous Windows : `;`, et deux entrées qui ne diffèrent que par la casse ou un `\` final sont la
 * même.
 */
export function mergePath(
  primary: string | undefined,
  secondary: string | undefined,
  system: ProcessSystem = 'posix'
): string {
  const delimiter = system === 'windows' ? ';' : ':'
  const entries = [...(primary ?? '').split(delimiter), ...(secondary ?? '').split(delimiter)]
  if (system === 'posix') return [...new Set(entries.filter(Boolean))].join(delimiter)
  const seen = new Set<string>()
  const kept: string[] = []
  for (const entry of entries) {
    const key = entry
      .trim()
      .replace(/[\\/]+$/, '')
      .toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    kept.push(entry)
  }
  return kept.join(delimiter)
}

export function loginShellEnv(
  shell = process.env['SHELL'] || '/bin/zsh',
  timeoutMs = SHELL_TIMEOUT_MS
): Promise<ShellEnvResult> {
  const format = SHELL_VARIABLES.map(() => `${MARKER}%s`).join('') + `${MARKER}END`
  const args = SHELL_VARIABLES.map((name) => `"$${name}"`).join(' ')
  const started = Date.now()
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', `printf '${format}' ${args}`],
      { timeout: timeoutMs, encoding: 'utf8' },
      (error, stdout) => {
        const values = extractEnv(stdout ?? '')
        const ms = Date.now() - started
        let problem: string | undefined
        if (error && (error as { killed?: boolean }).killed) {
          problem = t('shellEnv.timeout', { shell, seconds: Math.round(timeoutMs / 1000) })
        } else if (error && Object.keys(values).length === 0) {
          problem = `${shell} : ${error.message.split('\n')[0] ?? t('shellEnv.failed')}`
        } else if (!values.PATH) {
          problem = t('shellEnv.noPath', { shell })
        }
        resolve({ values, ms, ...(problem ? { problem } : {}) })
      }
    )
  })
}

/**
 * Applique l'environnement du shell à l'app (donc aux agents qu'elle lance) : PATH fusionné, et les
 * autres variables que l'app n'a pas déjà (lancée depuis un terminal, elle les a).
 */
export function applyShellEnv(
  shell: Partial<Record<ShellVariable, string>>,
  env: NodeJS.ProcessEnv,
  system: ProcessSystem = 'posix'
): void {
  const key = pathKey(env, system)
  env[key] = mergePath(shell.PATH, env[key], system)
  for (const name of SHELL_VARIABLES) {
    if (name === 'PATH') continue
    if (!env[name] && shell[name]) env[name] = shell[name]
  }
}

/**
 * Script PowerShell (constant) : variables enregistrées de la machine puis de l'utilisateur
 * (`REG_EXPAND_SZ` développées par .NET), PATH assemblé machine puis utilisateur comme Windows le
 * fait à l'ouverture de session ; JSON en UTF-8.
 */
export const WINDOWS_ENV_SCRIPT =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;$o=@{};' +
  `foreach($n in @(${SHELL_VARIABLES.map((n) => `'${n}'`).join(',')})){` +
  "$m=[Environment]::GetEnvironmentVariable($n,'Machine');" +
  "$u=[Environment]::GetEnvironmentVariable($n,'User');" +
  "if($n -eq 'PATH'){$o[$n]=(@($m,$u)|Where-Object{$_})-join ';'}" +
  'elseif($u){$o[$n]=$u}elseif($m){$o[$n]=$m}};' +
  '$o|ConvertTo-Json -Compress'

/** Sortie de `WINDOWS_ENV_SCRIPT` ; vide si illisible. */
export function parseWindowsEnv(stdout: string): Partial<Record<ShellVariable, string>> {
  try {
    const data = JSON.parse(stdout.trim() || '{}') as Record<string, unknown>
    const env: Partial<Record<ShellVariable, string>> = {}
    for (const name of SHELL_VARIABLES) {
      const value = data[name]
      if (typeof value === 'string' && value.trim()) env[name] = value.trim()
    }
    return env
  } catch {
    return {}
  }
}

/** Variables enregistrées de Windows, lues par PowerShell (≈ 0,5 s), sans console. */
export function windowsRegistryEnv(
  powershell: string,
  timeoutMs = SHELL_TIMEOUT_MS
): Promise<ShellEnvResult> {
  const started = Date.now()
  return new Promise((resolve) => {
    execFile(
      powershell,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_ENV_SCRIPT],
      { timeout: timeoutMs, encoding: 'utf8', windowsHide: true },
      (error, stdout) => {
        const values = parseWindowsEnv(stdout ?? '')
        const ms = Date.now() - started
        let problem: string | undefined
        if (error && (error as { killed?: boolean }).killed) {
          problem = t('shellEnv.timeout', {
            shell: powershell,
            seconds: Math.round(timeoutMs / 1000)
          })
        } else if (error && Object.keys(values).length === 0) {
          problem = `${powershell} : ${error.message.split('\n')[0] ?? t('shellEnv.failed')}`
        } else if (!values.PATH) {
          problem = t('shellEnv.noPath', { shell: powershell })
        }
        resolve({ values, ms, ...(problem ? { problem } : {}) })
      }
    )
  })
}

/**
 * Environnement de l'utilisateur pour ce système : shell de connexion sous Unix, variables
 * enregistrées sous Windows. `source` et `read` : lignes du journal (inchangées sous Unix).
 */
export async function readUserEnv(
  system: ProcessSystem,
  env: NodeJS.ProcessEnv = process.env
): Promise<ShellEnvResult & { source: string; read: string }> {
  if (system === 'windows') {
    const result = await windowsRegistryEnv(windowsPowerShell(env))
    return { ...result, source: 'Variables de Windows', read: 'Variables de Windows relues' }
  }
  const result = await loginShellEnv()
  return {
    ...result,
    source: 'Shell de connexion',
    read: 'Environnement du shell de connexion lu'
  }
}
