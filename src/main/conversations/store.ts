/**
 * Historique des conversations sur disque : un index (`index.json`) et le fil de chaque conversation
 * (`<id>.json`). Écritures atomiques ; un fichier illisible n'est jamais bloquant ni écrasé : il est
 * mis de côté, et l'index repart de sa dernière bonne copie (`index.json.bak`).
 *
 * Fiche 196 : les entrées d'index qu'elle ne comprend pas (version plus récente) sont réécrites
 * telles quelles ; un fil d'une version plus récente n'est jamais réécrit ; une conversation
 * supprimée va dans la corbeille (`trash.ts`), et aucune écriture en vol ne la fait revenir.
 *
 * Fiche 197 : chaque fil garde une copie de l'enregistrement de sa conversation (`record`). Index
 * et copie perdus, la liste est refaite à partir des fils ; un fil absent de l'index y revient.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../log'
import type { TranscriptState } from '@shared/transcript'
import type { WorktreeInfo } from '../changes/worktrees'
import { parseUsageDigest, type UsageDigest } from '@shared/usage'
import { parseRoleStamp, type RoleStamp } from '@shared/roles'
import { quarantine, readJson, writeFileAtomic, writeFileAtomicAsync } from '../storage'

export interface ConversationRecord {
  id: string
  title: string
  /**
   * D'où vient le titre : premier message, agent (`session_info_update`), renommage, ou l'app
   * (branche, bascule vers un autre agent : l'agent ne le remplace pas, fiche 125).
   */
  titleSource: 'message' | 'agent' | 'user' | 'app'
  profileId: string
  workspace: string
  /**
   * Autres dossiers donnés à l'agent avec le dossier de travail (`additionalDirectories`, fiche
   * 179), chemins absolus ; envoyés seulement si l'agent les prend.
   */
  additionalDirectories?: string[]
  /** Autres dossiers que l'agent a lus dans un message, et dans quelle session (D13). */
  toldDirectories?: { sessionId: string; folders: string[] }
  /** Session ACP à rouvrir (`session/load` / `session/resume`). */
  sessionId?: string
  createdAt: string
  updatedAt: string
  /** Épinglée en tête de la barre latérale (fiche 026). */
  pinned?: boolean
  /**
   * Conversation dans un worktree git (fiche 036) : dépôt, dossier, branche, commit de départ ;
   * et depuis la fiche 110, d'où il part (branche de base, date, sujet, modifications non
   * commitées du dossier d'origine).
   */
  worktree?: WorktreeInfo
  /** Archivée : hors des « Récents », sans agent ; rouverte au prochain message. */
  archived?: boolean
  /** Branche d'une autre conversation (fiche 023). */
  branchedFrom?: { id: string; title: string }
  /** Conversation fille, lancée depuis une autre (fiche 097). */
  startedFrom?: { id: string; title: string }
  /** Relecteur (fiche 177) : la conversation dont il relit le travail, dans le même dossier. */
  reviewOf?: { id: string; title: string }
  /** Rôle d'une fille (fiche 223) : retenu à son lancement (lecture seule, outils, icône). */
  role?: RoleStamp
  /** Consommation résumée, pour la liste (fiche 109) ; le détail est dans le fil. */
  usage?: UsageDigest
  /** Exécution d'une tâche planifiée (fiche 178) : la tâche et son nom au lancement. */
  scheduled?: { taskId: string; name: string }
  /** Propositions de mémoire en attente d'une décision (fiche 182), pour la pastille. */
  memoryPending?: number
  /**
   * Sessions d'aparté que l'agent garde (il ne sait pas les supprimer, fiche 180) : jamais
   * proposées dans « Reprendre une session… ». Les plus récentes, bornées.
   */
  asideSessions?: { profileId: string; sessionId: string }[]
}

export const SAFE_ID = /^[\w-]+$/

