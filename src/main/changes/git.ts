/**
 * Vue « Git » du récapitulatif des modifications (fiche 021) : l'état du dossier de la conversation
 * par rapport au dernier commit. `git` n'est appelé que si le dossier est dans un dépôt.
 */
import { readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { GitChanges, GitFileChange, GitFileDiff, GitFileStatus } from '@shared/changes'
import type { Run } from '../simulator/run'
import { notARepoOrError } from '../git/repo'
import { nativeGitPath } from '../git/git-platform'
import { launchSystem, type ProcessSystem } from '../process-launch'
import { t } from 'i18next'

/** Au-delà, le fichier n'est pas montré (diff illisible, et lourd à transmettre). */
export const MAX_DIFF_BYTES = 512 * 1024
const MAX_FILES = 500

export interface StatusEntry {
  x: string
  y: string
  path: string
  from?: string
}

/** `git status --porcelain=v1 -z` : « XY chemin\0 », et « XY nouveau\0ancien\0 » pour un renommage. */
export function parseStatus(output: string): StatusEntry[] {
  const parts = output.split('\0')
  const entries: StatusEntry[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part || part.length < 4) continue
    const entry: StatusEntry = { x: part[0] ?? ' ', y: part[1] ?? ' ', path: part.slice(3) }
    if (entry.x === 'R' || entry.x === 'C') entry.from = parts[++i]
    entries.push(entry)
  }
  return entries
}

/**
 * `git diff --numstat -z` : « ajouts\tretraits\tchemin\0 », ou pour un renommage
 * « ajouts\tretraits\t\0ancien\0nouveau\0 ». Binaire : « -\t-\t ».
 */
export function parseNumstat(
  output: string
): Map<string, { added: number | null; removed: number | null }> {
  const parts = output.split('\0')
  const stats = new Map<string, { added: number | null; removed: number | null }>()
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const [a, r, path] = part.split('\t')
    if (a === undefined || r === undefined) continue
    // Renommage : le chemin est vide, l'ancien puis le nouveau suivent.
    let target = path
    if (!target) {
      target = parts[i + 2]
      i += 2
    }
    if (!target) continue
    stats.set(target, {
      added: a === '-' ? null : Number(a),
      removed: r === '-' ? null : Number(r)
    })
  }
  return stats
}

export function statusOf(entry: StatusEntry): GitFileStatus {
  if (entry.x === '?') return 'untracked'
  if (entry.x === 'R' || entry.x === 'C') return 'renamed'
  if (entry.x === 'D' || entry.y === 'D') return 'deleted'
  if (entry.x === 'A') return 'added'
  return 'modified'
}

const text = (buffer: Buffer) => buffer.toString('utf8')

const isBinary = (buffer: Buffer) => buffer.subarray(0, 8000).includes(0)

function countLines(buffer: Buffer): number {
  if (buffer.length === 0) return 0
  let lines = 0
  for (const byte of buffer) if (byte === 10) lines++
  return buffer[buffer.length - 1] === 10 ? lines : lines + 1
}

/**
 * git convertit-il les fins de ligne de ce fichier en l'indexant (fiche 229) ? D'après
 * `git ls-files --eol` (« i/lf w/crlf attr/text=auto ») et `core.autocrlf` : un attribut `text` ou
 * `eol` décide ; `-text` l'interdit ; sans attribut, `core.autocrlf` à `true` ou `input`.
 */
export function gitConvertsEol(lsFilesEol: string, autocrlf: string): boolean {
  const attr = /\battr\/(\S*)/.exec(lsFilesEol)?.[1] ?? ''
  if (/(^|\s)-text\b/.test(attr)) return false
  if (/(^|\s)(text|eol=)/.test(attr)) return true
  return ['true', 'input'].includes(autocrlf.trim().toLowerCase())
}

/** `\r\n` → `\n`, pour comparer la copie de travail à l'index comme git le fait. */
const toLf = (buffer: Buffer) => Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')

