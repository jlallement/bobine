/**
 * « Arrêter » une commande d'un terminal du panneau qui ignore Ctrl+C (fiche 166) : SIGTERM au
 * groupe de processus au premier plan du terminal de ce shell. node-pty ne donne que le nom du
 * programme au premier plan ; `ps -o tpgid=` donne son groupe (macOS et Linux).
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Groupe au premier plan du terminal dont `shellPid` est le shell ; `undefined` : inconnu. */
export async function foregroundGroup(shellPid: number): Promise<number | undefined> {
  if (process.platform === 'win32') return undefined
  const { stdout } = await run('ps', ['-o', 'tpgid=', '-p', String(shellPid)], { timeout: 2000 })
  const group = Number(stdout.trim())
  return Number.isInteger(group) && group > 1 ? group : undefined
}

/**
 * SIGTERM au groupe au premier plan, jamais au shell lui-même (à l'invite, le groupe au premier
 * plan est le sien : rien n'est envoyé).
 */
export async function terminateForeground(shellPid: number): Promise<void> {
  const group = await foregroundGroup(shellPid)
  if (group === undefined || group === shellPid) return
  process.kill(-group, 'SIGTERM')
}
