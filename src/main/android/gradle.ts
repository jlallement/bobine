/**
 * Projet Android du dossier et compilation par son Gradle (`./gradlew assembleDebug`, fiche 032), en
 * tâche de fond comme `xcodebuild`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { startCommandJob, type CommandJob } from '../jobs/command-job'
import type { AndroidSdk } from './sdk'

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', 'Pods', 'ios'])

/** Racines de projets Gradle Android (avec `gradlew`), profondeur 3. */
export function findAndroidProjects(workspace: string): string[] {
  const found: string[] = []
  const walk = (dir: string, depth: number) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    const gradle = entries.some((n) => /^settings\.gradle(\.kts)?$/.test(n))
    if (gradle && entries.includes('gradlew')) {
      found.push(dir)
      return
    }
    if (depth >= 3) return
    for (const name of entries) {
      if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
      const path = join(dir, name)
      try {
        if (statSync(path).isDirectory()) walk(path, depth + 1)
      } catch {
        // Lien cassé…
      }
    }
  }
  walk(workspace, 1)
  return found
}

/** Le dossier contient-il un projet Android (outils `android_*` utiles) ? */
export function hasAndroidProject(workspace: string): boolean {
  return findAndroidProjects(workspace).length > 0
}

/**
 * Dossiers où Gradle écrit les APK : ceux d'un projet Android, puis ceux d'un projet Flutter, dont
 * le projet Gradle est le sous-dossier `android/` et qui écrit sous `<racine>/build/app` (fiche 122).
 */
export function apkDirs(projectDir: string): string[] {
  return [
    join(projectDir, 'app', 'build', 'outputs', 'apk'),
    join(projectDir, 'build', 'outputs', 'apk'),
    join(projectDir, '..', 'build', 'app', 'outputs', 'flutter-apk'),
    join(projectDir, '..', 'build', 'app', 'outputs', 'apk')
  ]
}

/** APK le plus récent produit dans un des dossiers de `apkDirs`, sinon sous le projet. */
export function findBuiltApk(projectDir: string): string | undefined {
  const apks: { path: string; time: number }[] = []
  const walk = (dir: string, depth: number) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const path = join(dir, name)
      if (name.endsWith('.apk')) apks.push({ path, time: statSync(path).mtimeMs })
      else if (depth < 8 && !name.startsWith('.') && name !== 'node_modules') {
        try {
          if (statSync(path).isDirectory()) walk(path, depth + 1)
        } catch {
          // Lien cassé…
        }
      }
    }
  }
  for (const candidate of apkDirs(projectDir)) {
    if (existsSync(candidate)) walk(candidate, 1)
  }
  if (apks.length === 0) walk(projectDir, 1)
  return apks.filter((a) => a.path.includes(`${'outputs'}`)).sort((a, b) => b.time - a.time)[0]
    ?.path
}

/** Erreurs de compilation Gradle lisibles (Kotlin `e: …`, Java `error:`, « What went wrong »). */
export function gradleErrors(lines: readonly string[]): string[] {
  const errors: string[] = []
  for (const [i, line] of lines.entries()) {
    if (/^e: |\berror:|^FAILURE:/.test(line.trim())) errors.push(line.trim())
    if (/What went wrong:/.test(line))
      errors.push(...lines.slice(i + 1, i + 4).map((l) => l.trim()))
  }
  return [...new Set(errors.filter(Boolean))].slice(0, 20)
}

export interface GradleJob extends CommandJob {
  projectDir: string
  task: string
  apkPath?: string
  /** Compilation réussie sans APK trouvé : les dossiers cherchés (fiche 122). */
  apkSearched?: string[]
}

export class GradleBuilds {
  private readonly jobs = new Map<string, GradleJob>()
  private readonly sdk: AndroidSdk

  constructor(sdk: AndroidSdk) {
    this.sdk = sdk
  }

  get(projectDir: string, task: string): GradleJob | undefined {
    return this.jobs.get(`${projectDir}\u0000${task}`)
  }

  /** Démarre `./gradlew <tâche>` (ou rend celle qui tourne déjà). */
  start(projectDir: string, task: string): GradleJob {
    const key = `${projectDir}\u0000${task}`
    const running = this.jobs.get(key)
    if (running?.status === 'running') return running
    const env = {
      ...process.env,
      ANDROID_HOME: this.sdk.root,
      ...(this.sdk.javaHome ? { JAVA_HOME: this.sdk.javaHome } : {})
    }
    const job: GradleJob = Object.assign(
      startCommandJob(
        join(projectDir, 'gradlew'),
        [task, '--console=plain'],
        { cwd: projectDir, env },
        (_done, ok) => {
          if (!ok || !task.toLowerCase().startsWith('assemble')) return
          // Gradle a réussi : la compilation aussi, même si l'APK n'est pas où on le cherche.
          job.apkPath = findBuiltApk(projectDir)
          if (!job.apkPath) job.apkSearched = apkDirs(projectDir)
        }
      ),
      { projectDir, task }
    )
    this.jobs.set(key, job)
    return job
  }
}

/** Ligne de commande telle qu'on la montre à l'utilisateur. */
export const gradleCommand = (task: string) => `./gradlew ${task}`
