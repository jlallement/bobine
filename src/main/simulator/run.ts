/**
 * Lancement de commandes (`xcrun simctl`, `axe`, `xcodebuild`) : injecté dans le simulateur pour
 * pouvoir le tester sans Xcode.
 */
import { execFile } from 'node:child_process'
import { launchContext, launchSystem, planLaunch, withClosedFds } from '../process-launch.ts'

export interface RunResult {
  code: number
  stdout: Buffer
  stderr: string
  /** Arrêtée au bout de `timeoutMs` (tuée par `execFile`), pas sortie d'elle-même. */
  timedOut?: true
}

export type Run = (
  file: string,
  args: string[],
  options?: { timeoutMs?: number; input?: string | Buffer; cwd?: string; env?: NodeJS.ProcessEnv }
) => Promise<RunResult>

/** Exécution réelle ; ne lève jamais : le code de sortie et la sortie d'erreur sont rendus. */
export const runCommand: Run = (file, args, options = {}) =>
  new Promise((resolve) => {
    // Sous Windows, un script `.cmd` (npm) ne se lance pas directement (`EINVAL`) : `cmd.exe`,
    // comme les agents (`planLaunch`, fiche 229). Linux : par le relais qui ferme les descripteurs
    // hérités du main (fiche 145) ; macOS : tel quel.
    const env = options.env ?? process.env
    const windows = launchSystem() === 'windows'
    const plan = windows
      ? planLaunch(file, args, launchContext(env))
      : withClosedFds(
          { file, args, verbatim: false, kind: 'direct' },
          launchContext(env),
          undefined,
          { cwd: options.cwd }
        )
    const child = execFile(
      plan.file,
      plan.args,
      {
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
        // Sous Windows, pas de fenêtre de console (git, adb…) ; rien de changé ailleurs.
        ...(windows ? { windowsHide: true } : {}),
        ...(plan.verbatim ? { windowsVerbatimArguments: true } : {}),
        ...(options.cwd ? { cwd: options.cwd } : {}),
        ...(options.env ? { env: options.env } : {})
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : error
              ? 1
              : 0
        const killed = !!error && (error as { killed?: unknown }).killed === true
        resolve({
          code,
          stdout,
          stderr: `${stderr.toString('utf8')}${error && !stderr.length ? error.message : ''}`,
          ...(killed ? { timedOut: true as const } : {})
        })
      }
    )
    // Un enfant peut sortir sans lire son entrée (`git check-ignore --stdin` hors dépôt) : l'écriture
    // dans le tube fermé échoue (`EPIPE`, fiche 250). Sans écouteur, l'erreur du flux serait une
    // exception non gérée du main ; ici elle est sans objet : le code de sortie est rendu par le rappel.
    const stdin = child.stdin
    if (options.input !== undefined && stdin) {
      stdin.on('error', () => {})
      if (stdin.writable && !stdin.destroyed) stdin.end(options.input)
    }
  })
