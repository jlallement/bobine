/**
 * Projet Xcode du dossier et compilation pour le simulateur (fiche 008). `xcodebuild` dure souvent
 * plusieurs minutes : il tourne en tâche de fond, l'outil n'attend qu'un temps borné et l'agent le
 * rappelle (Bob abandonne un appel d'outil au bout d'environ 60 s).
 */
import { createHash } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { startCommandJob, type CommandJob } from '../jobs/command-job'

const SKIP_DIRS = new Set(['node_modules', 'Pods', '.git', 'build', 'DerivedData', '.build'])

export interface XcodeProject {
  /** Chemin absolu du `.xcworkspace` ou du `.xcodeproj`. */
  path: string
  kind: 'workspace' | 'project'
}

/** Projets Xcode du dossier (profondeur 3), espaces de travail d'abord. */
export function findXcodeProjects(workspace: string): XcodeProject[] {
  const found: XcodeProject[] = []
  const walk = (dir: string, depth: number) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
      const path = join(dir, name)
      if (name.endsWith('.xcworkspace')) found.push({ path, kind: 'workspace' })
      else if (name.endsWith('.xcodeproj')) found.push({ path, kind: 'project' })
      else if (depth < 3) {
        try {
          if (statSync(path).isDirectory()) walk(path, depth + 1)
        } catch {
          // Lien cassé…
        }
      }
    }
  }
  walk(workspace, 1)
  return found.sort((a, b) => Number(b.kind === 'workspace') - Number(a.kind === 'workspace'))
}

/** Le dossier contient-il de quoi faire une app iOS (outils `ios_*` utiles) ? */
export function hasAppleProject(workspace: string): boolean {
  try {
    if (readdirSync(workspace).includes('Package.swift')) return true
  } catch {
    return false
  }
  return findXcodeProjects(workspace).length > 0
}

/** Erreurs de compilation lisibles (`fichier:ligne: error: …`), sans doublons, 20 au plus. */
export function buildErrors(lines: readonly string[]): string[] {
  const unique = (list: string[]) => [...new Set(list.map((l) => l.trim()))]
  // Les erreurs du compilateur d'abord, le bilan « BUILD FAILED » ensuite.
  const errors = unique(lines.filter((l) => /\berror:/i.test(l)))
  const verdict = unique(lines.filter((l) => /^\*\* BUILD FAILED/.test(l.trim())))
  return [...errors, ...verdict].slice(0, 20)
}

/** `.app` le plus récent produit pour le simulateur. */
export function findBuiltApp(derivedData: string, configuration: string): string | undefined {
  const dir = join(derivedData, 'Build', 'Products', `${configuration}-iphonesimulator`)
  let apps: { path: string; time: number }[] = []
  try {
    apps = readdirSync(dir)
      .filter((n) => n.endsWith('.app'))
      .map((n) => ({ path: join(dir, n), time: statSync(join(dir, n)).mtimeMs }))
  } catch {
    return undefined
  }
  return apps.sort((a, b) => b.time - a.time)[0]?.path
}

export interface BuildRequest {
  workspace: string
  project: XcodeProject
  scheme: string
  configuration: string
  udid: string
}

export interface BuildJob extends CommandJob {
  request: BuildRequest
  appPath?: string
}

/** Ligne de commande telle qu'on la montre à l'utilisateur. */
export function buildCommand(request: BuildRequest, derivedData: string): string[] {
  return [
    'xcodebuild',
    request.project.kind === 'workspace' ? '-workspace' : '-project',
    request.project.path,
    '-scheme',
    request.scheme,
    '-configuration',
    request.configuration,
    '-destination',
    `platform=iOS Simulator,id=${request.udid}`,
    '-derivedDataPath',
    derivedData,
    'build'
  ]
}

/** Compilations en cours ou terminées, une par dossier et schéma. */
export class XcodeBuilds {
  private readonly jobs = new Map<string, BuildJob>()
  private readonly cacheDir: string
  private readonly xcodebuild: string

  /** `xcodebuild` remplaçable pour les tests. */
  constructor(cacheDir: string, xcodebuild = 'xcodebuild') {
    this.cacheDir = cacheDir
    this.xcodebuild = xcodebuild
  }

  /** DerivedData propre au dossier, dans le cache de l'app (le projet reste propre). */
  derivedData(workspace: string): string {
    const hash = createHash('sha1').update(workspace).digest('hex').slice(0, 12)
    return join(this.cacheDir, 'DerivedData', hash)
  }

  get(workspace: string, scheme: string): BuildJob | undefined {
    return this.jobs.get(`${workspace}\u0000${scheme}`)
  }

  /** Démarre une compilation, ou rend celle qui tourne déjà pour ce schéma. */
  start(request: BuildRequest): BuildJob {
    const key = `${request.workspace}\u0000${request.scheme}`
    const running = this.jobs.get(key)
    if (running?.status === 'running') return running
    const derivedData = this.derivedData(request.workspace)
    const [file = 'xcodebuild', ...args] = buildCommand(request, derivedData)
    const job: BuildJob = Object.assign(
      startCommandJob(
        file === 'xcodebuild' ? this.xcodebuild : file,
        args,
        { cwd: request.workspace, env: { ...process.env, NSUnbufferedIO: 'YES' } },
        (done, ok) => {
          if (!ok) return
          job.appPath = findBuiltApp(derivedData, request.configuration)
          if (!job.appPath) {
            done.status = 'failed'
            done.lines.push(`Aucun .app produit dans ${relative(request.workspace, derivedData)}`)
          }
        }
      ),
      { request }
    )
    this.jobs.set(key, job)
    return job
  }
}
