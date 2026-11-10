/**
 * Récupère quelques variables du shell de connexion. Une app lancée depuis le Finder n'hérite que
 * d'un environnement minimal : sans ça, `npx`, `bob` ou `opencode` sont introuvables (PATH), et
 * OpenCode chercherait sa configuration globale, skills comprises, ailleurs qu'en terminal
 * (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`).
 *
 * Un shell lent (fichiers rc qui chargent nvm, conda…) a 10 s ; au-delà, ou s'il ne rend pas de
 * PATH, le problème est dit (journal, « Relire le PATH » dans les Réglages — fiche 043).
 */
import { execFile } from 'node:child_process'
import { t } from 'i18next'

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

/** PATH du shell d'abord (son ordre fait foi), puis les entrées actuelles absentes, sans doublon. */
export function mergePath(primary: string | undefined, secondary: string | undefined): string {
  const entries = [...(primary ?? '').split(':'), ...(secondary ?? '').split(':')]
  return [...new Set(entries.filter(Boolean))].join(':')
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
  env: NodeJS.ProcessEnv
): void {
  env['PATH'] = mergePath(shell.PATH, env['PATH'])
  for (const name of SHELL_VARIABLES) {
    if (name === 'PATH') continue
    if (!env[name] && shell[name]) env[name] = shell[name]
  }
}
