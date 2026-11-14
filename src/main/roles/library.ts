/**
 * Bibliothèque des rôles (fiche 223, ADR-0045) : rôles fournis, personnels (`<données>/roles/`,
 * tous les projets) et du projet (`<dossier>/.bobine/roles/`, partagés par git). À nom égal, le
 * projet l'emporte sur le personnel, qui l'emporte sur le fourni ; un nom désactivé (réglages)
 * n'est plus proposé.
 *
 * Relu à chaud sans surveillant : chaque lecture compare l'empreinte du dossier (noms, tailles,
 * dates des fichiers) et ne relit que si elle a changé. Pas de `fs.watch` : un surveillant par
 * projet ouvert serait à fermer, et certains éditeurs remplacent le fichier sans évènement fiable.
 * Lectures synchrones et bornées (100 fichiers de 64 Ko) : la liste sert au moment d'ouvrir une
 * session ou d'appeler un outil, sans attendre.
 *
 * Le dossier du projet est celui de la conversation **mère** : un rôle non commité n'est pas dans
 * le worktree d'une fille (l'appelant passe le bon dossier).
 */
import { t } from 'i18next'
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  checkRole,
  mergeRoles,
  parseRoleFile,
  PROJECT_ROLES_DIR,
  ROLE_LIMITS,
  serializeRole,
  type Role,
  type RoleDefinition,
  type RoleError,
  type RoleFileScope,
  type RoleProblem,
  type RolesListing,
  type RoleView
} from '@shared/roles'
import { writeFileAtomic } from '../storage'

export interface RoleLibraryOptions {
  /** Dossier des rôles personnels. */
  userDir: string
  /** Rôles fournis (libellés traduits à l'appel). */
  builtin: () => Role[]
  /** Noms désactivés par l'utilisateur. */
  off: () => ReadonlySet<string>
  setEnabled: (name: string, enabled: boolean) => void
  log?: (message: string) => void
}

export type RoleSaveResult = { ok: true; role: RoleDefinition } | { ok: false; error: RoleError }

interface DirRead {
  signature: string
  roles: Role[]
  problems: RoleProblem[]
}

const EMPTY: DirRead = { signature: '', roles: [], problems: [] }

export class RoleLibrary {
  private readonly options: RoleLibraryOptions
  private readonly cache = new Map<string, DirRead>()

  constructor(options: RoleLibraryOptions) {
    this.options = options
  }

  /** Tous les rôles connus pour ce dossier (actifs ou non), et les fichiers écartés. */
  list(projectDir?: string): RolesListing {
    const user = this.read(this.options.userDir, 'user')
    const project = projectDir ? this.read(projectRolesDir(projectDir), 'project') : EMPTY
    return {
      roles: mergeRoles(
        [...this.options.builtin(), ...user.roles, ...project.roles],
        this.options.off()
      ),
      problems: [...user.problems, ...project.problems]
    }
  }

  /** Rôles proposés (actifs) pour ce dossier, par nom. */
  active(projectDir?: string): RoleView[] {
    return this.list(projectDir).roles.filter((role) => role.enabled)
  }

  /** Rôle actif de ce nom (casse ignorée) ; `undefined` s'il est inconnu ou désactivé. */
  find(projectDir: string | undefined, name: string): RoleView | undefined {
    const wanted = name.trim().replace(/^@/, '').toLowerCase()
    return this.active(projectDir).find((role) => role.name === wanted)
  }

  /** Définition d'un rôle d'une portée, pour le formulaire ; `undefined` s'il n'y est pas. */
  definition(
    scope: RoleFileScope | 'builtin',
    name: string,
    projectDir?: string
  ): Role | undefined {
    return this.inScope(scope, projectDir).find((role) => role.name === name)
  }

  /**
   * Écrit un rôle personnel ou du projet (`<nom>.md`). Renommé (`previousName`) : l'ancien
   * fichier est retiré une fois le nouveau écrit. Un nom déjà pris dans la même portée est refusé.
   */
  save(
    scope: RoleFileScope,
    fields: Parameters<typeof checkRole>[0],
    projectDir?: string,
    previousName?: string
  ): RoleSaveResult {
    const checked = checkRole(fields)
    if (!checked.ok) return checked
    const { role } = checked
    const dir = this.dirOf(scope, projectDir)
    // Jamais à travers un lien posé par un dépôt (`.bobine`, `.bobine/roles`, `<nom>.md`).
    if (linkedDir(dir)) return { ok: false, error: { code: 'link' } }
    const existing = this.read(dir, scope).roles
    const previous = previousName ? existing.find((r) => r.name === previousName) : undefined
    const file = join(dir, `${role.name}.md`)
    if (isLink(file)) return { ok: false, error: { code: 'link', field: 'name' } }
    // Un autre rôle porte ce nom, ou son fichier (un en-tête peut nommer le rôle autrement).
    if (
      (role.name !== previousName && existing.some((r) => r.name === role.name)) ||
      (existsSync(file) && file !== previous?.file)
    ) {
      return { ok: false, error: { code: 'duplicateName', field: 'name' } }
    }
    mkdirSync(dir, { recursive: true })
    if (!writeFileAtomic(file, serializeRole(role))) throw new Error(t('roles.error.notWritten'))
    if (previous?.file && previous.file !== file) unlinkSync(previous.file)
    this.cache.delete(dir)
    this.options.log?.(`Rôle ${role.name} enregistré (${scope})`)
    return { ok: true, role }
  }

