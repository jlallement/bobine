/**
 * Mémoire sur le disque (fiche 182, § 2 et 2 bis, ADR-0040) : `userData/memory/`, un dossier
 * `user/` (« Vous », tous les projets) et un par projet (`projects/<nom>-<empreinte>/`), un fichier
 * Markdown en clair par souvenir, un index `MEMORY.md` régénéré à chaque écriture.
 *
 * Écritures **atomiques** (temporaire dans le même dossier, `fsync`, `rename`, `fsync` du dossier) et
 * **une file par dossier** : deux acceptations simultanées, l'écran et une carte, passent l'une après
 * l'autre, index compris. Les lectures n'attendent pas la file : elles voient toujours des fichiers
 * entiers. Une écriture sur une version dépassée (`expected`) est refusée, pas faite en silence.
 * Un fichier illisible est mis de côté (`.broken-<date>`), jamais fatal ; les temporaires laissés
 * par un arrêt brutal sont supprimés à la lecture suivante.
 */
import { readOnlyError } from '../read-only-error'
import { isReadOnly } from '../storage'
import { createHash } from 'node:crypto'
import { constants, readFileSync } from 'node:fs'
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  indexFile,
  isMemoryName,
  MEMORY_LIMITS,
  parseMemory,
  serializeMemory,
  type MemoryEntry,
  type MemoryEntryView,
  type MemoryKeyState,
  type MemoryPlace,
  type MemoryProjectView
} from '@shared/memory'
import { plainSigner, type ApprovalSigner } from './approval-key'
import { projectIdOf } from './project-key'

const INDEX = 'MEMORY.md'
const PROJECT_FILE = 'project.json'
const TMP = /^\..+\.tmp-\d+-\d+$/

export interface MemoryStoreOptions {
  /** Ligne au journal (fichier mis de côté, dépôt introuvable). */
  log?: (message: string) => void
  /** Date ISO d'une écriture (essais). */
  now?: () => string
  /** Simule un arrêt entre l'écriture du temporaire et le `rename` (essais). */
  beforeRename?: (tmp: string) => Promise<void>
  /**
   * Empreintes des souvenirs validés par l'utilisateur (hors du dossier de la mémoire) ;
   * `<racine>.approved.json` par défaut.
   */
  approvalsFile?: string
  /**
   * Empreinte d'un contenu validé : HMAC à clé secrète (gardée chiffrée par le trousseau, voir
   * `memory/approval-key.ts`), que l'agent ne peut pas calculer ; SHA-256 par défaut (essais).
   */
  signer?: ApprovalSigner
}

/** Au-delà, un fichier n'est pas lu (un souvenir fait au plus 4 000 caractères). */
const MAX_FILE_BYTES = 64 * 1024

/** Fiche d'un projet : ses chemins connus et l'adresse de son dépôt (rattachement, § 2). */
interface ProjectFile {
  paths: string[]
  remote?: string
  createdAt: string
}

/** Issue d'une écriture conditionnelle : faite, ou refusée avec la version actuelle. */
export type WriteResult =
  | { ok: true; version: string }
  | { ok: false; reason: 'changed'; current: MemoryEntryView | null }
  | { ok: false; reason: 'full' }
  /** Clé des empreintes illisible : rien ne peut être validé, donc rien n'est écrit. */
  | { ok: false; reason: 'locked' }

export const versionOf = (content: string): string =>
  createHash('sha256').update(content).digest('hex').slice(0, 16)

let tmpCounter = 0

/** Écrit `content` dans `path` d'un coup : un lecteur voit l'ancien fichier ou le nouveau. */
export async function atomicWrite(
  path: string,
  content: string | Buffer,
  beforeRename?: (tmp: string) => Promise<void>
): Promise<void> {
  // Profil en lecture seule (fiche 196) : rien ne s'écrit, pas même la clé des empreintes.
  if (isReadOnly(path)) throw readOnlyError()
  const dir = join(path, '..')
  const tmp = join(dir, `.${path.slice(dir.length + 1)}.tmp-${process.pid}-${++tmpCounter}`)
  const handle = await open(tmp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await beforeRename?.(tmp)
    await rename(tmp, path)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
  await syncDir(dir)
}

/** `fsync` du dossier : le `rename` survit à une coupure. Sans effet là où ce n'est pas permis. */
async function syncDir(dir: string): Promise<void> {
  try {
    const handle = await open(dir, constants.O_RDONLY)
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Certains systèmes refusent `fsync` sur un dossier : le `rename` reste atomique.
  }
}

/** Adresse `origin` du dépôt, sans identifiants (`https://user:jeton@` retiré). */
async function originOf(root: string): Promise<string | undefined> {
  try {
    const config = await readFile(join(root, '.git', 'config'), 'utf8')
    const url = /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(config)?.[1]
    return url?.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]+@/i, '$1')
  } catch {
    return undefined
  }
}

