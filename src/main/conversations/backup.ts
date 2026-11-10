/**
 * Sauvegarde du profil (fiches 043, 197) : copie datée, dans un dossier choisi hors du dossier de
 * données, de tout ce qui fait le profil — conversations (corbeille comprise), réglages,
 * autorisations retenues, tâches planifiées, consommation, mémoire (souvenirs et empreintes,
 * fiche 182), marque de version — sans les secrets (clés d'API et clé des empreintes de la
 * mémoire, chiffrées par le trousseau de ce Mac ; variables d'environnement des agents déclarés ;
 * identifiants du proxy) ni les fichiers temporaires. Restaurée sur un autre Mac, les souvenirs
 * sont à revalider (leurs empreintes ne correspondent plus à la clé de ce Mac). Écrite dans `<nom>.partiel`, renommée à la fin : une
 * sauvegarde interrompue (disque plein) ne passe jamais pour complète. Un `bobine-sauvegarde.json`
 * la décrit, écrit en dernier.
 *
 * `checkBackup` dit si un dossier est une sauvegarde restaurable : son type de chaque entrée, aucun
 * lien symbolique (une sauvegarde piégée ferait écrire ou effacer ailleurs), un format connu. La
 * restauration elle-même est dans `restore.ts`.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { t } from 'i18next'
import type { BackupCheck } from '@shared/profile'
import { PROFILE_FILE, PROFILE_FORMAT_VERSION, readProfileMark } from '../profile-format'
import { fsyncDir } from '../storage'

/** Fichier qui décrit une sauvegarde. */
export const BACKUP_MANIFEST = 'bobine-sauvegarde.json'

/** Ce que contient un profil, et donc une sauvegarde, avec le type de chaque entrée. */
export const PROFILE_ENTRIES = {
  conversations: 'dir',
  'settings.json': 'file',
  'approvals.json': 'file',
  'scheduled-tasks.json': 'file',
  'usage.sqlite': 'file',
  // Mémoire (fiche 182) : souvenirs et empreintes ; jamais `memory.key` (trousseau de ce Mac).
  memory: 'dir',
  'memory.approved.json': 'file',
  [PROFILE_FILE]: 'file'
} as const satisfies Record<string, 'dir' | 'file'>

export type ProfileEntry = keyof typeof PROFILE_ENTRIES
export const ENTRY_NAMES = Object.keys(PROFILE_ENTRIES) as ProfileEntry[]

export interface Manifest {
  formatVersion: number
  app: string
  createdAt: string
  conversations: number
}

/** Copie d'un fichier (injectée par les essais : disque plein simulé). */
export type CopyFile = (source: string, target: string) => Promise<void>

