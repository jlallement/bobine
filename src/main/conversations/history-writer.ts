/**
 * Écritures de l'historique et des réglages sur le disque. Une écriture ne fait jamais tomber l'app
 * (disque plein, droits…) : l'échec est journalisé et signalé une fois par type d'écriture, tant
 * qu'il dure (fiche 041). Pendant une réponse, le fil est écrit au plus une fois par seconde.
 *
 * Les fils peuvent peser des méga-octets : ils s'écrivent en asynchrone (synchronisation sur le
 * disque hors du fil principal), et une écriture dépassée par une plus récente du même fil ne
 * remplace pas le fichier (fiche 043). Une seule écriture asynchrone par fil à la fois (fiche
 * 193) : demandée pendant qu'une autre est en cours, elle attend sa fin et écrit alors le fil le
 * plus récent ; plusieurs demandes pendant ce temps n'en font qu'une. Avant, une écriture plus lente
 * que la seconde chevauchait la suivante : un long fil s'écrivait plusieurs fois en même temps.
 * À la fermeture de l'app, l'écriture est synchrone : il n'y a plus de boucle d'évènements pour
 * attendre.
 */
import type { TranscriptState } from '@shared/transcript'
import { log } from '../log'
import { saveSettings, type Settings } from '../settings'
import type { ConversationRecord, ConversationStore } from './store'
import type { Message } from '@shared/i18n/message'
import { messageOf } from '@shared/errors'

/** Ce que l'app écrit : l'index, les réglages, le fil d'une conversation. */
type Written = 'index' | 'settings' | 'transcript'

/** Délai d'écriture d'un fil pendant le streaming. */
const TRANSCRIPT_DELAY_MS = 1000

export interface HistoryWriterOptions {
  store: ConversationStore
  settingsFile: string
  /** Écriture impossible (premier échec de ce type) : message à montrer à l'utilisateur. */
  onFailure?: (message: Message) => void
  /** Fil à jour sur le disque, plus aucune écriture prévue ni en cours (fiche 046). */
  onIdle?: (id: string) => void
}

export class HistoryWriter {
  private readonly options: HistoryWriterOptions
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Écritures en échec, déjà signalées. */
  private readonly failing = new Set<Written>()
  /** Numéro de la dernière écriture demandée par fil : une écriture asynchrone dépassée s'abandonne. */
  private readonly generations = new Map<string, number>()
  /** Écritures asynchrones en cours. */
  private readonly inFlight = new Set<Promise<void>>()
  /** Écritures asynchrones en cours, par fil. */
  private readonly inFlightById = new Map<string, number>()
  /** Écriture à refaire à la fin de celle en cours, par fil : de quoi lire le fil à ce moment. */
  private readonly queued = new Map<string, () => TranscriptState | undefined>()
  /** Fils dont la dernière écriture a échoué : la mémoire est plus fraîche que le disque. */
  private readonly unsaved = new Set<string>()
  /** Dernière façon de lire chaque fil (avant de quitter : tous écrits, `flushAll`). */
  private readonly readers = new Map<string, () => TranscriptState | undefined>()
  /** Dernière erreur d'écriture d'un fil (disque plein…), pour le dire en quittant. */
  private lastFailure: unknown
  private readonly failureListeners = new Set<(message: Message) => void>()
  private readonly idleListeners = new Set<(id: string) => void>()

  constructor(options: HistoryWriterOptions) {
    this.options = options
    if (options.onFailure) this.failureListeners.add(options.onFailure)
    if (options.onIdle) this.idleListeners.add(options.onIdle)
  }

  /**
   * Prévient d'une écriture impossible (le premier échec de chaque type) ; rend le désabonnement.
   * L'écrivain peut exister avant ses abonnés (fiche 089) : il n'écrit rien avant d'en avoir.
   */
  onFailure(listener: (message: Message) => void): () => void {
    this.failureListeners.add(listener)
    return () => this.failureListeners.delete(listener)
  }

  /** Prévient quand un fil est à jour sur le disque (fiche 046) ; rend le désabonnement. */
  onIdle(listener: (id: string) => void): () => void {
    this.idleListeners.add(listener)
    return () => this.idleListeners.delete(listener)
  }

  index(records: ConversationRecord[]): void {
    this.write('index', () => this.options.store.saveIndex(records))
  }

  settings(settings: Settings): void {
    this.write('settings', () => saveSettings(this.options.settingsFile, settings))
  }

