/**
 * Recherche dans le contenu des conversations (fiche 026) : messages de l'utilisateur et de
 * l'agent, des plus récentes aux plus anciennes ; tous les mots, sans casse ni accents.
 *
 * Fiche 046 : un fil qui n'est pas en mémoire est lu sur le disque en asynchrone et **n'est pas
 * gardé** ; seul son texte cherchable l'est, dans un cache borné, tant que le fichier ne change pas.
 * Le texte est gardé déjà plié (sans casse ni accents) : une recherche ne replie rien.
 */
import {
  foldSameLength,
  matchContent,
  plainText,
  searchWords,
  type ContentHit
} from '@shared/conversation-search'
import type { TranscriptState } from '@shared/transcript'

const MAX_SEARCH_HITS = 30
/** Texte des fils lus sur le disque gardé au plus (en caractères, texte plié compris). */
const MAX_CACHED_CHARS = 16_000_000

/** Texte cherchable d'un fil, et le même plié (même longueur). */
interface SearchText {
  text: string
  folded: string
}

const EMPTY: SearchText = { text: '', folded: '' }

export interface Searchable {
  id: string
  title: string
  updatedAt: string
  /** Fil en mémoire (conversation ouverte), cherché tel quel ; sinon lu sur le disque. */
  transcript?: TranscriptState
}

/** Accès aux fils enregistrés (`ConversationStore`). */
export interface TranscriptSource {
  /** Version du fil sur le disque ; `undefined` s'il n'existe pas. */
  transcriptStamp(id: string): Promise<string | undefined>
  /** Fil lu sur le disque ; `undefined` s'il est absent ou abîmé. */
  readTranscriptAsync(id: string): Promise<TranscriptState | undefined>
}

export class ContentSearch {
  private readonly source: TranscriptSource
  private readonly maxCachedChars: number
  /** Texte des fils en mémoire, tant que le fil ne change pas (il est remplacé à chaque évènement). */
  private readonly texts = new WeakMap<TranscriptState, SearchText>()
  /**
   * Texte des fils lus sur le disque, du moins au plus récemment utilisé, avec la dernière
   * recherche qui s'en est servi.
   */
  private readonly diskTexts = new Map<string, SearchText & { stamp: string; run: number }>()
  private diskChars = 0
  private run = 0
  /** Lectures en cours : deux recherches simultanées ne lisent pas deux fois le même fichier. */
  private readonly reading = new Map<string, Promise<SearchText>>()

  constructor(source: TranscriptSource, options: { maxCachedChars?: number } = {}) {
    this.source = source
    this.maxCachedChars = options.maxCachedChars ?? MAX_CACHED_CHARS
  }

  /** Conversations du gestionnaire, sans les vides (sorti de `ConversationManager.search`). */
  searchConversations(
    conversations: Iterable<{
      draft: boolean
      record: Pick<Searchable, 'id' | 'title' | 'updatedAt'>
      transcript?: TranscriptState | undefined
    }>,
    query: string
  ): Promise<ContentHit[]> {
    const searchable = [...conversations]
      .filter((c) => !c.draft)
      .map(({ record, transcript }) => ({
        id: record.id,
        title: record.title,
        updatedAt: record.updatedAt,
        ...(transcript ? { transcript } : {})
      }))
    return this.search(searchable, query)
  }

  async search(conversations: Iterable<Searchable>, query: string): Promise<ContentHit[]> {
    const words = searchWords(query)
    if (words.length === 0) return []
    const run = ++this.run
    const hits: ContentHit[] = []
    const sorted = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    for (const conversation of sorted) {
      const { text, folded } = conversation.transcript
        ? this.textOf(conversation.transcript)
        : await this.diskText(conversation.id, run)
      const hit = matchContent(conversation.title, text, words, folded)
      if (hit) hits.push({ id: conversation.id, ...hit })
      if (hits.length >= MAX_SEARCH_HITS) break
    }
    return hits
  }

  /** Conversation supprimée : son texte ne sert plus. */
  forget(id: string): void {
    const cached = this.diskTexts.get(id)
    if (!cached) return
    this.diskChars -= cached.text.length * 2
    this.diskTexts.delete(id)
  }

  private textOf(transcript: TranscriptState): SearchText {
    const cached = this.texts.get(transcript)
    if (cached !== undefined) return cached
    const text = searchableText(transcript)
    this.texts.set(transcript, text)
    return text
  }

  private diskText(id: string, run: number): Promise<SearchText> {
    const pending = this.reading.get(id)
    if (pending) return pending
    const reading = this.readDiskText(id, run).finally(() => this.reading.delete(id))
    this.reading.set(id, reading)
    return reading
  }

  private async readDiskText(id: string, run: number): Promise<SearchText> {
    const stamp = await this.source.transcriptStamp(id)
    if (stamp === undefined) {
      this.forget(id)
      return EMPTY
    }
    const cached = this.diskTexts.get(id)
    if (cached?.stamp === stamp) {
      // Le plus récemment utilisé passe en fin de liste.
      this.diskTexts.delete(id)
      this.diskTexts.set(id, { ...cached, run })
      return cached
    }
    const transcript = await this.source.readTranscriptAsync(id)
    const text = transcript ? searchableText(transcript) : EMPTY
    this.forget(id)
    this.diskTexts.set(id, { ...text, stamp, run })
    this.diskChars += text.text.length * 2
    // Place faite aux dépens des textes des recherches précédentes seulement : pendant un parcours
    // plus grand que le cache, les conversations les plus récentes (parcourues d'abord) restent, au
    // lieu de se chasser les unes les autres à chaque recherche.
    for (const [oldest, entry] of this.diskTexts) {
      if (this.diskChars <= this.maxCachedChars || entry.run === run) break
      this.forget(oldest)
    }
    if (this.diskChars > this.maxCachedChars) this.forget(id)
    return text
  }
}

function searchableText(transcript: TranscriptState): SearchText {
  const text = transcript.items
    .flatMap((item) =>
      item.kind === 'user' ? [item.text] : item.kind === 'agent' ? [plainText(item.text)] : []
    )
    .join('\n\n')
  return { text, folded: foldSameLength(text) }
}