export function isRecord(value: unknown): value is ConversationRecord {
  const r = value as Partial<ConversationRecord> | null
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    SAFE_ID.test(r.id) &&
    typeof r.title === 'string' &&
    typeof r.profileId === 'string' &&
    typeof r.workspace === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string'
  )
}

/** Résumé de consommation vérifié : un résumé mal formé est retiré, pas la conversation. */
function withUsage(record: ConversationRecord): ConversationRecord {
  const checked = withRole(record)
  if (checked.usage === undefined) return checked
  const { usage, ...rest } = checked
  const digest = parseUsageDigest(usage)
  return digest ? { ...rest, usage: digest } : rest
}

/** Rôle d'une fille (fiche 223) vérifié : un rôle mal formé est retiré, pas la conversation. */
function withRole(record: ConversationRecord): ConversationRecord {
  if (record.role === undefined) return record
  const { role, ...rest } = record
  const stamp = parseRoleStamp(role)
  return stamp ? { ...rest, role: stamp } : rest
}

/** Autres dossiers (fiche 179) : seulement des chemins ; une liste abîmée est retirée. */
function withFolders(record: ConversationRecord): ConversationRecord {
  const { additionalDirectories: folders, toldDirectories: told, ...rest } = record
  const toldOk = typeof told?.sessionId === 'string' && isPaths(told.folders)
  return {
    ...rest,
    ...(isPaths(folders) && folders.length > 0 ? { additionalDirectories: folders } : {}),
    ...(toldOk ? { toldDirectories: told } : {})
  }
}

function isPaths(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((f) => typeof f === 'string')
}

/** Version du format d'un fil sur le disque (fiche 103) ; un fil sans version est lu tel quel. */
export const TRANSCRIPT_FORMAT_VERSION = 1

/** Fil sur le disque : sa version, le fil, puis la copie de son enregistrement (fiche 197). */
export function serializeTranscript(
  transcript: TranscriptState,
  record?: ConversationRecord
): string {
  return JSON.stringify({
    version: TRANSCRIPT_FORMAT_VERSION,
    ...transcript,
    ...(record ? { record } : {})
  })
}

export type RawTranscript = Partial<TranscriptState> & {
  version?: unknown
  record?: unknown
  trashed?: unknown
}

/** Un fil lu du disque, sans son numéro de version ni ce qui l'accompagne. */
function transcriptOf(raw: RawTranscript): TranscriptState {
  const { version: _version, record: _record, trashed: _trashed, ...transcript } = raw
  return transcript as TranscriptState
}

export function isTranscript(raw: unknown): raw is RawTranscript {
  const r = raw as RawTranscript | null
  return (
    typeof r === 'object' && r !== null && Array.isArray(r.items) && typeof r.nextId === 'number'
  )
}

/**
 * Enregistrement d'un fil retrouvé sans index : sa copie (fiche 197), sinon (fil d'avant la 0.11)
 * un enregistrement refait de ce qu'il contient — titre du premier message, ni agent ni dossier
 * connus (l'agent par défaut, aucun dossier : à choisir à la reprise).
 */
export function recordFromTranscript(
  id: string,
  raw: RawTranscript,
  modified: Date
): ConversationRecord {
  if (isRecord(raw.record) && raw.record.id === id) return withFolders(withUsage(raw.record))
  let title = id
  for (const item of raw.items ?? []) {
    if (item.kind === 'user' && typeof item.text === 'string' && item.text.trim()) {
      title = (item.text.trim().split('\n')[0] ?? id).slice(0, 80)
      break
    }
  }
  const at = modified.toISOString()
  return {
    id,
    title,
    titleSource: 'app',
    profileId: '',
    workspace: '',
    createdAt: at,
    updatedAt: at
  }
}