  /** Supprime le fichier d'un rôle personnel ou du projet ; un rôle fourni se désactive. */
  remove(scope: RoleFileScope, name: string, projectDir?: string): boolean {
    const dir = this.dirOf(scope, projectDir)
    if (linkedDir(dir)) return false
    const role = this.read(dir, scope).roles.find((r) => r.name === name)
    if (!role?.file) return false
    unlinkSync(role.file)
    this.cache.delete(dir)
    this.options.log?.(`Rôle ${name} supprimé (${scope})`)
    return true
  }

  setEnabled(name: string, enabled: boolean): void {
    this.options.setEnabled(name, enabled)
  }

  private inScope(scope: RoleFileScope | 'builtin', projectDir?: string): Role[] {
    if (scope === 'builtin') return this.options.builtin()
    return this.read(this.dirOf(scope, projectDir), scope).roles
  }

  private dirOf(scope: RoleFileScope, projectDir?: string): string {
    if (scope === 'user') return this.options.userDir
    if (!projectDir) throw new Error(t('roles.error.noProject'))
    return projectRolesDir(projectDir)
  }

  /** Rôles d'un dossier, relus seulement si son empreinte a changé. Dossier absent : aucun. */
  private read(dir: string, scope: RoleFileScope): DirRead {
    if (linkedDir(dir)) {
      // Dossier de rôles qui est un lien : rien n'est lu, et c'est signalé.
      return { ...EMPTY, problems: [{ scope, file: dir, error: { code: 'link' } }] }
    }
    let all: string[]
    try {
      all = readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name)
        .sort()
    } catch {
      this.cache.delete(dir)
      return EMPTY
    }
    const names = all.slice(0, ROLE_LIMITS.files)
    const stats = names.map((name) => {
      try {
        const info = statSync(join(dir, name))
        return { name, size: info.size, signature: `${name}:${info.size}:${info.mtimeMs}` }
      } catch {
        return { name, size: -1, signature: `${name}:?` }
      }
    })
    const signature = stats.map((s) => s.signature).join('|')
    const cached = this.cache.get(dir)
    if (cached?.signature === signature) return cached
    const fresh = readFiles(dir, scope, stats)
    if (all.length > names.length) {
      fresh.problems.push({ scope, file: dir, error: { code: 'tooMany' } })
    }
    this.cache.set(dir, { signature, ...fresh })
    for (const problem of fresh.problems) {
      this.options.log?.(`Rôle écarté : ${problem.file} (${problem.error.code})`)
    }
    return { signature, ...fresh }
  }
}

/** Dossier des rôles d'un projet. */
export const projectRolesDir = (projectDir: string) => join(projectDir, PROJECT_ROLES_DIR)

function readFiles(
  dir: string,
  scope: RoleFileScope,
  files: { name: string; size: number }[]
): Omit<DirRead, 'signature'> {
  const roles: Role[] = []
  const problems: RoleProblem[] = []
  for (const { name, size } of files) {
    const file = join(dir, name)
    const problem = (error: RoleError) => problems.push({ scope, file, error })
    if (size > ROLE_LIMITS.fileBytes) {
      problem({ code: 'tooLarge' })
      continue
    }
    const content = readBounded(file)
    if (content === undefined) {
      problem({ code: 'unreadable' })
      continue
    }
    if (content === null) {
      problem({ code: 'tooLarge' })
      continue
    }
    const parsed = parseRoleFile(content, basename(name, '.md').toLowerCase())
    if (!parsed.ok) {
      problem(parsed.error)
      continue
    }
    if (roles.some((role) => role.name === parsed.role.name)) {
      problem({ code: 'duplicateName', field: 'name' })
      continue
    }
    roles.push({ ...parsed.role, scope, file })
  }
  return { roles, problems }
}

/** Lien symbolique ? (absent : non) */
function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** Le dossier des rôles, ou son parent (`.bobine`), est-il un lien ? */
const linkedDir = (dir: string) => isLink(dir) || isLink(dirname(dir))

/**
 * Contenu d'un fichier lu sans dépasser la limite (le fichier peut grossir entre `stat` et la
 * lecture) : `null` s'il est trop gros, `undefined` s'il est illisible.
 */
function readBounded(file: string): string | null | undefined {
  let fd: number
  try {
    fd = openSync(file, 'r')
  } catch {
    return undefined
  }
  try {
    const buffer = Buffer.alloc(ROLE_LIMITS.fileBytes + 1)
    const length = readSync(fd, buffer, 0, buffer.length, 0)
    return length > ROLE_LIMITS.fileBytes ? null : buffer.subarray(0, length).toString('utf8')
  } catch {
    return undefined
  } finally {
    closeSync(fd)
  }
}
