/**
 * Garde-fou de la synthèse et de la décision (fiche 285, recette réelle S1) : la conversation qui
 * arbitre doit rester en lecture seule le temps du tour de l'étape. Les demandes d'écriture sont
 * refusées (`stepReadOnly`) ; un agent qui écrit sans demander (OpenCode par défaut) ne l'est pas :
 * une empreinte du dossier (`folder-fingerprint.ts`) prise avant l'envoi et comparée à la fin du
 * tour le dit, avec quelques fichiers lus dans `git status`. Rien n'est défait.
 *
 * Mêmes limites que l'empreinte des participants : dossier hors git non surveillé, rien hors du
 * dossier, ni dans les dossiers ignorés.
 */
import { messageOf } from '@shared/errors'
import { folderFingerprint } from '../conversations/folder-fingerprint'
import { log } from '../log'
import type { Run } from '../simulator/run'

/** État du dossier avant le tour de l'étape. */
export interface FolderBaseline {
  workspace: string
  fingerprint: string
  /** Lignes de `git status` au départ : ce qui était déjà modifié n'est pas compté. */
  status: ReadonlySet<string>
}

export interface StepFolder {
  /** `undefined` : dossier hors git, ou git en échec (rien n'est jugé). */
  baseline: (workspace: string) => Promise<FolderBaseline | undefined>
  /** Fichiers touchés depuis le départ ; `undefined` : rien n'a changé ou rien n'est jugé. */
  changes: (before: FolderBaseline) => Promise<string[] | undefined>
}

async function statusLines(run: Run, workspace: string): Promise<string[]> {
  const result = await run('git', ['status', '--porcelain=v1', '-z', '-uall', '--', '.'], {
    cwd: workspace,
    timeoutMs: 30_000
  })
  if (result.code !== 0 || result.timedOut) throw new Error('git status')
  return result.stdout.toString('utf8').split('\0').filter(Boolean)
}

/** Chemin d'une ligne de `git status --porcelain` (`XY chemin`) ; l'origine d'un renommage, seule. */
const pathOf = (line: string) => (/^.. /.test(line) ? line.slice(3) : line)

export function stepFolder(run: Run): StepFolder {
  return {
    baseline: async (workspace) => {
      try {
        const fingerprint = await folderFingerprint(run, workspace)
        return { workspace, fingerprint, status: new Set(await statusLines(run, workspace)) }
      } catch (error) {
        log.debug(`Tour de table : dossier de l'étape non surveillé (${messageOf(error)})`)
        return undefined
      }
    },
    changes: async (before) => {
      try {
        if ((await folderFingerprint(run, before.workspace)) === before.fingerprint)
          return undefined
        const lines = await statusLines(run, before.workspace)
        return [...new Set(lines.filter((l) => !before.status.has(l)).map(pathOf))]
      } catch (error) {
        log.warn(`Tour de table : fin de l'étape non vérifiée (${messageOf(error)})`)
        return undefined
      }
    }
  }
}