/** Identifiant de commit (abrégé ou entier), seul point de comparaison accepté du renderer. */
const COMMIT_ID = /^[0-9a-f]{4,64}$/

export class GitChangesReader {
  private readonly run: Run
  private readonly git: string
  private readonly system: ProcessSystem

  constructor(run: Run, git = 'git', system: ProcessSystem = launchSystem()) {
    this.run = run
    this.git = git
    this.system = system
  }

  /** Modifications du dossier par rapport au dernier commit ; `null` hors d'un dépôt git. */
  async changes(workspace: string): Promise<GitChanges | null> {
    const top = await this.run(this.git, ['rev-parse', '--show-toplevel', '--show-prefix'], {
      cwd: workspace,
      timeoutMs: 10_000
    })
    if (top.code !== 0) return notARepoOrError(top.stderr)
    const [gitRoot, prefix = ''] = text(top.stdout).split('\n')
    const root = gitRoot ? nativeGitPath(gitRoot) : workspace
    const hasHead =
      (await this.run(this.git, ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: workspace }))
        .code === 0
    const branch = await this.run(this.git, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: workspace
    })
    const status = await this.run(
      this.git,
      ['status', '--porcelain=v1', '-z', '-uall', '--', '.'],
      { cwd: workspace, timeoutMs: 30_000 }
    )
    if (status.code !== 0) throw new Error(status.stderr.trim() || t('git.statusFailed'))
    const numstat = hasHead
      ? parseNumstat(
          text(
            (
              await this.run(this.git, ['diff', 'HEAD', '--numstat', '-z', '-M', '--', '.'], {
                cwd: workspace,
                timeoutMs: 30_000
              })
            ).stdout
          )
        )
      : new Map<string, { added: number | null; removed: number | null }>()

    const files: GitFileChange[] = []
    for (const entry of parseStatus(text(status.stdout)).slice(0, MAX_FILES)) {
      // Chemins de git : relatifs à la racine du dépôt ; montrés relatifs au dossier.
      const inWorkspace = (path: string) =>
        prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path
      const kind = statusOf(entry)
      let stats = numstat.get(entry.path)
      if (!stats) stats = await this.untrackedStats(join(root, entry.path), kind)
      files.push({
        path: inWorkspace(entry.path),
        status: kind,
        ...(entry.from ? { from: inWorkspace(entry.from) } : {}),
        added: stats.added,
        removed: stats.removed
      })
    }
    return { root, ...(branch.code === 0 ? { branch: text(branch.stdout).trim() } : {}), files }
  }

  /**
   * Contenu au dernier commit et sur le disque d'un fichier du dossier, pour le diff. `since` :
   * un autre point de comparaison que `HEAD` — la base d'une branche ou le parent d'un commit relus
   * par le Code reviewer (fiche 265) ; un identifiant de commit, rien d'autre. `until` (avec
   * `since`, fiche 267) : la fin d'une portée relue toute commitée — la version de ce commit au lieu
   * du disque, pour montrer ce qui a été relu même si le fichier a été corrigé depuis
   * (`changedSince`).
   */
  async fileDiff(
    workspace: string,
    path: string,
    from?: string,
    since?: string,
    until?: string
  ): Promise<GitFileDiff> {
    if (since !== undefined && !COMMIT_ID.test(since)) throw new Error('Paramètre invalide : since')
    if (until !== undefined && (since === undefined || !COMMIT_ID.test(until)))
      throw new Error('Paramètre invalide : until')
    const file = insideWorkspace(workspace, path)
    const before = insideWorkspace(workspace, from ?? path)
    // Plage relue introuvable (historique réécrit, clone refait : revue QA de la fiche 267) : le
    // fichier contre `HEAD`, et la vue le dit.
    const missing =
      (since !== undefined && !(await this.exists(workspace, since))) ||
      (until !== undefined && !(await this.exists(workspace, until)))
    const point = missing ? 'HEAD' : (since ?? 'HEAD')
    const reviewedAt = missing ? undefined : until
    // `HEAD:./chemin` : relatif au dossier courant, même si son chemin passe par un lien symbolique.
    const inRepo = relative(resolve(workspace), before).split(sep).join('/')
    const shown = await this.run(this.git, ['show', `${point}:./${inRepo}`], { cwd: workspace })
    const old = shown.code === 0 ? shown.stdout : null
    const read = await readFile(file).catch(() => null)
    const onDisk = read && old ? await this.asGitSees(workspace, file, old, read) : read
    let current = onDisk
    let changedSince = false
    if (reviewedAt !== undefined) {
      const inRepoNow = relative(resolve(workspace), file).split(sep).join('/')
      const reviewed = await this.run(this.git, ['show', `${reviewedAt}:./${inRepoNow}`], {
        cwd: workspace
      })
      current = reviewed.code === 0 ? reviewed.stdout : null
      const disk =
        onDisk && current ? await this.asGitSees(workspace, file, current, onDisk) : onDisk
      changedSince = !(disk === null ? current === null : current !== null && disk.equals(current))
    }
    // Dit aussi pour un fichier binaire ou trop gros (revue QA).
    const flags = {
      ...(changedSince ? { changedSince: true as const } : {}),
      ...(missing ? { rangeMissing: true as const } : {})
    }
    if ((old && old.length > MAX_DIFF_BYTES) || (current && current.length > MAX_DIFF_BYTES)) {
      return { oldText: null, newText: null, tooLarge: true, ...flags }
    }
    if ((old && isBinary(old)) || (current && isBinary(current))) {
      return { oldText: null, newText: null, binary: true, ...flags }
    }
    return { oldText: old ? text(old) : null, newText: current ? text(current) : null, ...flags }
  }

  /** Un objet (commit, arbre) du dépôt existe-t-il ? */
  private async exists(workspace: string, id: string): Promise<boolean> {
    const result = await this.run(this.git, ['cat-file', '-e', '--end-of-options', id], {
      cwd: workspace
    })
    return result.code === 0
  }

  /**
   * Windows (fiche 229) : avec `core.autocrlf` (réglé par l'installeur de Git for Windows) ou un
   * attribut `text`, le fichier est en CRLF sur le disque et en LF dans le dépôt ; git compare sans
   * les `\r`, le diff aussi, sinon toutes les lignes paraissent changées. Unix : tel quel.
   */
  private async asGitSees(workspace: string, file: string, old: Buffer, current: Buffer) {
    if (this.system === 'posix' || old.includes(13) || !current.includes('\r\n')) return current
    const relativePath = relative(resolve(workspace), file).split(sep).join('/')
    const [eol, autocrlf] = await Promise.all([
      this.run(this.git, ['ls-files', '--eol', '--', relativePath], { cwd: workspace }),
      this.run(this.git, ['config', '--get', 'core.autocrlf'], { cwd: workspace })
    ])
    const converts = gitConvertsEol(
      text(eol.stdout),
      autocrlf.code === 0 ? text(autocrlf.stdout) : ''
    )
    return converts ? toLf(current) : current
  }

  private async untrackedStats(
    file: string,
    kind: GitFileStatus
  ): Promise<{ added: number | null; removed: number | null }> {
    if (kind !== 'untracked' && kind !== 'added') return { added: 0, removed: 0 }
    const info = await stat(file).catch(() => null)
    if (!info?.isFile() || info.size > MAX_DIFF_BYTES) return { added: null, removed: null }
    const content = await readFile(file).catch(() => null)
    if (!content || isBinary(content)) return { added: null, removed: null }
    return { added: countLines(content), removed: 0 }
  }
}

/**
 * Chemin absolu d'un fichier du dossier de la conversation : refuse tout ce qui en sort (`..`,
 * chemin absolu ailleurs).
 */
export function insideWorkspace(workspace: string, path: string): string {
  const root = resolve(workspace)
  const target = resolve(root, path)
  if (target.startsWith(root + sep)) return target
  throw new Error(t('fileLink.pathOutside', { path }))
}
