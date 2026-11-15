/**
 * Registre des processus sous Windows (fiches 138, 229 ; ADR-0050) : au démarrage, ce qui reste
 * du lancement précédent est relu par `Win32_Process` au lieu de `ps`. Avec les objets de tâche,
 * le noyau a déjà tout arrêté quand le main a planté ; ce relevé sert au repli (`taskkill`), où
 * l'agent lancé par un `.cmd` peut survivre. Pas de groupes : un arbre se reconnaît par les
 * parents. Mêmes règles qu'avec `ps` : même commande, même heure de départ, sinon pid
 * réattribué, jamais touché. N'importe pas `electron`.
 */
import { execFile } from 'node:child_process'
import { win32 } from 'node:path'
import { messageOf } from '@shared/errors'
import type { ChildEntry } from './process-registry'
import {
  parseWin32Processes,
  WIN32_PROCESS_SCRIPT,
  type WinProcessRow
} from './process-tree-windows'

/** Écart toléré entre l'heure notée et l'heure de création lue (comme avec `ps`). */
const START_TOLERANCE_MS = 3000

/**
 * La ligne de commande lue est-elle celle lancée ? Comme `sameCommand` de `ps`, sans casse (NTFS,
 * `cmd.exe`), nom du programme sans dossier ni extension (`bob` lancé par `bob.cmd`).
 */
export function sameCommandWindows(commandLine: string, command: string[]): boolean {
  const [program = '', ...args] = command
  const name = win32.basename(program).replace(/\.(exe|cmd|bat|com|ps1)$/i, '')
  const line = commandLine.toLowerCase()
  let from = 0
  for (const part of [name, ...args]) {
    const at = line.indexOf(part.toLowerCase(), from)
    if (at === -1) return false
    from = at + part.length
  }
  return true
}

export interface WindowsOrphanVerdict {
  /** Racines des arbres à arrêter (`taskkill /T`), par entrée. */
  stop: Array<{ entry: ChildEntry; roots: WinProcessRow[] }>
  skipped: Array<{ entry: ChildEntry; reason: string }>
}

/**
 * Quels arbres du lancement précédent arrêter (fonction pure). Chef retrouvé : même commande et
 * même heure de création, sinon pid réattribué. Chef disparu : ses enfants créés après lui (leur
 * parent noté est toujours son pid ; Windows ne les rattache à personne) sont les racines.
 */
export function orphanTreesWindows(
  entries: ChildEntry[],
  rows: WinProcessRow[],
  self: number
): WindowsOrphanVerdict {
  const verdict: WindowsOrphanVerdict = { stop: [], skipped: [] }
  for (const entry of entries) {
    if (entry.pid === self) continue
    const started = Date.parse(entry.startedAt)
    const leader = rows.find((r) => r.pid === entry.pid)
    if (leader) {
      const reason = !sameCommandWindows(leader.command, entry.command)
        ? 'autre commande'
        : Math.abs(leader.startedAt - started) > START_TOLERANCE_MS
          ? 'autre heure de départ'
          : undefined
      if (reason) verdict.skipped.push({ entry, reason: `pid réattribué (${reason})` })
      else verdict.stop.push({ entry, roots: [leader] })
      continue
    }
    const orphans = rows.filter(
      (r) => r.ppid === entry.pid && r.startedAt >= started - START_TOLERANCE_MS && r.pid !== self
    )
    if (orphans.length > 0) verdict.stop.push({ entry, roots: orphans })
  }
  return verdict
}

export interface WindowsReapDeps {
  list: () => Promise<string>
  taskkill: (pid: number) => void
  log: (line: string) => void
  self: number
}

const describe = (entry: ChildEntry) =>
  `${entry.command.join(' ')} (pid ${entry.pid}, lancé le ${entry.startedAt})`

/** Arrête les arbres restés du lancement précédent. Ne lève jamais. */
export async function reapOrphansWindows(
  entries: ChildEntry[],
  deps: WindowsReapDeps
): Promise<WindowsOrphanVerdict> {
  const none: WindowsOrphanVerdict = { stop: [], skipped: [] }
  if (entries.length === 0) return none
  let rows: WinProcessRow[]
  try {
    rows = parseWin32Processes(await deps.list())
  } catch (error) {
    deps.log(`Processus du lancement précédent non vérifiés (Win32_Process : ${messageOf(error)})`)
    return none
  }
  const verdict = orphanTreesWindows(entries, rows, deps.self)
  for (const { entry, roots } of verdict.stop) {
    for (const root of roots) {
      try {
        deps.taskkill(root.pid)
      } catch {
        // Parti entre-temps.
      }
    }
    deps.log(
      `Processus resté du lancement précédent arrêté : ${describe(entry)}, ${roots.length} arbre(s)`
    )
  }
  for (const { entry, reason } of verdict.skipped) {
    deps.log(`Processus du lancement précédent laissé : ${describe(entry)} — ${reason}`)
  }
  return verdict
}

/** Processus de la machine par PowerShell (`Get-CimInstance`, ≈ 1 s), sans console. */
export function listWin32Processes(powershell: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      powershell,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WIN32_PROCESS_SCRIPT],
      { maxBuffer: 32 * 1024 * 1024, timeout: 20_000, windowsHide: true, encoding: 'utf8' },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    )
  })
}
