import { describe, expect, it } from 'vitest'
import { HELP_TOPICS } from '@shared/help-topics'
import {
  GUIDE_LANGS,
  HOME_PAGE,
  guideLang,
  type GuideLang,
  pageSections,
  parseGuide,
  plainText,
  tableOfContents
} from './guide'
import { GUIDE_IMAGES, loadGuidePages } from './guide-content'
import { guideImageKey, resolveGuideLink } from './links'
import { highlight, queryTerms, searchGuide, snippet } from './search'

const PAGE = `# Worktrees

Intro avec un [lien](#preparation).

<a id="preparation"></a>

## Préparer un worktree

Listez les fichiers dans \`.worktreeinclude\` : **Bobine** les copie.

\`\`\`
<a id="pas-une-ancre"></a>
## pas un titre
\`\`\`

<a id="fusionner"></a>

### Fusionner
Texte.
`

describe('guide embarqué (fiche 186)', () => {
  it('découpe une page en sections, ancres stables comprises, hors blocs de code', () => {
    const sections = pageSections('worktrees', PAGE)
    expect(sections.map((s) => [s.title, s.anchor])).toEqual([
      ['Worktrees', undefined],
      ['Préparer un worktree', 'preparation'],
      ['Fusionner', 'fusionner']
    ])
    expect(sections[1]?.text).toContain(
      'Listez les fichiers dans .worktreeinclude : Bobine les copie.'
    )
    expect(sections[1]?.text).toContain('## pas un titre')
  })

  it('texte lisible sans la syntaxe Markdown', () => {
    expect(plainText('Voir [la page](a.md), `code`, **gras** et ![img](x.png)')).toBe(
      'Voir la page, code, gras et'
    )
  })

  it('sommaire : groupes du README, pages connues seulement', () => {
    const toc = tableOfContents(
      '# Guide\n\n## Commencer\n\n1. [Premiers pas](premiers-pas.md) : …\n2. [Inconnue](x.md)\n\n## Voir aussi\n\n- [CHANGELOG](../../../CHANGELOG.md)\n',
      { 'premiers-pas': 'Premiers pas' }
    )
    expect(toc).toEqual([
      { title: 'Commencer', pages: [{ page: 'premiers-pas', title: 'Premiers pas' }] }
    ])
  })

  it('langue du guide : français pour fr-*, anglais sinon', () => {
    expect(guideLang('fr-FR')).toBe('fr')
    expect(guideLang('en-US')).toBe('en')
    expect(guideLang('de')).toBe('en')
  })

  it('chaque sujet de l’interface vise une page et une ancre du guide, dans chaque langue', async () => {
    for (const lang of GUIDE_LANGS) {
      const guide = parseGuide(lang, await loadGuidePages(lang))
      expect(guide.toc.length, lang).toBeGreaterThanOrEqual(3)
      for (const [topic, target] of Object.entries(HELP_TOPICS)) {
        expect(guide.pages[target.page], `${lang} ${topic}`).toBeDefined()
        if ('anchor' in target) {
          expect(
            guide.sections.some((s) => s.page === target.page && s.anchor === target.anchor),
            `${lang} ${topic} → ${target.page}#${target.anchor}`
          ).toBe(true)
        }
      }
    }
  })

  it('recherche : l’accueil répond par ses notes, jamais par son sommaire', async () => {
    const pagesOf = async (lang: GuideLang, query: string) => {
      const guide = parseGuide(lang, await loadGuidePages(lang))
      return searchGuide(guide.sections, guide.titles, query).map((r) => r.section)
    }
    // « Voir aussi » est le seul endroit qui parle des astuces : trouvé, et rien d'autre.
    for (const [lang, query, title] of [
      ['fr', 'astuces', 'Voir aussi'],
      ['fr', 'astuce', 'Voir aussi'],
      ['en', 'tips', 'See also']
    ] as const) {
      const found = await pagesOf(lang, query)
      expect(
        found.map((s) => [s.page, s.title]),
        `${lang} ${query}`
      ).toContainEqual([HOME_PAGE, title])
    }
    // Les groupes du sommaire (Commencer, Travailler, Référence) ne sont pas cherchables.
    for (const lang of GUIDE_LANGS) {
      const guide = parseGuide(lang, await loadGuidePages(lang))
      const home = guide.sections.filter((s) => s.page === HOME_PAGE).map((s) => s.title)
      for (const group of guide.toc) expect(home, lang).not.toContain(group.title)
    }
    // Un mot de page n'amène pas l'accueil, et l'accueil passe derrière à score égal.
    expect((await pagesOf('fr', 'worktree')).some((s) => s.page === HOME_PAGE)).toBe(false)
    const agent = await pagesOf('fr', 'agent')
    expect(agent[0]?.page).not.toBe(HOME_PAGE)
  })

  it('chaque image d’une page est embarquée', async () => {
    for (const lang of GUIDE_LANGS) {
      for (const [page, text] of Object.entries(await loadGuidePages(lang))) {
        for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
          const key = guideImageKey(m[1] ?? '', lang, page)
          expect(key && GUIDE_IMAGES[key], `${lang}/${page} ${m[1]}`).toBeTruthy()
        }
      }
    }
  })
})

