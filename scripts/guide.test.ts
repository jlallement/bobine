import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guide de l'utilisateur (fiche 186) : pages Markdown de `docs/guide/<langue>/`, lues sur GitHub et
 * plus tard dans l'app. Les ancres stables sont des `<a id="…"></a>` (les mêmes en français et en
 * anglais, pour les liens « ? » de l'interface) ; chaque lien relatif vise un fichier qui existe, et
 * chaque `#ancre` une ancre de ce fichier.
 */
const root = resolve(__dirname, '..')
const guide = join(root, 'docs', 'guide')
const LANGS = ['fr', 'en'].filter((lang) => existsSync(join(guide, lang)))

const pages = (lang: string) =>
  readdirSync(join(guide, lang))
    .filter((f) => f.endsWith('.md'))
    .sort()

const anchorsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/<a id="([a-z0-9-]+)"><\/a>/g)].map((m) => m[1] ?? '')

/** Liens Markdown `[texte](cible)` et images `![texte](cible)`, hors blocs de code. */
function linksOf(file: string): string[] {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  return [...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? '')
}

describe('guide de l’utilisateur', () => {
  it('existe en français', () => {
    expect(LANGS).toContain('fr')
    expect(pages('fr')).toContain('README.md')
  })

  it('a les mêmes pages et les mêmes ancres dans chaque langue', () => {
    for (const lang of LANGS) {
      expect(pages(lang), lang).toEqual(pages('fr'))
      for (const page of pages('fr')) {
        expect(anchorsOf(join(guide, lang, page)), `${lang}/${page}`).toEqual(
          anchorsOf(join(guide, 'fr', page))
        )
      }
    }
  })

  it('n’a pas d’ancre en double', () => {
    for (const lang of LANGS) {
      for (const page of pages(lang)) {
        const anchors = anchorsOf(join(guide, lang, page))
        expect(new Set(anchors).size, `${lang}/${page}`).toBe(anchors.length)
      }
    }
  })

  it('a des liens relatifs et des ancres valides', () => {
    const broken: string[] = []
    for (const lang of LANGS) {
      for (const page of pages(lang)) {
        const file = join(guide, lang, page)
        for (const link of linksOf(file)) {
          if (/^[a-z]+:/i.test(link)) continue
          const [path, anchor] = link.split('#')
          const target = path ? resolve(dirname(file), path) : file
          if (!existsSync(target)) {
            broken.push(`${lang}/${page} → ${link} (fichier absent)`)
          } else if (anchor && !anchorsOf(target).includes(anchor)) {
            broken.push(`${lang}/${page} → ${link} (ancre absente)`)
          }
        }
      }
    }
    expect(broken).toEqual([])
  })
})