  /**
   * Fil d'une conversation : tout de suite (`now`, fin de tour) ou dans la seconde (streaming).
   * `read` rend le fil à écrire au moment de l'écriture, ou `undefined` s'il n'y a plus rien à
   * écrire (conversation supprimée, brouillon). `sync` : écriture bloquante (fermeture de l'app).
   */
  transcript(
    id: string,
    read: () => TranscriptState | undefined,
    now: boolean,
    options: { sync?: boolean } = {}
  ): void {
    this.readers.set(id, read)
    const pending = this.timers.get(id)
    if (now) {
      if (pending) clearTimeout(pending)
      this.timers.delete(id)
      this.writeTranscript(id, read, options.sync === true)
      return
    }
    if (pending) return
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id)
        this.writeTranscript(id, read, false)
      }, TRANSCRIPT_DELAY_MS)
    )
  }

  /**
   * Conversation supprimée (fiche 196) : plus d'écriture prévue, et la promesse rend la main quand
   * celles déjà en vol sont finies (le fil peut alors partir à la corbeille sans revenir).
   */
  async forget(id: string): Promise<void> {
    const timer = this.timers.get(id)
    if (timer) clearTimeout(timer)
    this.timers.delete(id)
    this.unsaved.delete(id)
    this.readers.delete(id)
    while (this.inFlightById.has(id)) await Promise.all([...this.inFlight])
  }

  /**
   * Avant de quitter (fiche 197) : chaque fil écrit tout de suite, de façon synchrone ; ceux en
   * échec restent dans `unsavedIds`.
   */
  async flushAll(): Promise<void> {
    this.cancelPending()
    // Une écriture en vol peut renommer son fichier après une écriture synchrone plus récente : on
    // la laisse finir (et celles qui la suivent), puis on écrit le plus récent.
    await this.settled()
    for (const [id, read] of [...this.readers]) this.writeTranscript(id, read, true)
  }

  /** Fils dont la dernière écriture a échoué : la mémoire est plus fraîche que le disque. */
  unsavedIds(): string[] {
    return [...this.unsaved]
  }

  lastError(): unknown {
    return this.lastFailure
  }

  /** Fermeture de l'app : plus d'écriture différée (les fils sont écrits par l'appelant). */
  cancelPending(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.queued.clear()
  }

  /**
   * Le fil est-il à jour sur le disque (aucune écriture prévue, en cours ni en échec) ? Seul un fil
   * dans ce cas peut être retiré de la mémoire (fiche 046).
   */
  idle(id: string): boolean {
    return (
      !this.timers.has(id) &&
      !this.inFlightById.has(id) &&
      !this.queued.has(id) &&
      !this.unsaved.has(id)
    )
  }

  /** Attend les écritures asynchrones en cours, et celles qu'elles ont fait attendre (tests). */
  async settled(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight])
  }

  private writeTranscript(
    id: string,
    read: () => TranscriptState | undefined,
    sync: boolean
  ): void {
    if (!sync && this.inFlightById.has(id)) {
      // Une écriture de ce fil est en cours : celle-ci la suit, avec le fil le plus récent.
      this.queued.set(id, read)
      return
    }
    // Écriture synchrone (fermeture) : elle écrit le plus récent, l'écriture en attente n'a plus lieu.
    this.queued.delete(id)
    const transcript = read()
    if (!transcript) return
    const generation = (this.generations.get(id) ?? 0) + 1
    this.generations.set(id, generation)
    if (sync) {
      const saved = this.write('transcript', () =>
        this.options.store.saveTranscript(id, transcript)
      )
      if (saved) this.unsaved.delete(id)
      else this.unsaved.add(id)
      return
    }
    this.inFlightById.set(id, (this.inFlightById.get(id) ?? 0) + 1)
    const task: Promise<void> = this.options.store
      .saveTranscriptAsync(id, transcript, () => this.generations.get(id) === generation)
      .then(
        () => {
          this.failing.delete('transcript')
          // Écriture abandonnée (dépassée) : la plus récente dira si le fil est enregistré.
          if (this.generations.get(id) === generation) this.unsaved.delete(id)
        },
        (error: unknown) => {
          this.unsaved.add(id)
          this.fail('transcript', error)
        }
      )
      .finally(() => {
        this.inFlight.delete(task)
        const left = (this.inFlightById.get(id) ?? 1) - 1
        if (left > 0) this.inFlightById.set(id, left)
        else this.inFlightById.delete(id)
        const next = this.queued.get(id)
        if (next && left === 0) {
          this.queued.delete(id)
          this.writeTranscript(id, next, false)
        }
        if (this.idle(id)) for (const listener of [...this.idleListeners]) listener(id)
      })
    this.inFlight.add(task)
  }

  /** Rend `false` si l'écriture a échoué (déjà journalisé et signalé). */
  private write(what: Written, write: () => void): boolean {
    try {
      write()
      this.failing.delete(what)
      return true
    } catch (error) {
      this.fail(what, error)
      return false
    }
  }

  private fail(what: Written, error: unknown): void {
    if (what === 'transcript') this.lastFailure = error
    if (this.failing.has(what)) return
    this.failing.add(what)
    const detail = messageOf(error)
    log.error(`Impossible d’enregistrer (${what}) : ${detail}`, error)
    const full = isDiskFull(error)
    const message: Message = {
      key: full ? 'conversations.saveFailedDiskFull' : 'conversations.saveFailed',
      params: {
        what: { key: `conversations.saved.${what}` },
        ...(full ? {} : { error: detail })
      }
    }
    for (const listener of [...this.failureListeners]) listener(message)
  }
}

/** Disque plein (ou quota) : dit en clair plutôt que par son code (fiche 197). */
export function isDiskFull(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'ENOSPC' || code === 'EDQUOT'
}
