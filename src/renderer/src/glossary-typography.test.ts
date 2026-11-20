/**
 * Typographie du glossaire (`docs/traduction.md`, fiche 272, recette) : apostrophe courbe `’` dans
 * les textes français de l'interface et dans les Nouveautés (`CHANGELOG.md`, hors code) ; l'unité de
 * Bob s'affiche « Bobcoin(s) », avec sa majuscule. Les mots-clés de la recherche des réglages
 * (`settingsSearch.*`, `*.search.*`), jamais affichés, restent libres.
 */
import { describe, expect, it } from 'vitest'
import fr from '@shared/i18n/locales/fr.json'
import changelog from '../../../CHANGELOG.md?raw'

type Tree = { readonly [key: string]: string | Tree }
const flatten = (tree: Tree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value]] : flatten(value, path)
  })
const texts = flatten(fr as Tree)
/** Mots-clés de recherche, jamais affichés : `settingsSearch.*`, `*.search.*`. */
const keywords = (key: string) => key.startsWith('settingsSearch.') || key.includes('.search.')
const STRAIGHT = /\p{L}'\p{L}/u
/** Texte hors des segments de code (`…`) et des blocs ```. */
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')

describe('typographie du glossaire (fiche 272)', () => {
  it('fr.json : apostrophe courbe, jamais droite', () => {
    expect(texts.filter(([, text]) => STRAIGHT.test(prose(text)))).toEqual([])
  })

  it('Nouveautés (CHANGELOG.md) : apostrophe courbe hors du code', () => {
    const lines = changelog.split('\n').filter((line: string) => STRAIGHT.test(prose(line)))
    expect(lines).toEqual([])
  })

  it('« Bobcoin(s) » avec sa majuscule à l’affichage', () => {
    expect(texts.filter(([key, text]) => !keywords(key) && /\bbobcoins?\b/.test(text))).toEqual([])
  })
})
