/**
 * Lancement de commandes (`xcrun simctl`, `axe`, `xcodebuild`) : injecté dans le simulateur pour
 * pouvoir le tester sans Xcode.
 */
import { execFile } from 'node:child_process'

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
    const child = execFile(
      file,
      args,
      {
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
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
    if (options.input !== undefined) child.stdin?.end(options.input)
  })
