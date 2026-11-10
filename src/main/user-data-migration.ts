/**
 * Dossier de données de l'ancien nom (fiches 069, 071, ADR-0013) : au premier lancement de Bobine,
 * `~/Library/Application Support/bob-desktop` devient `…/bobine` (historique, réglages, données du
 * navigateur intégré). Un lien `bob-desktop` → `bobine` reste à l'ancienne place : les chemins déjà
 * enregistrés (dossier de travail par défaut, sessions des agents) restent valables.
 *
 * Electron crée le dossier de données, vide, avant que le code de l'app ne tourne (fiche 071) : un
 * dossier vide compte donc comme absent. Si le nouveau dossier a déjà des données (installation
 * passée par cette erreur), les conversations de l'ancien qui manquent y sont copiées, une fois.
 *
 * Pas tant que l'ancienne app est ouverte : elle écrit dans ce dossier. Chromium y tient un verrou,
 * le lien `SingletonLock` → « <machine>-<pid> » ; le processus nommé tourne-t-il encore ?
 */
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, join } from 'node:path'
import { ConversationStore } from './conversations/store'

/**
 * `none` : rien à faire ; `moved` : dossier renommé ; `imported` : conversations copiées depuis
 * l'ancien dossier ; `busy` : l'ancienne app est ouverte.
 */
export type UserDataMigration =
  { kind: 'none' | 'moved' | 'busy' } | { kind: 'imported'; conversations: number }

/** Posé dans le nouveau dossier une fois l'import fait : une conversation supprimée ne revient pas. */
export const IMPORT_MARKER = '.bob-desktop-importe'

export function migrateUserData(
  from: string,
  to: string,
  isRunning: (pid: number) => boolean = processIsRunning
): UserDataMigration {
  if (!isDirectoryNotLink(from)) return { kind: 'none' }
  const fresh = !existsSync(to) || isEmptyDirectory(to)
  if (!fresh && existsSync(join(to, IMPORT_MARKER))) return { kind: 'none' }
  const pid = lockOwner(from)
  if (pid !== undefined && pid !== process.pid && isRunning(pid)) return { kind: 'busy' }
  if (fresh && replaceEmpty(from, to)) return { kind: 'moved' }
  const conversations = importLegacyConversations(
    join(from, 'conversations'),
    join(to, 'conversations')
  )
  writeFileSync(join(to, IMPORT_MARKER), `${new Date().toISOString()}\n`)
  return { kind: 'imported', conversations }
}

/** Renomme `from` en `to` (absent, ou vide : créé par Electron) ; faux si `to` s'est rempli entre-temps. */
function replaceEmpty(from: string, to: string): boolean {
  try {
    if (existsSync(to)) rmdirSync(to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOTEMPTY') return false
    throw error
  }
  renameSync(from, to)
  try {
    // Lien relatif : les deux dossiers sont voisins.
    symlinkSync(basename(to), from)
  } catch {
    // Sans le lien, seuls des chemins enregistrés vers l'ancien dossier seraient perdus.
  }
  return true
}

/**
 * Copie dans `to` les conversations de `from` qu'il n'a pas (index fusionné, fils copiés) ; rien
 * n'est écrasé ni retiré de l'ancien dossier. Rend le nombre de conversations copiées.
 */
export function importLegacyConversations(from: string, to: string): number {
  if (!isDirectoryNotLink(from)) return 0
  const legacy = new ConversationStore(from).loadIndex()
  const store = new ConversationStore(to)
  const current = store.loadIndex()
  const known = new Set(current.map((r) => r.id))
  const added = legacy.filter((r) => !known.has(r.id))
  if (added.length === 0) return 0
  for (const record of added) {
    try {
      copyFileSync(
        join(from, `${record.id}.json`),
        join(to, `${record.id}.json`),
        constants.COPYFILE_EXCL
      )
    } catch {
      // Pas de fil (conversation vide), ou déjà là : l'entrée de l'index suffit.
    }
  }
  store.saveIndex([...current, ...added])
  return added.length
}

/** Processus qui tient le dossier d'après le verrou de Chromium, s'il y en a un. */
export function lockOwner(dir: string): number | undefined {
  let target: string
  try {
    target = readlinkSync(join(dir, 'SingletonLock'))
  } catch {
    return undefined
  }
  const pid = Number(/-(\d+)$/.exec(target)?.[1])
  return Number.isInteger(pid) && pid > 0 ? pid : undefined
}

function isDirectoryNotLink(path: string): boolean {
  try {
    // Un lien (dossier déjà déplacé) ne compte pas.
    return lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

function isEmptyDirectory(path: string): boolean {
  try {
    return lstatSync(path).isDirectory() && readdirSync(path).length === 0
  } catch {
    return false
  }
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM : le processus existe, mais appartient à quelqu'un d'autre.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
