/**
 * Corbeille des conversations (fiche 196) : une conversation supprimée n'est plus effacée, elle
 * part dans `conversations/.trash/` et s'y restaure pendant `TRASH_DAYS` jours (Réglages › Données).
 * Passé ce délai, elle est effacée au lancement ; l'utilisateur peut aussi l'effacer tout de suite,
 * ligne par ligne (vie privée : une clé collée par erreur).
 *
 * Deux fichiers par conversation : `<id>.json`, le fil tel qu'il était (avec la copie de son
 * enregistrement, fiche 197), et `<id>.meta.json`, petit, pour lister sans lire les fils.
 */
import { readOnlyError } from '../read-only-error'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { t } from 'i18next'
import type { AgentEvent } from '@shared/agent'
import type { TranscriptState } from '@shared/transcript'
import type { TrashEntry } from '@shared/profile'
import { log } from '../log'
import { fsyncDir, isReadOnly, writeFileAtomic } from '../storage'
import type { HistoryWriter } from './history-writer'
import {
  isRecord,
  SAFE_ID,
  serializeTranscript,
  type ConversationRecord,
  type ConversationStore
} from './store'

export const TRASH_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

interface TrashMeta {
  record: ConversationRecord
  deletedAt: string
  /** La session a aussi été supprimée chez l'agent : la reprendre n'est plus possible. */
  agentDeleted?: boolean
}

export class ConversationTrash {
  readonly dir: string

  constructor(conversationsDir: string) {
    this.dir = join(conversationsDir, '.trash')
  }

  /**
   * Met une conversation à la corbeille : son fil en mémoire s'il est chargé (le plus récent, écrit
   * là), sinon le fichier du disque tel quel (déplacé, même illisible ou d'une version plus récente).
   */
  put(
    record: ConversationRecord,
    transcript: TranscriptState | undefined,
    file: string,
    options: { agentDeleted?: boolean; now?: Date } = {}
  ): void {
    const { id } = record
    if (!SAFE_ID.test(id)) throw new Error(`Identifiant de conversation invalide : ${id}`)
    this.writable()
    mkdirSync(this.dir, { recursive: true })
    // La fiche d'abord : un arrêt brutal ensuite laisse une suppression à finir (`settle`), jamais
    // un fil dans la corbeille que rien ne liste.
    const meta: TrashMeta = {
      record,
      deletedAt: (options.now ?? new Date()).toISOString(),
      ...(options.agentDeleted ? { agentDeleted: true } : {})
    }
    writeFileAtomic(join(this.dir, `${id}.meta.json`), JSON.stringify(meta))
    const target = join(this.dir, `${id}.json`)
    if (transcript) writeFileAtomic(target, serializeTranscript(transcript, record))
    else if (existsSync(file)) renameSync(file, target)
    rmSync(file, { force: true })
    fsyncDir(this.dir)
  }

  /**
   * Suppressions laissées en route par un arrêt brutal (fiche fiche écrite, fil encore dans
   * l'historique) : finies au lancement. Rend les enregistrements sans ces conversations.
   */
  settle(records: ConversationRecord[], fileOf: (id: string) => string): ConversationRecord[] {
    const pending = new Set(this.metas().map((meta) => meta.record.id))
    if (pending.size === 0 || isReadOnly(join(this.dir, 'x'))) return records
    for (const id of pending) {
      const live = fileOf(id)
      if (!existsSync(live)) continue
      const target = join(this.dir, `${id}.json`)
      if (existsSync(target)) rmSync(live, { force: true })
      else renameSync(live, target)
      log.warn(`Suppression finie au lancement (arrêt pendant la mise à la corbeille) : ${id}`)
    }
    return records.filter((record) => !pending.has(record.id))
  }

  /** Profil en lecture seule : refusé (rien n'y entre, rien n'en sort). */
  writable(): void {
    if (isReadOnly(join(this.dir, 'x'))) throw readOnlyError()
  }

  list(now = new Date()): TrashEntry[] {
    return this.metas()
      .map(({ record, deletedAt }) => ({
        id: record.id,
        title: record.title,
        workspace: record.workspace,
        deletedAt,
        erasedAt: new Date(Date.parse(deletedAt) + TRASH_DAYS * DAY_MS).toISOString()
      }))
      .filter(
        (entry) => Date.parse(entry.erasedAt) > now.getTime() || isNaN(Date.parse(entry.erasedAt))
      )
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  }

  /**
   * Sort une conversation de la corbeille : son fil revient dans l'historique (`targetFile`), et
   * son enregistrement est rendu. `agentDeleted` : sa session n'existe plus chez l'agent.
   */
  restore(id: string, targetFile: string): { record: ConversationRecord; agentDeleted: boolean } {
    this.writable()
    const meta = this.meta(id)
    if (!meta) throw new Error(t('profile.trash.missing'))
    const source = join(this.dir, `${id}.json`)
    if (existsSync(source)) renameSync(source, targetFile)
    rmSync(join(this.dir, `${id}.meta.json`), { force: true })
    return { record: meta.record, agentDeleted: meta.agentDeleted === true }
  }

