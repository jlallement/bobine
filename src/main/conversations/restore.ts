/**
 * Restauration d'une sauvegarde (fiche 197) : jamais sans confirmation (dans l'interface), faite au
 * lancement suivant, avant que quoi que ce soit ne lise le profil.
 *
 * Tout ou rien, même si l'app est tuée en plein milieu : la demande (`restauration-demandee.json`)
 * sert de journal, réécrite atomiquement à chaque étape.
 * 1. `staging` : la sauvegarde est copiée à côté (`.restauration-<date>/`) ; un disque plein
 *    échoue ici, rien n'a bougé.
 * 2. `moving` : l'état actuel part dans `restaurations/avant-<date>/` (déplacements, même disque),
 *    avec sa description : c'est une sauvegarde valide, restaurable de la même façon.
 * 3. `placing` : la copie prend sa place.
 * 4. `done` : il ne reste qu'à faire le ménage.
 * Relancée sur une demande déjà commencée : faite si elle était au bout, sinon tout est remis
 * comme avant, et un avis le dit. Une demande ne se rejoue jamais.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'
import { log } from '../log'
import { PROFILE_FORMAT_VERSION } from '../profile-format'
import { fsyncDir, writeFileAtomic } from '../storage'
import {
  BACKUP_MANIFEST,
  backupFolderName,
  checkBackup,
  countConversations,
  ENTRY_NAMES,
  freeFolder,
  type Manifest
} from './backup'

/** Demande de restauration, faite au lancement suivant ; journal de ses étapes. */
export const RESTORE_JOB = 'restauration-demandee.json'
/** Où l'état d'avant une restauration est gardé. */
export const RESTORE_KEEP_DIR = 'restaurations'
const STAGING_PREFIX = '.restauration-'
/** Compagnons de la base de consommation : déplacés avec elle, jamais copiés seuls. */
const USAGE_COMPANIONS = ['usage.sqlite-wal', 'usage.sqlite-shm']
const MOVED = [...ENTRY_NAMES, ...USAGE_COMPANIONS]

type Phase = 'staging' | 'moving' | 'placing' | 'done'

interface Job {
  folder: string
  phase?: Phase
  keptIn?: string
  staging?: string
  createdAt?: string
}

export type RestoreOutcome =
  | { kind: 'none' }
  | { kind: 'restored'; createdAt: string; keptIn: string }
  /** Arrêtée en route au lancement précédent : tout a été remis comme avant. */
  | { kind: 'interrupted' }
  | { kind: 'failed'; error: string; cause?: unknown }

/**
 * Pour les essais : appelé après chaque étape écrite au journal (`moving`…), et après chaque entrée
 * déplacée (`moving:conversations`…) : un arrêt brutal simulé à cet endroit.
 */
export type StepHook = (point: string) => void

