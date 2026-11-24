import { describe, expect, it } from 'vitest'
import type { TranscriptState } from '@shared/transcript'
import { ContentSearch, type TranscriptSource } from './content-search'

const transcript = (text: string): TranscriptState => ({
  items: [
    { kind: 'user', id: 1, text },
    { kind: 'agent', id: 2, text: `Réponse à « ${text} »` }
  ],
  nextId: 3
})

/** Fils « sur le disque » : empreinte et contenu modifiables, lectures comptées. */
function disk(files: Record<string, { stamp: string; transcript?: TranscriptState }>) {
  const reads: string[] = []
  let release: (() => void) | undefined
  const source: TranscriptSource = {
    transcriptStamp: (id) => Promise.resolve(files[id]?.stamp),
    readTranscriptAsync: async (id) => {
      reads.push(id)
      if (release === undefined) await Promise.resolve()
      else await new Promise<void>((resolve) => (release = resolve))
      return files[id]?.transcript
    }
  }
  return {
    source,
    reads,
    /** Les lectures attendent `flush()` (lectures simultanées). */
    hold: () => (release = () => {}),
    flush: () => release?.()
  }
}

const conv = (id: string, updatedAt: string, inMemory?: TranscriptState) => ({
  id,
  title: `Conversation ${id}`,
  updatedAt,
  ...(inMemory ? { transcript: inMemory } : {})
})