export class ConversationStore {
  private readonly dir: string
  /** Fichiers illisibles mis de côté pendant la lecture (pour prévenir l'utilisateur). */
  readonly damaged: string[] = []
  /**
   * Conversations retrouvées dans leurs fils à la lecture de l'index (fiche 197) ; `rebuilt` si
   * l'index et sa copie étaient perdus (sinon, des fils qui y manquaient seulement).
   */
  recovered: { count: number; rebuilt: boolean } | undefined
  /** Entrées d'index illisibles par cette version (plus récente) : réécrites telles quelles. */
  private foreign: unknown[] = []
  /** Fils d'une version plus récente : jamais réécrits. */
  private readonly newer = new Set<string>()
  /** Conversations supprimées : plus aucune écriture de leur fil, même déjà en vol (fiche 196). */
  private readonly gone = new Set<string>()
  /** Enregistrement d'une conversation, copié dans son fil à chaque écriture (fiche 197). */
  private recordOf: (id: string) => ConversationRecord | undefined = () => undefined

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  get folder(): string {
    return this.dir
  }

  /** Source des enregistrements copiés dans les fils (le gestionnaire des conversations). */
  attachRecords(recordOf: (id: string) => ConversationRecord | undefined): void {
    this.recordOf = recordOf
  }

  /** La conversation est supprimée (`true`) ou revient de la corbeille (`false`). */
  setGone(id: string, gone: boolean): void {
    if (gone) this.gone.add(id)
    else this.gone.delete(id)
  }

  /** Fil lu d'une version plus récente (jamais réécrit). */
  isNewer(id: string): boolean {
    return this.newer.has(id)
  }

  private writable(id: string): boolean {
    return !this.gone.has(id) && !this.newer.has(id)
  }

  private transcriptFile(id: string): string {
    if (!SAFE_ID.test(id)) throw new Error(`Identifiant de conversation invalide : ${id}`)
    return join(this.dir, `${id}.json`)
  }

  /** Fichier du fil (corbeille). */
  fileOf(id: string): string {
    return this.transcriptFile(id)
  }

  loadIndex(): ConversationRecord[] {
    const listed = this.readIndex()
    // Fils absents de l'index (index perdu, écriture de l'index en échec) : ils y reviennent.
    const known = new Set(listed?.map((r) => r.id) ?? [])
    const found = this.orphanRecords(known, listed === undefined)
    if (found.length > 0) {
      this.recovered = { count: found.length, rebuilt: listed === undefined }
      // L'index refait est écrit tout de suite (fiche 197).
      try {
        this.saveIndex([...(listed ?? []), ...found])
      } catch (error) {
        log.warn('Index refait non écrit (il le sera à la prochaine écriture) :', error)
      }
      log.warn(
        `Conversations retrouvées dans leurs fils (${listed === undefined ? 'index refait' : 'absentes de l’index'}) :`,
        found.map((r) => r.id)
      )
    }
    return [...(listed ?? []), ...found]
  }

  /** L'index, ou sa copie s'il est abîmé ou absent ; `undefined` si aucun des deux ne se lit. */
  private readIndex(): ConversationRecord[] | undefined {
    const file = join(this.dir, 'index.json')
    const read = readJson(file)
    if (read.ok && Array.isArray(read.value)) return this.records(read.value)
    if (read.ok || read.reason !== 'missing') {
      // JSON valide mais pas une liste : mis de côté lui aussi (sinon il écraserait la copie).
      const movedTo = read.ok ? quarantine(file) : read.movedTo
      this.damaged.push(movedTo ?? file)
    }
    // Index abîmé ou disparu : on repart de la dernière bonne copie.
    const backup = readJson(`${file}.bak`)
    if (backup.ok && Array.isArray(backup.value)) return this.records(backup.value)
    // Premier lancement : ni index ni copie, et rien à retrouver (la liste refaite est vide).
    return undefined
  }

  private records(list: unknown[]): ConversationRecord[] {
    this.foreign = list.filter(
      (entry) => !isRecord(entry) && typeof entry === 'object' && entry !== null
    )
    return list.filter(isRecord).map(withUsage).map(withFolders)
  }