  /**
   * Efface définitivement une conversation de la corbeille, et ce qui en restait ailleurs dans
   * l'historique : ses copies abîmées mises de côté, et son entrée dans la copie de l'index.
   */
  erase(id: string): void {
    if (!SAFE_ID.test(id)) throw new Error(`Identifiant de conversation invalide : ${id}`)
    this.writable()
    for (const suffix of ['.json', '.meta.json']) {
      rmSync(join(this.dir, `${id}${suffix}`), { force: true })
    }
    const conversations = dirname(this.dir)
    for (const name of safeList(conversations)) {
      if (name.startsWith(`${id}.json.corrupt-`)) rmSync(join(conversations, name), { force: true })
    }
    forgetInBackupIndex(join(conversations, 'index.json.bak'), id)
  }

  /** Efface ce qui est dans la corbeille depuis plus de `TRASH_DAYS` jours ; rend leur nombre. */
  purge(now = new Date()): number {
    if (isReadOnly(join(this.dir, 'x'))) return 0
    let erased = 0
    for (const { record, deletedAt } of this.metas()) {
      const at = Date.parse(deletedAt)
      if (isNaN(at) || now.getTime() - at < TRASH_DAYS * DAY_MS) continue
      this.erase(record.id)
      erased++
    }
    if (erased)
      log.info(`Corbeille : ${erased} conversation(s) de plus de ${TRASH_DAYS} jours effacée(s)`)
    return erased
  }

  private meta(id: string): TrashMeta | undefined {
    if (!SAFE_ID.test(id)) return undefined
    try {
      const raw = JSON.parse(readFileSync(join(this.dir, `${id}.meta.json`), 'utf8')) as unknown
      return parseMeta(raw)
    } catch {
      return undefined
    }
  }

  private metas(): TrashMeta[] {
    let names: string[]
    try {
      names = readdirSync(this.dir)
    } catch {
      return []
    }
    return names
      .filter((name) => name.endsWith('.meta.json'))
      .map((name) => this.meta(name.slice(0, -'.meta.json'.length)))
      .filter((meta): meta is TrashMeta => meta !== undefined)
  }
}

function parseMeta(raw: unknown): TrashMeta | undefined {
  const r = raw as Partial<TrashMeta> | null
  if (typeof r !== 'object' || r === null || !isRecord(r.record)) return undefined
  if (typeof r.deletedAt !== 'string') return undefined
  return {
    record: r.record,
    deletedAt: r.deletedAt,
    ...(r.agentDeleted ? { agentDeleted: true } : {})
  }
}

/**
 * Ce que la corbeille fait pour le gestionnaire des conversations : le fil d'une conversation
 * supprimée ne s'écrit plus (même une écriture déjà en vol), puis il y part ; restauré, il revient.
 */
export class TrashLink {
  private readonly trash: ConversationTrash
  private readonly store: ConversationStore
  private readonly writer: Pick<HistoryWriter, 'forget'>

  constructor(
    trash: ConversationTrash,
    store: ConversationStore,
    writer: Pick<HistoryWriter, 'forget'>
  ) {
    this.trash = trash
    this.store = store
    this.writer = writer
  }

  /** Profil en lecture seule : refusé. */
  writable(): void {
    this.trash.writable()
  }

  async put(
    conversation: { record: ConversationRecord; transcript?: TranscriptState },
    agentDeleted: boolean
  ): Promise<void> {
    const { id } = conversation.record
    this.store.setGone(id, true)
    await this.writer.forget(id)
    // Fil d'une version plus récente : déplacé tel quel, jamais réécrit dans ce format-ci.
    const transcript = this.store.isNewer(id) ? undefined : conversation.transcript
    this.trash.put(conversation.record, transcript, this.store.fileOf(id), { agentDeleted })
  }

  /**
   * Sa session supprimée chez l'agent : l'enregistrement revient sans elle (session neuve), avec
   * l'avis à poser dans son fil. `agentLabel` : le nom de l'agent d'un profil.
   */
  restore(
    id: string,
    agentLabel: (profileId: string) => string
  ): { record: ConversationRecord; notice?: AgentEvent } {
    const { record, agentDeleted } = this.trash.restore(id, this.store.fileOf(id))
    this.store.setGone(id, false)
    if (!agentDeleted) return { record }
    delete record.sessionId
    return { record, notice: trashNotice(agentLabel(record.profileId)) }
  }
}

/** Avis du fil d'une conversation restaurée dont la session a été supprimée chez l'agent. */
export function trashNotice(agent: string): AgentEvent {
  return {
    type: 'notice',
    level: 'info',
    message: { key: 'profile.trashNotice', params: { agent } }
  }
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** Retire une conversation de la copie de l'index (son titre ne doit pas y survivre). */
function forgetInBackupIndex(file: string, id: string): void {
  let list: unknown
  try {
    list = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return
  }
  if (!Array.isArray(list)) return
  const kept = list.filter((entry) => (entry as { id?: unknown } | null)?.id !== id)
  if (kept.length !== list.length) writeFileAtomic(file, JSON.stringify(kept))
}