export function backupFolderName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `bobine-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

/** Ce dossier, ou `-2`, `-3`… s'il existe déjà (deux sauvegardes dans la même minute). */
export function freeFolder(path: string): string {
  let candidate = path
  for (let n = 2; existsSync(candidate); n++) candidate = `${path}-${n}`
  return candidate
}

/** `inner` est-il `outer` ou dedans ? */
export function isInside(inner: string, outer: string): boolean {
  // Chemins réels : une cible qui passe par un lien vers le dossier de données est dedans.
  const real = (path: string) => {
    try {
      return realpathSync(resolve(path))
    } catch {
      return resolve(path)
    }
  }
  const rel = relative(real(outer), real(inner))
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !rel.includes(`..${sep}`))
}

/** Conversations d'un dossier `conversations/` (entrées de l'index ; sinon fils sur le disque). */
export function countConversations(conversationsDir: string): number {
  try {
    const index = JSON.parse(readFileSync(join(conversationsDir, 'index.json'), 'utf8')) as unknown
    if (Array.isArray(index)) return index.length
  } catch {
    // Index illisible : on compte les fils.
  }
  try {
    return readdirSync(conversationsDir).filter((n) => n.endsWith('.json') && n !== 'index.json')
      .length
  } catch {
    return 0
  }
}

/**
 * Réglages sans leurs secrets : variables d'environnement des agents déclarés (clés d'API) et
 * identifiants dans l'adresse du proxy. Fichier illisible : copié tel quel (il n'est pas lu).
 */
export function settingsWithoutSecrets(text: string): string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return text
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return text
  const settings = { ...(raw as Record<string, unknown>) }
  if (Array.isArray(settings['customAgents'])) {
    settings['customAgents'] = settings['customAgents'].map((agent: unknown) => {
      if (typeof agent !== 'object' || agent === null) return agent
      const { env: _env, ...rest } = agent as Record<string, unknown>
      return rest
    })
  }
  const network = settings['network']
  if (typeof network === 'object' && network !== null) {
    const proxy = (network as Record<string, unknown>)['proxy']
    if (typeof proxy === 'string') {
      settings['network'] = { ...network, proxy: proxyWithoutCredentials(proxy) }
    }
  }
  return `${JSON.stringify(settings, null, 2)}\n`
}

function proxyWithoutCredentials(proxy: string): string {
  try {
    const url = new URL(proxy)
    if (!url.username && !url.password) return proxy
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    // Adresse que `URL` ne lit pas : on retire ce qui précède un « @ ».
    return proxy.replace(/\/\/[^/@]*@/, '//')
  }
}

/**
 * Sauvegarde le profil dans `targetDir` ; rend le dossier créé. Refusée dans le dossier de données
 * lui-même. Tout échec (sauf un fichier absent) fait échouer la sauvegarde, sans rien laisser.
 */
export async function backupProfile(
  userData: string,
  targetDir: string,
  appVersion: string,
  now = new Date(),
  copy: CopyFile = (source, target) => cp(source, target)
): Promise<string> {
  if (isInside(targetDir, userData)) {
    throw new Error(t('profile.backup.insideProfile'))
  }
  const folder = freeFolder(join(targetDir, backupFolderName(now)))
  const partial = `${folder}.partiel`
  await rm(partial, { recursive: true, force: true })
  await mkdir(partial, { recursive: true })
  try {
    // La marque d'abord : une sauvegarde coupée net (sans description) ne passe jamais pour une
    // sauvegarde d'avant la 0.11 (`checkBackup` refuse une marque sans description).
    await optional(copy(join(userData, PROFILE_FILE), join(partial, PROFILE_FILE)))
    const conversations = join(userData, 'conversations')
    if (existsSync(conversations)) {
      await cp(conversations, join(partial, 'conversations'), {
        recursive: true,
        filter: (source) => !source.endsWith('.tmp')
      })
    } else {
      await mkdir(join(partial, 'conversations'))
    }
    const memory = join(userData, 'memory')
    if (existsSync(memory)) {
      await cp(memory, join(partial, 'memory'), {
        recursive: true,
        filter: (source) => !source.endsWith('.tmp')
      })
    }
    for (const name of ['approvals.json', 'scheduled-tasks.json', 'memory.approved.json']) {
      await optional(copy(join(userData, name), join(partial, name)))
    }
    const settings = join(userData, 'settings.json')
    if (existsSync(settings)) {
      const text = settingsWithoutSecrets(readFileSync(settings, 'utf8'))
      await writeFile(join(partial, 'settings.json'), text)
    }
    copyUsageDb(join(userData, 'usage.sqlite'), join(partial, 'usage.sqlite'))
    const manifest: Manifest = {
      formatVersion: PROFILE_FORMAT_VERSION,
      app: appVersion,
      createdAt: now.toISOString(),
      conversations: countConversations(conversations)
    }
    // Écrite en dernier : sans elle, une sauvegarde de la 0.11 ou après n'est pas restaurable.
    await writeFile(join(partial, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
    await rename(partial, folder)
    fsyncDir(targetDir)
    return folder
  } catch (error) {
    await rm(partial, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

/** Un fichier facultatif absent n'est pas une erreur ; tout le reste en est une. */
async function optional(copying: Promise<void>): Promise<void> {
  try {
    await copying
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }
}

/**
 * Copie cohérente de la base de consommation, ouverte par l'app (WAL) : `VACUUM INTO` depuis une
 * connexion en lecture. Base absente : rien ; tout autre échec fait échouer la sauvegarde.
 */
function copyUsageDb(source: string, target: string): void {
  if (!existsSync(source)) return
  const db = new DatabaseSync(source, { readOnly: true })
  try {
    db.prepare('VACUUM INTO ?').run(target)
  } finally {
    db.close()
  }
}

/** Le dossier est-il une sauvegarde restaurable par cette version ? */
export function checkBackup(folder: string, userData: string): BackupCheck {
  const refused = (reason: 'notBackup' | 'newer'): BackupCheck => ({ ok: false, reason })
  // Sauvegarde laissée en route par un arrêt brutal : jamais restaurable.
  if (basename(folder).endsWith('.partiel')) return refused('notBackup')
  if (!isPlain(folder, 'dir')) return refused('notBackup')
  const manifest = readManifest(folder)
  if (manifest === 'invalid') return refused('notBackup')
  const hasIndex = isPlain(join(folder, 'conversations', 'index.json'), 'file')
  // Depuis la 0.11, une sauvegarde a sa description (écrite en dernier) ; avant, l'index suffit.
  if (!manifest && (!hasIndex || existsSync(join(folder, PROFILE_FILE))))
    return refused('notBackup')
  for (const name of ENTRY_NAMES) {
    const path = join(folder, name)
    const kind = PROFILE_ENTRIES[name]
    if (lexists(path) && !isPlain(path, kind, kind === 'dir')) {
      return refused('notBackup')
    }
  }
  const mark = readProfileMark(folder)
  if (mark === 'unreadable') return refused('notBackup')
  const format = Math.max(manifest?.formatVersion ?? 1, mark?.formatVersion ?? 1)
  if (format > PROFILE_FORMAT_VERSION) return refused('newer')
  return {
    ok: true,
    folder,
    createdAt: manifest?.createdAt ?? statSync(folder).mtime.toISOString(),
    conversations: countConversations(join(folder, 'conversations')),
    currentConversations: countConversations(join(userData, 'conversations'))
  }
}

function lexists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

/**
 * Le chemin est un vrai fichier ou un vrai dossier (pas un lien symbolique) ; pour un dossier
 * `deep`, tout ce qu'il contient aussi, à toute profondeur.
 */
function isPlain(path: string, kind: 'dir' | 'file', deep = false): boolean {
  let info
  try {
    info = lstatSync(path)
  } catch {
    return false
  }
  if (info.isSymbolicLink()) return false
  if (kind === 'file') return info.isFile()
  if (!info.isDirectory()) return false
  if (!deep) return true
  try {
    return readdirSync(path, { withFileTypes: true }).every((entry) => {
      if (entry.isSymbolicLink()) return false
      const child = join(path, entry.name)
      if (entry.isDirectory()) return isPlain(child, 'dir', true)
      return entry.isFile()
    })
  } catch {
    return false
  }
}

/** Description de la sauvegarde ; `'invalid'` si elle est là mais ne se lit pas. */
export function readManifest(folder: string): Partial<Manifest> | 'invalid' | undefined {
  const path = join(folder, BACKUP_MANIFEST)
  if (!lexists(path)) return undefined
  if (!isPlain(path, 'file')) return 'invalid'
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'invalid'
    const r = raw as Partial<Record<keyof Manifest, unknown>>
    if (!Number.isInteger(r.formatVersion) || (r.formatVersion as number) < 1) return 'invalid'
    return {
      formatVersion: r.formatVersion as number,
      ...(typeof r.createdAt === 'string' && !isNaN(Date.parse(r.createdAt))
        ? { createdAt: r.createdAt }
        : {})
    }
  } catch {
    return 'invalid'
  }
}