export class MemoryStore {
  private readonly root: string
  private readonly options: MemoryStoreOptions
  private readonly queues = new Map<string, Promise<unknown>>()
  private readonly approvalsFile: string
  /** Empreinte validée de chaque souvenir (`<dossier relatif>/<nom>`), lue une fois. */
  private approvals: Map<string, string> | undefined
  private approvalsWrite: Promise<unknown> = Promise.resolve()
  /** Des empreintes existaient au lancement (une clé recréée les rend toutes caduques). */
  private hadApprovals = false

  constructor(root: string, options: MemoryStoreOptions = {}) {
    this.root = root
    this.options = options
    this.approvalsFile = options.approvalsFile ?? `${root}.approved.json`
  }

  /** Dossier d'une mémoire. */
  dirOf(place: MemoryPlace): string {
    if (place.scope === 'user') return join(this.root, 'user')
    // L'identifiant vient de l'IPC : jamais un chemin (`..`, `/`).
    if (!/^[a-z0-9._-]{1,60}$/.test(place.projectId) || place.projectId.startsWith('.')) {
      throw new Error(`Invalid project id: ${place.projectId}`)
    }
    return join(this.root, 'projects', place.projectId)
  }

  /** Mémoire du projet de racine `root` (clé de `projectKeyOf`). */
  projectPlace(root: string): MemoryPlace {
    return { scope: 'project', projectId: projectIdOf(root) }
  }

  /** Souvenirs lisibles d'une mémoire ; les fichiers illisibles sont mis de côté. */
  async list(place: MemoryPlace): Promise<MemoryEntryView[]> {
    return (await this.scan(place)).entries
  }