/** Demande la restauration de `folder` au prochain lancement (après confirmation). */
export function requestRestore(userData: string, folder: string): void {
  writeFileAtomic(join(userData, RESTORE_JOB), JSON.stringify({ folder } satisfies Job))
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${backupFolderName(now).replace('bobine-sauvegarde-', '')}${p(now.getSeconds())}`
}

function readJob(file: string): Job | undefined {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<Job> | null
    return raw && typeof raw.folder === 'string' ? (raw as Job) : undefined
  } catch {
    return undefined
  }
}

/**
 * Fait ou reprend la restauration demandée (au lancement, avant toute lecture du profil). Sans
 * demande, balaie les copies laissées par une restauration ancienne.
 */
export function applyPendingRestore(
  userData: string,
  appVersion: string,
  now = new Date(),
  step: StepHook = () => {}
): RestoreOutcome {
  const jobFile = join(userData, RESTORE_JOB)
  if (!existsSync(jobFile)) {
    sweepStaging(userData)
    return { kind: 'none' }
  }
  const job = readJob(jobFile)
  if (!job) {
    rmSync(jobFile, { force: true })
    return { kind: 'failed', error: 'demande de restauration illisible' }
  }
  if (job.phase) return resume(userData, jobFile, job)
  const check = checkBackup(job.folder, userData)
  if (!check.ok) {
    rmSync(jobFile, { force: true })
    return { kind: 'failed', error: `pas une sauvegarde restaurable : ${job.folder}` }
  }
  const at = stamp(now)
  const started: Job = {
    folder: job.folder,
    createdAt: check.createdAt,
    keptIn: freeFolder(join(userData, RESTORE_KEEP_DIR, `avant-${at}`)),
    staging: join(userData, `${STAGING_PREFIX}${at}`)
  }
  let reached: Phase = 'staging'
  const write = (phase: Phase) => {
    reached = phase
    writeFileAtomic(jobFile, JSON.stringify({ ...started, phase }))
    step(phase)
  }
  try {
    write('staging')
    stage(job.folder, started.staging as string)
    write('moving')
    keep(userData, started.keptIn as string, appVersion, now, step)
    write('placing')
    place(userData, started.staging as string, step)
    write('done')
  } catch (error) {
    if ((error as { simulatedCrash?: true }).simulatedCrash) throw error
    log.error('Restauration impossible, état d’avant remis en place :', error)
    rollback(userData, { ...started, phase: reached })
    rmSync(jobFile, { force: true })
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'failed', error: message, cause: error }
  }
  return finish(userData, jobFile, started)
}

function stage(folder: string, staging: string): void {
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  for (const name of ENTRY_NAMES) {
    if (existsSync(join(folder, name))) {
      cpSync(join(folder, name), join(staging, name), { recursive: true, verbatimSymlinks: true })
    }
  }
  fsyncDir(staging)
}

function keep(
  userData: string,
  keptIn: string,
  appVersion: string,
  now: Date,
  step: StepHook
): void {
  mkdirSync(keptIn, { recursive: true })
  for (const name of MOVED) {
    if (!existsSync(join(userData, name))) continue
    renameSync(join(userData, name), join(keptIn, name))
    step(`moving:${name}`)
  }
  const manifest: Manifest = {
    formatVersion: PROFILE_FORMAT_VERSION,
    app: appVersion,
    createdAt: now.toISOString(),
    conversations: countConversations(join(keptIn, 'conversations'))
  }
  writeFileAtomic(join(keptIn, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  fsyncDir(keptIn)
  fsyncDir(userData)
}

function place(userData: string, staging: string, step: StepHook): void {
  for (const name of ENTRY_NAMES) {
    if (!existsSync(join(staging, name))) continue
    renameSync(join(staging, name), join(userData, name))
    step(`placing:${name}`)
  }
  fsyncDir(userData)
}

function finish(userData: string, jobFile: string, job: Job): RestoreOutcome {
  if (job.staging) rmSync(job.staging, { recursive: true, force: true })
  rmSync(jobFile, { force: true })
  fsyncDir(userData)
  log.info(`Sauvegarde restaurée : ${job.folder} ; état d'avant gardé dans ${job.keptIn}`)
  return {
    kind: 'restored',
    createdAt: job.createdAt ?? new Date().toISOString(),
    keptIn: job.keptIn ?? ''
  }
}

/** Demande déjà commencée au lancement précédent : finie si elle était au bout, sinon défaite. */
function resume(userData: string, jobFile: string, job: Job): RestoreOutcome {
  if (job.phase === 'done') return finish(userData, jobFile, job)
  log.warn(`Restauration interrompue à l’étape « ${job.phase} » : état d’avant remis en place`)
  rollback(userData, job)
  rmSync(jobFile, { force: true })
  return { kind: 'interrupted' }
}

/**
 * Remet l'état d'avant : ce qui a été déplacé dans `keptIn` revient (ce qui avait pris sa place
 * part) ; la copie de la sauvegarde et le dossier d'avant vidé sont retirés.
 */
function rollback(userData: string, job: Job): void {
  const { keptIn, staging } = job
  // En pleine mise en place, tout l'état d'avant est dans `keptIn` : ce qui est dans le dossier de
  // données sans y être vient de la sauvegarde, et part.
  if (job.phase === 'placing' && keptIn) {
    for (const name of ENTRY_NAMES) {
      if (!existsSync(join(keptIn, name)))
        rmSync(join(userData, name), { recursive: true, force: true })
    }
  }
  if (keptIn && existsSync(keptIn)) {
    for (const name of MOVED) {
      if (!existsSync(join(keptIn, name))) continue
      try {
        rmSync(join(userData, name), { recursive: true, force: true })
        renameSync(join(keptIn, name), join(userData, name))
      } catch (error) {
        log.error(`Remise en place impossible de ${name} (gardé dans ${keptIn}) :`, error)
      }
    }
    const left = readdirSync(keptIn).filter((name) => name !== BACKUP_MANIFEST)
    if (left.length === 0) rmSync(keptIn, { recursive: true, force: true })
  }
  if (staging) rmSync(staging, { recursive: true, force: true })
  fsyncDir(userData)
}

/** Copies d'une restauration laissées par un arrêt brutal (sans demande en cours). */
function sweepStaging(userData: string): void {
  let names: string[]
  try {
    names = readdirSync(userData)
  } catch {
    return
  }
  for (const name of names) {
    if (name.startsWith(STAGING_PREFIX)) {
      rmSync(join(userData, name), { recursive: true, force: true })
    }
  }
}