describe('ContentSearch (fiche 046)', () => {
  it('fils sur le disque lus une fois, puis cherchés dans le cache tant qu’ils ne changent pas', async () => {
    const files = {
      a: { stamp: '1', transcript: transcript('La migration vers Postgres échoue') },
      b: { stamp: '1', transcript: transcript('Ajouter un bouton') }
    }
    const { source, reads } = disk(files)
    const search = new ContentSearch(source)
    const list = [conv('a', '2026-10-01'), conv('b', '2026-10-02')]

    expect((await search.search(list, 'postgres')).map((h) => h.id)).toEqual(['a'])
    expect(reads.sort()).toEqual(['a', 'b'])
    expect((await search.search(list, 'bouton')).map((h) => h.id)).toEqual(['b'])
    expect(reads).toHaveLength(2)

    // Fichier réécrit (nouvelle empreinte) : relu, l'ancien texte ne répond plus.
    files.a = { stamp: '2', transcript: transcript('Passer à SQLite') }
    expect(await search.search(list, 'postgres')).toEqual([])
    expect(await search.search(list, 'sqlite')).toHaveLength(1)
    expect(reads.filter((id) => id === 'a')).toHaveLength(2)
  })

  it('conversation ouverte : cherchée dans sa version en mémoire, sans lire le disque', async () => {
    const { source, reads } = disk({ a: { stamp: '1', transcript: transcript('ancien texte') } })
    const search = new ContentSearch(source)
    const hits = await search.search([conv('a', '2026-10-01', transcript('texte frais'))], 'frais')
    expect(hits.map((h) => h.id)).toEqual(['a'])
    expect(reads).toEqual([])
  })

  it('consigne cachée d’un rôle : jamais cherchée ni montrée dans l’extrait (fiche 272)', async () => {
    const { source } = disk({})
    const search = new ContentSearch(source)
    const text =
      'Ajoute la persistance. Lance npm test.\n\n<bobine_role name="back-architect">\nTu es architecte persistance.\n</bobine_role>'
    const role: TranscriptState = {
      items: [
        { kind: 'user', id: 1, text },
        { kind: 'agent', id: 2, text: 'Fait.' }
      ],
      nextId: 3
    }
    const hits = await search.search([conv('a', '2026-10-01', role)], 'persistance')
    expect(hits).toHaveLength(1)
    expect(JSON.stringify(hits)).not.toContain('bobine_role')
    expect(await search.search([conv('b', '2026-10-01', role)], 'architecte')).toEqual([])
  })

  it('deux recherches simultanées : chaque fichier lu une seule fois', async () => {
    const files = { a: { stamp: '1', transcript: transcript('Postgres') } }
    const { source, reads, hold, flush } = disk(files)
    hold()
    const search = new ContentSearch(source)
    const list = [conv('a', '2026-10-01')]
    const first = search.search(list, 'postgres')
    const second = search.search(list, 'postgres')
    await new Promise((resolve) => setTimeout(resolve, 0))
    flush()
    expect((await first).map((h) => h.id)).toEqual(['a'])
    expect((await second).map((h) => h.id)).toEqual(['a'])
    expect(reads).toEqual(['a'])
  })

  it('fil abîmé ou absent : ignoré sans erreur', async () => {
    const { source } = disk({ a: { stamp: '1' } })
    const search = new ContentSearch(source)
    const list = [conv('a', '2026-10-01'), conv('b', '2026-10-02')]
    expect(await search.search(list, 'postgres')).toEqual([])
    // Les titres sont cherchés par l'interface ; ici, seul le contenu compte (fiche 026).
    expect(await search.search(list, 'conversation')).toEqual([])
  })

  it('cache borné : les plus récentes gardées pendant un parcours, place faite aux anciennes recherches', async () => {
    const files = {
      a: { stamp: '1', transcript: transcript('a'.repeat(40)) },
      b: { stamp: '1', transcript: transcript('b'.repeat(40)) },
      c: { stamp: '1', transcript: transcript('c'.repeat(40)) }
    }
    const { source, reads } = disk(files)
    // Place pour deux textes (≈ 100 caractères chacun, comptés deux fois avec le texte plié).
    const search = new ContentSearch(source, { maxCachedChars: 500 })
    const list = [conv('a', '2026-10-03'), conv('b', '2026-10-02'), conv('c', '2026-10-01')]
    await search.search(list, 'zzz')
    expect(reads).toEqual(['a', 'b', 'c'])
    // `a` et `b`, les plus récentes, sont restées : seule `c` est relue.
    await search.search(list, 'zzz')
    expect(reads.slice(3)).toEqual(['c'])
    // Une recherche qui ne passe que par `c` la garde, aux dépens du texte le moins récent (`a`).
    await search.search([conv('c', '2026-10-01')], 'zzz')
    await search.search([conv('b', '2026-10-02'), conv('c', '2026-10-01')], 'zzz')
    expect(reads.slice(4)).toEqual(['c'])

    search.forget('c')
    await search.search([conv('c', '2026-10-01')], 'zzz')
    expect(reads.at(-1)).toBe('c')
    expect(reads).toHaveLength(6)
  })

  it('fiche 285 : la question d’un tour fait trouver la conversation ; aucun texte interne dans un extrait', async () => {
    const mother: TranscriptState = {
      items: [
        {
          kind: 'roundtable',
          id: 1,
          roundtableId: 'rt',
          question: 'Faut-il passer à pg-boss ?',
          synthesizer: { profileId: 'p', label: 'P' },
          seats: [],
          phase: 'synthesized',
          at: 1
        },
        {
          kind: 'user',
          id: 2,
          text: 'Roundtable: 2 participants answered the question below independently',
          from: { kind: 'roundtable', id: 'rt', title: 'Q', step: 'synthesis' }
        },
        { kind: 'agent', id: 3, text: 'Synthèse : pg-boss convient.' }
      ],
      nextId: 4
    }
    const participant: TranscriptState = {
      items: [
        {
          kind: 'user',
          id: 1,
          text: 'Faut-il passer à pg-boss ?\n\nFor context only, the last exchange of the conversation where this question was asked. Everything…\n<bobine_roundtable_context_ab12>secret</bobine_roundtable_context_ab12>'
        },
        { kind: 'agent', id: 2, text: 'Oui, pg-boss.' }
      ],
      nextId: 3
    }
    const search = new ContentSearch(disk({}).source)
    const list = [
      conv('mere', '2026-10-02', mother),
      conv('participant', '2026-10-01', participant)
    ]
    const hits = await search.search(list, 'pg-boss')
    expect(hits.map((h) => h.id).sort()).toEqual(['mere', 'participant'])
    expect(await search.search(list, 'roundtable')).toEqual([])
    expect(await search.search(list, 'context only')).toEqual([])
    for (const hit of hits) expect(hit.snippet).not.toMatch(/For context|bobine_|Roundtable:/)
  })
})