  /** Souvenirs et fichiers mis de côté (illisibles) d'une mémoire. */
  async scan(place: MemoryPlace): Promise<{ entries: MemoryEntryView[]; broken: string[] }> {
    const dir = this.dirOf(place)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return { entries: [], broken: [] }
    }
    const entries: MemoryEntryView[] = []
    const broken: string[] = []
    for (const file of names) {
      if (TMP.test(file)) {
        // Temporaire d'une écriture interrompue (le `rename` n'a pas eu lieu) : jamais lu.
        if (!this.queues.has(dir) && !isReadOnly(dir)) await rm(join(dir, file), { force: true })
        continue
      }
      if (file.includes('.md.broken-')) {
        broken.push(file)
        continue
      }
      if (file === INDEX || !file.endsWith('.md')) continue
      const entry = await this.readFile(dir, file)
      if (entry) entries.push(entry)
      else {
        const aside = await this.setAside(dir, file)
        if (aside) broken.push(aside)
      }
    }
    return { entries: entries.sort((a, b) => a.name.localeCompare(b.name)), broken }
  }

  /** Souvenirs nommés (inconnus ignorés). */
  async read(place: MemoryPlace, names: readonly string[]): Promise<MemoryEntryView[]> {
    const dir = this.dirOf(place)
    const found = await Promise.all(
      names.filter(isMemoryName).map((name) => this.readFile(dir, `${name}.md`))
    )
    return found.filter((entry): entry is MemoryEntryView => entry !== undefined)
  }

  async get(place: MemoryPlace, name: string): Promise<MemoryEntryView | undefined> {
    return (await this.read(place, [name]))[0]
  }

  /**
   * Écrit un souvenir (créé ou remplacé), par la file de sa mémoire. `expected` : version vue par
   * l'appelant (`null` : absent) ; si le souvenir a changé depuis, rien n'est écrit. `folder` :
   * dossier du projet, noté dans `project.json`.
   */
  write(
    place: MemoryPlace,
    entry: Omit<MemoryEntry, 'updated'>,
    options: { expected?: string | null; folder?: string; approve?: boolean } = {}
  ): Promise<WriteResult> {
    const dir = this.dirOf(place)
    return this.queued(dir, async () => {
      const current = (await this.get(place, entry.name)) ?? null
      if (options.expected !== undefined && (current?.version ?? null) !== options.expected) {
        return { ok: false, reason: 'changed', current }
      }
      if (!current && (await this.list(place)).length >= MEMORY_LIMITS.perScope) {
        return { ok: false, reason: 'full' }
      }
      if ((await this.keyState()) === 'locked') return { ok: false, reason: 'locked' }
      await this.ensureDir(place, dir, options.folder)
      const content = serializeMemory({ ...entry, updated: this.now() })
      await atomicWrite(join(dir, `${entry.name}.md`), content, this.options.beforeRename)
      // Écrit par Bobine après un clic de l'utilisateur : validé (sauf rattachement d'un souvenir
      // qui ne l'était pas).
      await this.setApproval(dir, entry.name, options.approve === false ? undefined : content)
      await this.writeIndex(place, dir)
      return { ok: true, version: versionOf(content) }
    })
  }

  /** Supprime un souvenir (`expected` comme pour `write`) ; `false` s'il avait changé ou n'existe pas. */
  remove(
    place: MemoryPlace,
    name: string,
    expected?: string
  ): Promise<{ ok: true } | { ok: false; current: MemoryEntryView | null }> {
    const dir = this.dirOf(place)
    return this.queued(dir, async () => {
      const current = (await this.get(place, name)) ?? null
      if (!current || (expected !== undefined && current.version !== expected)) {
        return { ok: false, current }
      }
      await rm(join(dir, `${name}.md`), { force: true })
      await syncDir(dir)
      await this.setApproval(dir, name, undefined)
      await this.writeIndex(place, dir)
      return { ok: true }
    })
  }

  /** Efface tous les souvenirs d'une mémoire (illisibles compris) ; rend leur nombre. */
  clear(place: MemoryPlace): Promise<number> {
    const dir = this.dirOf(place)
    return this.queued(dir, async () => {
      const { entries, broken } = await this.scan(place)
      for (const entry of entries) {
        await rm(join(dir, `${entry.name}.md`), { force: true })
        await this.setApproval(dir, entry.name, undefined)
      }
      for (const file of broken) await rm(join(dir, file), { force: true })
      if (entries.length + broken.length > 0) await this.writeIndex(place, dir)
      return entries.length
    })
  }

  /** Projets qui ont une mémoire, ceux dont aucun chemin n'existe plus marqués `missing`. */
  async projects(): Promise<MemoryProjectView[]> {
    let ids: string[]
    try {
      ids = await readdir(join(this.root, 'projects'))
    } catch {
      return []
    }
    const views: MemoryProjectView[] = []
    for (const id of ids.sort()) {
      let info: ProjectFile | undefined
      try {
        info = JSON.parse(
          await readFile(join(this.root, 'projects', id, PROJECT_FILE), 'utf8')
        ) as ProjectFile
      } catch {
        info = undefined
      }
      const paths = Array.isArray(info?.paths)
        ? info.paths.filter((p) => typeof p === 'string')
        : []
      const entries = await this.list({ scope: 'project', projectId: id })
      const exists = await Promise.all(
        paths.map((p) =>
          stat(p).then(
            () => true,
            () => false
          )
        )
      )
      const updated = entries
        .map((e) => e.updated)
        .sort()
        .at(-1)
      views.push({
        id,
        paths,
        missing: !exists.some(Boolean),
        count: entries.length,
        ...(updated ? { updated } : {})
      })
    }
    return views
  }

  /**
   * Déplace un souvenir vers une autre mémoire (« Vous » ↔ projet). Refusé si le nom y existe
   * déjà (`exists`) ou si la source a changé (`expected`). Écrit d'abord, supprime ensuite : un
   * arrêt entre les deux laisse un doublon, jamais une perte.
   */
  async move(
    from: MemoryPlace,
    to: MemoryPlace,
    name: string,
    expected?: string
  ): Promise<{ ok: true } | { ok: false; reason: 'changed' | 'exists' | 'full' }> {
    const current = await this.get(from, name)
    // Un souvenir modifié hors de Bobine se valide d'abord (« Garder ces modifications »).
    if (!current?.approved || (expected !== undefined && current.version !== expected)) {
      return { ok: false, reason: 'changed' }
    }
    const { version: _version, updated: _updated, approved: _approved, ...entry } = current
    const written = await this.write(to, entry, { expected: null })
    if (!written.ok) return { ok: false, reason: written.reason === 'full' ? 'full' : 'exists' }
    await this.remove(from, name, current.version)
    return { ok: true }
  }

  /**
   * Rattache la mémoire d'un projet introuvable à celle d'un dossier (§ 2) : chaque souvenir y est
   * écrit (un nom déjà pris garde les deux, suffixé `-2`, `-3`…), puis l'ancienne mémoire est
   * supprimée. Rend le nombre de souvenirs rattachés.
   */
  async attach(fromProjectId: string, toRoot: string): Promise<number> {
    const from: MemoryPlace = { scope: 'project', projectId: fromProjectId }
    const to = this.projectPlace(toRoot)
    if (this.dirOf(from) === this.dirOf(to)) return 0
    const entries = await this.list(from)
    let moved = 0
    for (const { version: _v, updated: _u, approved, ...entry } of entries) {
      for (let n = 1; n < 100; n++) {
        const name = n === 1 ? entry.name : `${entry.name.slice(0, 60)}-${n}`
        const written = await this.write(
          to,
          { ...entry, name },
          { expected: null, folder: toRoot, approve: approved }
        )
        if (written.ok) {
          moved++
          break
        }
        if (written.reason === 'full') return moved
      }
    }
    if (moved < entries.length) return moved
    // Les fichiers mis de côté (illisibles) suivent : rien n'est supprimé sans l'utilisateur.
    const { broken } = await this.scan(from)
    const toDir = this.dirOf(to)
    for (const file of broken) await rename(join(this.dirOf(from), file), join(toDir, file))
    await rm(this.dirOf(from), { recursive: true, force: true })
    return moved
  }

  /**
   * « Garder ces modifications » d'un souvenir modifié hors de Bobine : son contenu actuel
   * (version `expected`) devient celui validé. `false` s'il a changé entre-temps.
   */
  approve(
    place: MemoryPlace,
    name: string,
    expected: string
  ): Promise<{ ok: true } | { ok: false; reason: 'changed' | 'locked' }> {
    const dir = this.dirOf(place)
    return this.queued(dir, async () => {
      const content = await this.content(dir, `${name}.md`)
      if (content === undefined || versionOf(content) !== expected) {
        return { ok: false, reason: 'changed' }
      }
      if ((await this.keyState()) === 'locked') return { ok: false, reason: 'locked' }
      await this.setApproval(dir, name, content)
      return { ok: true }
    })
  }

  /**
   * État de la clé des empreintes, pour l'écran : `locked` (illisible : rien n'est donné aux
   * agents), `recreated` (absente alors que des empreintes existaient : tout est à revalider),
   * `none` (pas de trousseau : empreintes sans clé), `ok`.
   */
  async keyState(): Promise<MemoryKeyState> {
    this.approved('', '')
    const state = await (this.options.signer ?? plainSigner).state()
    if (state === 'created') return this.hadApprovals ? 'recreated' : 'ok'
    return state
  }

  /** Une mémoire en un seul fichier Markdown : index, puis chaque souvenir avec son en-tête. */
  async exportMarkdown(place: MemoryPlace, title: string): Promise<string> {
    const entries = await this.list(place)
    return [
      `# ${title}`,
      '',
      indexFile(entries).trim(),
      ...entries.map((entry) => `\n<!-- ${entry.name}.md -->\n${serializeMemory(entry)}`)
    ].join('\n')
  }

  // ---------------------------------------------------------------------------------------------

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString()
  }

  /** Opération qui écrit, après celles déjà en file pour ce dossier. */
  private queued<T>(dir: string, run: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(dir) ?? Promise.resolve()
    const next = previous.then(run, run)
    const settled = next.then(
      () => undefined,
      () => undefined
    )
    this.queues.set(dir, settled)
    void settled.then(() => {
      if (this.queues.get(dir) === settled) this.queues.delete(dir)
    })
    return next
  }

  /** Contenu d'un fichier ordinaire et borné ; un lien symbolique n'est jamais suivi. */
  private async content(dir: string, file: string): Promise<string | undefined> {
    try {
      const info = await lstat(join(dir, file))
      if (!info.isFile() || info.size > MAX_FILE_BYTES) return undefined
      return await readFile(join(dir, file), 'utf8')
    } catch {
      return undefined
    }
  }

  private async readFile(dir: string, file: string): Promise<MemoryEntryView | undefined> {
    const content = await this.content(dir, file)
    if (content === undefined) return undefined
    const entry = parseMemory(content)
    // Le nom du fichier fait foi : un en-tête qui en nomme un autre est illisible.
    if (!entry || `${entry.name}.md` !== file) return undefined
    // La clé n'est demandée que s'il y a une empreinte à vérifier.
    const stored = this.approved(dir, entry.name)
    const signature = stored === undefined ? undefined : await this.signature(content)
    // Clé illisible : aucune signature, donc rien ne correspond (jamais de repli sans clé).
    const approved = stored !== undefined && signature !== undefined && stored === signature
    return { ...entry, version: versionOf(content), approved }
  }

  private signature(content: string): Promise<string | undefined> {
    return (this.options.signer ?? plainSigner).sign(content)
  }

  private approvalKey(dir: string, name: string): string {
    return `${relative(this.root, dir)}/${name}`
  }

  /** Empreinte validée d'un souvenir ; le fichier des empreintes est lu une fois. */
  private approved(dir: string, name: string): string | undefined {
    if (!this.approvals) {
      this.approvals = new Map()
      try {
        const raw = JSON.parse(readFileSync(this.approvalsFile, 'utf8')) as unknown
        if (typeof raw === 'object' && raw !== null) {
          for (const [key, value] of Object.entries(raw)) {
            if (typeof value === 'string') this.approvals.set(key, value)
          }
          this.hadApprovals = this.approvals.size > 0
        }
      } catch {
        // Absent ou illisible : rien n'est validé, rien n'est donné aux agents.
      }
    }
    return this.approvals.get(this.approvalKey(dir, name))
  }

  /** Note (ou retire) l'empreinte du contenu validé ; écritures du fichier une par une, atomiques. */
  private async setApproval(dir: string, name: string, content: string | undefined): Promise<void> {
    this.approved(dir, name)
    const approvals = this.approvals ?? new Map<string, string>()
    const key = this.approvalKey(dir, name)
    const signature = content === undefined ? undefined : await this.signature(content)
    if (content !== undefined && signature === undefined) throw new Error('Memory key unreadable')
    if (signature !== undefined) approvals.set(key, signature)
    else if (!approvals.delete(key)) return
    const write = this.approvalsWrite.then(() =>
      atomicWrite(this.approvalsFile, `${JSON.stringify(Object.fromEntries(approvals), null, 2)}\n`)
    )
    this.approvalsWrite = write.catch(() => undefined)
    await write
  }

  /** Fichier illisible mis de côté (`<nom>.md.broken-<date>`), une ligne au journal. */
  private async setAside(dir: string, file: string): Promise<string | undefined> {
    // Peut-être en cours de remplacement par la file : on ne touche à rien, on relira.
    if (this.queues.has(dir) || isReadOnly(dir)) return undefined
    const aside = `${file}.broken-${this.now().replace(/[:.]/g, '-')}`
    try {
      await rename(join(dir, file), join(dir, aside))
      this.options.log?.(`Mémoire : souvenir illisible mis de côté (${aside})`)
      return aside
    } catch {
      return undefined
    }
  }

  private async ensureDir(place: MemoryPlace, dir: string, folder?: string): Promise<void> {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await chmod(dir, 0o700)
    if (place.scope !== 'project' || !folder) return
    const file = join(dir, PROJECT_FILE)
    let info: ProjectFile | undefined
    try {
      info = JSON.parse(await readFile(file, 'utf8')) as ProjectFile
    } catch {
      info = undefined
    }
    const paths = Array.isArray(info?.paths) ? info.paths : []
    if (paths.includes(folder)) return
    const remote = await originOf(folder)
    const next: ProjectFile = {
      paths: [...paths, folder],
      ...(remote ? { remote } : {}),
      createdAt: info?.createdAt ?? this.now()
    }
    await atomicWrite(file, `${JSON.stringify(next, null, 2)}\n`)
  }

  private async writeIndex(place: MemoryPlace, dir: string): Promise<void> {
    const entries = await this.list(place)
    await atomicWrite(join(dir, INDEX), indexFile(entries))
  }
}
