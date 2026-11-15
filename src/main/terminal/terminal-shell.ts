/**
 * Shell des terminaux intégrés (fiche 034 ; Windows : fiche 229, D5). Unix : celui de
 * l'utilisateur (`$SHELL`, sinon zsh), en shell de connexion — rien n'est imposé ici, le
 * gestionnaire garde ses valeurs par défaut. Windows : PowerShell 7 (`pwsh`) s'il est dans le PATH,
 * sinon Windows PowerShell 5.1 (toujours présent), sans bannière. N'importe pas `electron`.
 */
import { findProgram, windowsPowerShell, type LaunchContext } from '../process-launch'

export interface TerminalShell {
  shell?: string
  shellArgs?: string[]
  shellNames?: string[]
}

export function terminalShell(ctx: LaunchContext): TerminalShell {
  if (ctx.system === 'posix') return {}
  const pwsh = findProgram('pwsh', ctx)
  const shell = pwsh && /\.exe$/i.test(pwsh) ? pwsh : windowsPowerShell(ctx.env)
  return { shell, shellArgs: ['-NoLogo'], shellNames: ['pwsh', 'powershell', 'cmd'] }
}
