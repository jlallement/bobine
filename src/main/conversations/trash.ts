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
import { fsyncDir, isReadOnly, readJson, writeFileAtomic } from '../storage'
import { discussionFolder, eraseDiscussionFolder, sweepDiscussionFolders } from './discussion-space'
import type { Conversation } from './conversation'
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
  /**
   * Supprimée avec sa mère (identifiant de la conversation supprimée, fiche 228) : restaurer cette
   * mère la restaure aussi. Une fille supprimée seule avant reste à la corbeille.
   */
  deletedWith?: string
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
    options: { agentDeleted?: boolean; deletedWith?: string; now?: Date } = {}
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
      ...(options.agentDeleted ? { agentDeleted: true } : {}),
      ...(options.deletedWith ? { deletedWith: options.deletedWith } : {})
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
    if (isReadOnly(join(this.dir, 'x'))) return records
    // Dossiers de discussion que plus rien ne connaît (fiche 224) : brouillons d'avant l'arrêt.
    sweepDiscussionFolders(dirname(this.dir), new Set([...pending, ...records.map((r) => r.id)]))
    if (pending.size === 0) return records
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
    const metas = this.metas()
    // Travaux supprimés avec chaque conversation, encore là (recette rc.4, T7).
    const children = new Map<string, number>()
    for (const { deletedWith } of metas) {
      if (deletedWith) children.set(deletedWith, (children.get(deletedWith) ?? 0) + 1)
    }
    return metas
      .map(({ record, deletedAt }) => ({
        id: record.id,
        title: record.title,
        workspace: record.workspace,
        ...(record.space === 'discussion' ? { space: record.space } : {}),
        deletedAt,
        erasedAt: new Date(Date.parse(deletedAt) + TRASH_DAYS * DAY_MS).toISOString(),
        ...(children.get(record.id) ? { children: children.get(record.id) } : {})
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

  /** Conversations de la corbeille supprimées avec `id` (sa descendance, fiche 228). */
  deletedWith(id: string): string[] {
    return this.metas()
      .filter((meta) => meta.deletedWith === id)
      .map((meta) => meta.record.id)
  }

  /**
   * Efface définitivement une conversation de la corbeille, et ce qui en restait ailleurs dans
   * l'historique : ses copies abîmées mises de côté, et son entrée dans la copie de l'index.
   */
  erase(id: string): void {
    if (!SAFE_ID.test(id)) throw new Error(`Identifiant de conversation invalide : ${id}`)
    this.writable()
    // Discussion (fiche 224) : ses documents, restés en place, partent avec elle — jamais un
    // dossier qu'une autre conversation (vivante ou dans la corbeille) désigne encore.
    if (this.meta(id)?.record.space === 'discussion') {
      const folder = discussionFolder(dirname(this.dir), id)
      if (this.folderShared(id, folder)) log.warn(`Dossier de discussion gardé (partagé) : ${id}`)
      else eraseDiscussionFolder(dirname(this.dir), id)
    }
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

  /** Une autre conversation que `id`, dans l'index ou la corbeille, a `folder` pour dossier. */
  private folderShared(id: string, folder: string): boolean {
    const read = readJson(join(dirname(this.dir), 'index.json'))
    const live = read.ok && Array.isArray(read.value) ? read.value.filter(isRecord) : []
    return [...live, ...this.metas().map((m) => m.record)].some(
      (r) => r.id !== id && r.workspace === folder
    )
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
    ...(r.agentDeleted ? { agentDeleted: true } : {}),
    ...(typeof r.deletedWith === 'string' ? { deletedWith: r.deletedWith } : {})
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
    agentDeleted: boolean,
    deletedWith?: string
  ): Promise<void> {
    const { id } = conversation.record
    this.store.setGone(id, true)
    await this.writer.forget(id)
    // Fil d'une version plus récente : déplacé tel quel, jamais réécrit dans ce format-ci.
    const transcript = this.store.isNewer(id) ? undefined : conversation.transcript
    this.trash.put(conversation.record, transcript, this.store.fileOf(id), {
      agentDeleted,
      ...(deletedWith ? { deletedWith } : {})
    })
  }

  /**
   * Sa session supprimée chez l'agent : l'enregistrement revient sans elle (session neuve), avec
   * l'avis à poser dans son fil. `agentLabel` : le nom de l'agent d'un profil.
   */
  /**
   * Restaure `id`, puis la descendance supprimée avec elle (fiche 228), mère avant filles : ce que
   * la suppression a emmené revient avec elle, rangé dans `conversations`. Une fille qui ne revient
   * pas (fichier abîmé) reste à la corbeille, consignée ; la mère, elle, est revenue.
   *
   * `seq` : le dernier numéro d'évènement émis par le gestionnaire. Le renderer a pu voir ces
   * conversations avant leur suppression et écarte une vue moins récente que ce qu'il a vu : repartir
   * de 0 les laissait figées, « Arrêté », sans que rien parte (recette rc.4, T1).
   */
  restoreFamily(
    id: string,
    agentLabel: (profileId: string) => string,
    conversations: Map<string, Conversation>,
    seq: number
  ): { conversation: Conversation; notice?: AgentEvent }[] {
    const revive = ({ record, notice }: ReturnType<TrashLink['restore']>) => {
      const conversation: Conversation = { record, lastUsed: 0, readAt: 0, draft: false, seq }
      conversations.set(record.id, conversation)
      return { conversation, ...(notice ? { notice } : {}) }
    }
    const restored = [revive(this.restore(id, agentLabel))]
    for (const child of this.trash.deletedWith(id)) {
      try {
        restored.push(revive(this.restore(child, agentLabel)))
      } catch (error) {
        log.warn(`Fille ${child.slice(0, 8)} non restaurée avec sa mère :`, error)
      }
    }
    return restored
  }

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
