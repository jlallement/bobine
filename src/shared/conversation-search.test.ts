import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from './agent'
import {
  foldSameLength,
  matchContent,
  plainText,
  searchConversations,
  searchWords
} from './conversation-search'

const conv = (id: string, title: string, workspace: string, profileLabel = 'IBM Bob') =>
  ({ id, title, workspace, profileLabel }) as ConversationSummary

describe('searchConversations', () => {
  const list = [
    conv('1', 'Écran de connexion', '/Users/j/app-mobile'),
    conv('2', 'Corriger le build Android', '/Users/j/app-mobile', 'OpenCode'),
    conv('3', 'Notes de réunion', '/Users/j/docs')
  ]
  it('tous les mots, sans casse ni accents, dans le titre, le dossier ou l’agent', () => {
    expect(searchConversations(list, 'ecran').map((c) => c.id)).toEqual(['1'])
    expect(searchConversations(list, 'app-mobile build').map((c) => c.id)).toEqual(['2'])
    expect(searchConversations(list, 'opencode').map((c) => c.id)).toEqual(['2'])
    expect(searchConversations(list, '  ').map((c) => c.id)).toEqual(['1', '2', '3'])
    expect(searchConversations(list, 'introuvable')).toEqual([])
  })
})

describe('recherche dans le contenu', () => {
  it('pliage sans changer la longueur (positions conservées)', () => {
    const text = 'Électricité ÇA é'
    expect(foldSameLength(text)).toHaveLength(text.length)
    expect(foldSameLength(text).startsWith('electricite ca e')).toBe(true)
  })

  it('pliage rapide identique au pliage caractère par caractère (fiche 046)', () => {
    const reference = (text: string) => {
      let out = ''
      for (const unit of text) {
        const folded = unit
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
        out +=
          folded.length === unit.length ? folded : unit.length === 1 ? (folded[0] ?? '\0') : unit
      }
      return out
    }
    const samples = [
      'Électricité ÇA é — ASCII PUR 123 ^cap^ `code`',
      'İstanbul ß ẞ Ωμέγα Ἄλφα ﬁn ½ ǅ',
      'e\u0301 combiné, 한국어 조선말, 日本語のテキスト',
      'emoji 👍🏽 👨‍👩‍👧 drapeaux 🇫🇷, surrogat seul \ud800 fin',
      '\tTabulation\nNouvelle ligne\r\n\u0000 nul',
      ''
    ]
    for (const sample of samples) {
      expect(foldSameLength(sample)).toBe(reference(sample))
      expect(foldSameLength(sample)).toHaveLength(sample.length)
    }
    const big = 'Réponse détaillée, sans ambiguïté. '.repeat(30_000)
    expect(foldSameLength(big)).toBe(reference(big))
  })

  it('extrait autour du premier mot, mots surlignés, mots répartis entre titre et contenu', () => {
    const content = `${'x'.repeat(100)} La migration vers Postgres échoue sur l’index. Fin.`
    const hit = matchContent('Base de données', content, searchWords('postgres ECHOUE base'))
    expect(hit?.snippet.startsWith('…')).toBe(true)
    const marked = hit?.highlights.map(([a, b]) => hit.snippet.slice(a, b))
    expect(marked).toEqual(['Postgres', 'échoue'])
  })

  it('un mot absent partout : pas de résultat ; tout dans le titre : pas d’extrait', () => {
    expect(matchContent('Titre', 'contenu', searchWords('contenu absent'))).toBeNull()
    expect(matchContent('Postgres', 'rien', searchWords('postgres'))).toBeNull()
  })

  it('réponse de l’agent sans Markdown', () => {
    const md =
      '## Titre\n\nUn **gras**, du `code` et [un lien](https://x).\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1\n```'
    const text = plainText(md)
    expect(text).not.toMatch(/[*`#|]|---/)
    expect(text).toContain('Un gras, du code et un lien.')
    expect(text).toContain('const x = 1')
    expect(text).toContain(' a b ')
  })
})
