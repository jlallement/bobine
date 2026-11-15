/**
 * Pseudo-terminaux réels (`node-pty`, ADR-0007). Son script d'installation n'est pas exécuté : l'app
 * rend elle-même `spawn-helper` exécutable avant le premier terminal.
 */
import { accessSync, chmodSync, constants, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { SpawnPty } from './terminal-manager'
import { launchSystem, relayed, type ProcessSystem } from '../process-launch'

const require = createRequire(import.meta.url)

let helperChecked = false

/** `spawn-helper` des binaires précompilés de node-pty, rendu exécutable si besoin. */
function ensureSpawnHelper(): void {
  if (helperChecked) return
  helperChecked = true
  // App packagée : les binaires sont hors de l'archive asar (`asarUnpack`, fiche 012).
  const root = dirname(require.resolve('node-pty/package.json')).replace(
    /app\.asar(?!\.unpacked)/,
    'app.asar.unpacked'
  )
  for (const helper of [
    join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
    join(root, 'build', 'Release', 'spawn-helper')
  ]) {
    if (!existsSync(helper)) continue
    try {
      accessSync(helper, constants.X_OK)
    } catch {
      chmodSync(helper, 0o755)
    }
  }
}

/**
 * Windows (fiche 229) : ConPTY de node-pty (`conpty.dll` et `OpenConsole.exe`, livrés). Sans
 * cette option, fermer un terminal fait lancer par node-pty un agent par `child_process.fork`,
 * qui passe par `ELECTRON_RUN_AS_NODE` ; le fusible RunAsNode de l'app empaquetée l'interdit :
 * « Bobine a rencontré un problème interne » (vu dans l'app installée). Ailleurs : rien.
 */
export function windowsPtyOptions(system: ProcessSystem): { useConptyDll?: true } {
  return system === 'windows' ? { useConptyDll: true } : {}
}

export const spawnNodePty: SpawnPty = (shell, args, options) => {
  ensureSpawnHelper()
  const pty = require('node-pty') as typeof import('node-pty')
  // Linux : le shell du terminal ne reçoit pas les descripteurs du main (fiche 145) ; même pid
  // après `exec`, même nom de processus. Ailleurs, tel quel.
  const [file, argv] = relayed(shell, args, options.env as NodeJS.ProcessEnv, {
    cwd: options.cwd
  })
  const term = pty.spawn(file, argv, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env as Record<string, string>,
    ...windowsPtyOptions(launchSystem())
  })
  return {
    pid: term.pid,
    get process() {
      // Peut manquer pendant qu'un programme se termine.
      return term.process ?? ''
    },
    onData: (listener) => void term.onData(listener),
    onExit: (listener) => void term.onExit((e) => listener(e.exitCode)),
    write: (data) => term.write(data),
    resize: (cols, rows) => term.resize(cols, rows),
    kill: () => term.kill()
  }
}