  /**
   * Conversations dont le fil est sur le disque mais pas dans l'index. Sans index du tout
   * (`rebuild`), les fils d'avant la 0.11, sans copie de leur enregistrement, reviennent aussi.
   */
  private orphanRecords(known: ReadonlySet<string>, rebuild: boolean): ConversationRecord[] {
    let names: string[]
    try {
      names = readdirSync(this.dir)
    } catch {
      return []
    }
    const found: ConversationRecord[] = []
    for (const name of names.sort()) {
      const id = name.endsWith('.json') ? name.slice(0, -5) : ''
      if (!SAFE_ID.test(id) || id === 'index' || known.has(id)) continue
      const file = join(this.dir, name)
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
        if (!isTranscript(raw) || (!rebuild && !isRecord(raw.record))) continue
        found.push(recordFromTranscript(id, raw, statSync(file).mtime))
      } catch {
        // Fil illisible : il sera mis de côté s'il est ouvert ; rien à retrouver ici.
      }
    }
    return found
  }

  saveIndex(records: ConversationRecord[]): void {
    const all = [...records, ...this.foreign]
    writeFileAtomic(join(this.dir, 'index.json'), JSON.stringify(all), { backup: true })
  }

  loadTranscript(id: string): TranscriptState | undefined {
    const file = this.transcriptFile(id)
    const read = readJson(file)
    if (!read.ok) {
      if (read.reason === 'corrupt') this.damaged.push(read.movedTo ?? file)
      return undefined
    }
    const raw = read.value
    if (isTranscript(raw)) {
      if (typeof raw.version === 'number' && raw.version > TRANSCRIPT_FORMAT_VERSION) {
        // Fil d'une version plus récente : lu tel quel, jamais réécrit (fiche 196).
        log.warn(`Fil d’une version plus récente (${raw.version}), jamais réécrit : ${id}`)
        this.newer.add(id)
      }
      return transcriptOf(raw)
    }
    // JSON valide mais pas un fil (version future, fichier remplacé) : mis de côté lui aussi, sinon
    // le fil vide qui le remplace l'écraserait à la prochaine écriture (fiche 187).
    this.damaged.push(quarantine(file) ?? file)
    return undefined
  }

  /**
   * Lecture asynchrone pour la recherche (fiche 046) : ne bloque pas le main pendant la lecture,
   * et un fichier abîmé est seulement ignoré (il sera mis de côté à l'ouverture de la conversation).
   */
  async readTranscriptAsync(id: string): Promise<TranscriptState | undefined> {
    try {
      const raw = JSON.parse(await readFile(this.transcriptFile(id), 'utf8')) as unknown
      return isTranscript(raw) ? transcriptOf(raw) : undefined
    } catch {
      return undefined
    }
  }

  /** Version du fil sur le disque (taille et date de modification) ; `undefined` s'il n'existe pas. */
  async transcriptStamp(id: string): Promise<string | undefined> {
    try {
      const info = await stat(this.transcriptFile(id))
      return `${info.size}:${info.mtimeMs}`
    } catch {
      return undefined
    }
  }

  /** Écriture synchrone (fermeture de l'app). */
  saveTranscript(id: string, transcript: TranscriptState): void {
    if (!this.writable(id)) return
    writeFileAtomic(this.transcriptFile(id), serializeTranscript(transcript, this.recordOf(id)))
  }

  /**
   * Écriture asynchrone (fiche 043) : le fil peut peser des méga-octets, le disque est synchronisé
   * hors du fil principal. `commit` : abandonner si une écriture plus récente a pris le pas.
   */
  saveTranscriptAsync(
    id: string,
    transcript: TranscriptState,
    commit?: () => boolean
  ): Promise<boolean> {
    if (!this.writable(id)) return Promise.resolve(false)
    const text = serializeTranscript(transcript, this.recordOf(id))
    return writeFileAtomicAsync(this.transcriptFile(id), text, {
      // Supprimée pendant l'écriture : le fichier ne revient pas (fiche 196).
      commit: () => this.writable(id) && (commit?.() ?? true)
    })
  }

  deleteTranscript(id: string): void {
    rmSync(this.transcriptFile(id), { force: true })
  }
}