describe('liens du guide (fiche 186)', () => {
  const link = (href: string) => resolveGuideLink(href, 'fr', 'worktrees')
  it('pages et ancres de l’aide, l’autre langue, les Nouveautés', () => {
    expect(link('#preparation')).toEqual({
      kind: 'page',
      lang: 'fr',
      page: 'worktrees',
      anchor: 'preparation'
    })
    expect(link('faire-relire.md#lancer')).toEqual({
      kind: 'page',
      lang: 'fr',
      page: 'faire-relire',
      anchor: 'lancer'
    })
    expect(link('../en/README.md')).toEqual({ kind: 'page', lang: 'en', page: 'README' })
    expect(link('../../../CHANGELOG.md')).toEqual({ kind: 'changelog' })
  })
  it('un autre fichier du dépôt sur GitHub ; http(s) dans le navigateur ; le reste désactivé', () => {
    expect(link('../../installation.md')).toEqual({
      kind: 'external',
      url: 'https://github.com/jlallement/bobine/blob/main/docs/installation.md'
    })
    expect(link('https://example.com/a')).toEqual({
      kind: 'external',
      url: 'https://example.com/a'
    })
    for (const href of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'mailto:a@b.c',
      '/etc/hosts',
      'data:text/html,x',
      '//evil.example/x'
    ]) {
      expect(link(href), href).toEqual({ kind: 'none' })
    }
    // Majuscules dans le schéma : toujours un lien web ; `%` mal formé : pas d'erreur, pas d'ancre.
    expect(link('HTTP://Example.com/a')).toEqual({ kind: 'external', url: 'HTTP://Example.com/a' })
    expect(link('aparte.md#%E0%A4%A')).toEqual({ kind: 'page', lang: 'fr', page: 'aparte' })
    expect(link('#%')).toEqual({ kind: 'page', lang: 'fr', page: 'worktrees' })
    // Remonter plus haut que le dépôt reste dans le dépôt, sur GitHub.
    expect(link('../../../../../x.md')).toEqual({
      kind: 'external',
      url: 'https://github.com/jlallement/bobine/blob/main/x.md'
    })
  })
  it('images : seulement celles du guide', () => {
    expect(guideImageKey('../images/fr/a.png', 'fr', 'aparte')).toBe('fr/a.png')
    expect(guideImageKey('https://x/a.png', 'fr', 'aparte')).toBeUndefined()
    expect(guideImageKey('../../../secret.png', 'fr', 'aparte')).toBeUndefined()
  })
})

describe('recherche dans l’aide (fiche 186)', () => {
  const sections = pageSections('worktrees', PAGE).concat(
    pageSections(
      'depannage',
      '# Dépannage\n\n<a id="orphelins"></a>\n\n## Worktree orphelin\n\nUn worktree perdu.\n'
    )
  )
  const titles = { worktrees: 'Worktrees', depannage: 'Dépannage' }
  it('sans accents ni casse, tous les mots, titres d’abord', () => {
    expect(queryTerms('  Préparer  WORKTREE ')).toEqual(['preparer', 'worktree'])
    const results = searchGuide(sections, titles, 'preparer worktree')
    expect(results.map((r) => r.section.anchor)).toEqual(['preparation'])
    const all = searchGuide(sections, titles, 'worktree')
    // La page Worktrees d'abord, avant une section d'une autre page qui en parle.
    expect(all[0]?.section.page).toBe('worktrees')
    expect(searchGuide(sections, titles, 'introuvable')).toEqual([])
    expect(searchGuide(sections, titles, '   ')).toEqual([])
  })
  it('mots trouvés au début d’un mot, soulignés dans l’extrait', () => {
    expect(highlight('Les worktrees, un Worktree', ['worktree'])).toEqual([
      { text: 'Les ', match: false },
      { text: 'worktree', match: true },
      { text: 's, un ', match: false },
      { text: 'Worktree', match: true }
    ])
    expect(highlight('preworktree', ['worktree'])).toEqual([{ text: 'preworktree', match: false }])
    const cut = snippet(`${'a '.repeat(60)}cible ${'b '.repeat(80)}`, ['cible'])
    expect(cut[0]?.text.startsWith('… ')).toBe(true)
    expect(cut.some((s) => s.match && s.text === 'cible')).toBe(true)
  })
  it('les positions restent justes avec des accents et des emojis', () => {
    expect(highlight('🙂 Été à Évian', ['evian'])).toContainEqual({ text: 'Évian', match: true })
  })
})
