/**
 * Arrêt d'un groupe de processus (fiche 138) : SIGTERM, puis SIGKILL au bout de 3 s. Les agents,
 * les sondes MCP et les serveurs de développement sont lancés dans leur propre groupe (`detached`) :
 * le groupe emporte toute la chaîne (ex. `npx` → adaptateur → agent). N'importe pas `electron`.
 */
import type { ChildProcess } from 'node:child_process'

/** Délai laissé à un processus pour s'arrêter de lui-même avant le SIGKILL. */
export const STOP_GRACE_MS = 3000

/**
 * Groupes qui ont reçu SIGTERM et attendent leur SIGKILL (fiche 195). Le minuteur est `unref` : en
 * quittant, le main sortirait avant lui, et un agent qui ignore SIGTERM survivrait. `will-quit`
 * attend donc `settleStoppedGroups`.
 */
const stopping = new Set<number>()

/** Signal au groupe, sinon au processus seul ; `false` s'il n'y a plus personne à qui l'envoyer. */
export function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal)
    return true
  } catch {
    try {
      process.kill(pid, signal)
      return true
    } catch {
      return false // Déjà arrêté.
    }
  }
}

/** Le groupe (ou le processus) a-t-il encore un membre vivant ? */
export const groupAlive = (pid: number): boolean => signalGroup(pid, 0)

/**
 * SIGTERM au groupe, puis SIGKILL au groupe après `graceMs`. Le SIGKILL part même si le chef est
 * déjà sorti : ses descendants restent dans le groupe, et l'identifiant d'un groupe n'est pas
 * réattribué tant qu'un membre vit ; s'il n'en reste aucun, l'envoi échoue sans effet.
 */
export function terminateGroup(pid: number, graceMs = STOP_GRACE_MS): boolean {
  // Seul un vrai groupe (lancé `detached`) est attendu en quittant : un pid seul pourrait être
  // réattribué entre-temps, le SIGKILL final ne vise que des groupes.
  if (signalOnlyGroup(pid, 'SIGTERM')) stopping.add(pid)
  else if (!signalGroup(pid, 'SIGTERM')) return false
  setTimeout(() => {
    stopping.delete(pid)
    signalGroup(pid, 'SIGKILL')
  }, graceMs).unref()
  return true
}

/** Signal au groupe seulement, sans repli sur le processus seul. */
function signalOnlyGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal)
    return true
  } catch {
    return false
  }
}

/** Groupes arrêtés dont un membre vit encore (essais, journal). */
export function stoppingGroups(): number[] {
  return [...stopping].filter((pid) => signalOnlyGroup(pid, 0))
}

/**
 * Attend au plus `waitMs` que les groupes arrêtés soient vides, puis envoie SIGKILL à ceux qui
 * vivent encore. Rend le nombre de groupes tués ainsi. Immédiat s'il n'y a rien à attendre.
 */
export async function settleStoppedGroups(waitMs = 1500, stepMs = 50): Promise<number> {
  const deadline = Date.now() + waitMs
  while (stoppingGroups().length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, stepMs))
  }
  const alive = stoppingGroups()
  for (const pid of alive) signalOnlyGroup(pid, 'SIGKILL')
  stopping.clear()
  return alive.length
}

/**
 * Le chef d'un groupe est sorti, ses descendants vivent peut-être encore (commande lancée par un
 * agent tué par `kill -9`, fiche 195) : SIGTERM au groupe, puis SIGKILL au bout de `graceMs`. Au
 * groupe seulement, jamais au pid seul : un identifiant de groupe n'est pas réattribué tant qu'un
 * membre vit, et un groupe vide fait échouer l'envoi sans effet. Rend vrai s'il restait quelqu'un.
 */
export function terminateLeftovers(pgid: number, graceMs = STOP_GRACE_MS): boolean {
  if (!signalOnlyGroup(pgid, 'SIGTERM')) return false
  stopping.add(pgid)
  setTimeout(() => {
    stopping.delete(pgid)
    signalOnlyGroup(pgid, 'SIGKILL')
  }, graceMs).unref()
  return true
}

/**
 * Arrête un processus lancé par l'app et son groupe. Déjà sorti : ce qui reste de son groupe est
 * arrêté (fiche 195), sans jamais viser son pid seul.
 */
export function stopGroup(child: ChildProcess, graceMs = STOP_GRACE_MS): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    if (child.pid !== undefined) terminateLeftovers(child.pid, graceMs)
    return
  }
  if (child.pid === undefined || !terminateGroup(child.pid, graceMs)) child.kill()
}
