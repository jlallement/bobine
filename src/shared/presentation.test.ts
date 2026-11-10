import { describe, expect, it } from 'vitest'
import { abbreviateHome, abbreviateHomeIn, pathParts } from './presentation'

describe('mode présentation (fiche 159)', () => {
  it('abbreviateHome : le dossier personnel devient ~', () => {
    expect(abbreviateHome('/Users/ada/livres/src/a.ts')).toBe('~/livres/src/a.ts')
    expect(abbreviateHome('/Users/ada')).toBe('~')
    expect(abbreviateHome('/home/ada/livres')).toBe('~/livres')
  })

  it('abbreviateHome : hors du dossier personnel, le chemin est intact', () => {
    expect(abbreviateHome('/tmp/livres')).toBe('/tmp/livres')
    expect(abbreviateHome('/Applications/Bobine.app')).toBe('/Applications/Bobine.app')
    expect(abbreviateHome('src/a.ts')).toBe('src/a.ts')
  })

  it('abbreviateHome : avec le dossier connu, seul celui-là et pas un voisin', () => {
    expect(abbreviateHome('/Users/ada/x', '/Users/ada')).toBe('~/x')
    expect(abbreviateHome('/Users/adam/x', '/Users/ada')).toBe('/Users/adam/x')
    expect(abbreviateHome('/Users/ada', '/Users/ada/')).toBe('~')
    expect(abbreviateHome('/Users/bob/x', '/Users/ada')).toBe('/Users/bob/x')
  })

  it('abbreviateHomeIn : dans un texte, chaque chemin personnel', () => {
    expect(abbreviateHomeIn('cd /Users/ada/livres && ls "/Users/ada/a b"')).toBe(
      'cd ~/livres && ls "~/a b"'
    )
    expect(abbreviateHomeIn('/Users/ada')).toBe('~')
    expect(abbreviateHomeIn('rien à /tmp/voir')).toBe('rien à /tmp/voir')
  })
})

describe('chemin coupé au milieu (recette 0.11, C2)', () => {
  it('le nom du dossier à part, le reste avant, le dossier personnel en ~', () => {
    expect(pathParts('/Users/ada/Dev/bobine')).toEqual({ dir: '~/Dev/', name: 'bobine' })
    expect(pathParts('/private/tmp/claude-501/scratchpad/repo-oc')).toEqual({
      dir: '/private/tmp/claude-501/scratchpad/',
      name: 'repo-oc'
    })
    expect(pathParts('/srv/projets/app', '/srv')).toEqual({ dir: '~/projets/', name: 'app' })
  })

  it('chemins courts : ~, /, un seul nom, barre finale', () => {
    expect(pathParts('/Users/ada')).toEqual({ dir: '', name: '~' })
    expect(pathParts('/')).toEqual({ dir: '', name: '/' })
    expect(pathParts('/tmp')).toEqual({ dir: '/', name: 'tmp' })
    expect(pathParts('projet')).toEqual({ dir: '', name: 'projet' })
    expect(pathParts('/Users/ada/Dev/bobine/')).toEqual({ dir: '~/Dev/', name: 'bobine' })
  })

  it('noms Unicode gardés entiers', () => {
    expect(pathParts('/Users/zoé/Projets/Café ☕ été')).toEqual({
      dir: '~/Projets/',
      name: 'Café ☕ été'
    })
    expect(pathParts('/home/李/项目/应用')).toEqual({ dir: '~/项目/', name: '应用' })
  })
})
