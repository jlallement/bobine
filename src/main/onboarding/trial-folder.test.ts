import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTrialFolder, displayPath, folderHints } from './trial-folder'

const root = () => mkdtempSync(join(tmpdir(), 'bobine-essai-test-'))

describe('dossier d’essai (fiche 188)', () => {
  it('créé avec son parent, toujours neuf : un dossier existant, même vide, n’est jamais repris', () => {
    const home = root()
    const parent = join(home, 'Bobine')
    expect(createTrialFolder(parent, 'essai', home)).toBe(join(realpathSync(parent), 'essai'))
    expect(createTrialFolder(parent, 'essai', home)).toBe(join(realpathSync(parent), 'essai-2'))
  })

  it('jamais dans un dossier non vide ni sur un fichier : essai-2, essai-3…', () => {
    const home = root()
    mkdirSync(join(home, 'essai'))
    writeFileSync(join(home, 'essai', 'projet.txt'), 'à garder')
    writeFileSync(join(home, 'essai-2'), 'un fichier, pas un dossier')
    expect(createTrialFolder(home, 'essai', home)).toBe(join(realpathSync(home), 'essai-3'))
    expect(readdirSync(join(home, 'essai'))).toEqual(['projet.txt'])
  })

  it('lien symbolique à la place d’un essai : jamais suivi', () => {
    const home = root()
    const elsewhere = root()
    symlinkSync(elsewhere, join(home, 'essai'))
    expect(createTrialFolder(home, 'essai', home)).toBe(join(realpathSync(home), 'essai-2'))
    expect(readdirSync(elsewhere)).toEqual([])
  })

  it('parent qui est un lien, ou hors du dossier personnel : refusé', () => {
    const home = root()
    const outside = root()
    symlinkSync(outside, join(home, 'Bobine'))
    expect(() => createTrialFolder(join(home, 'Bobine'), 'essai', home)).toThrow('link')
    expect(() => createTrialFolder(join(outside, 'x'), 'essai', home)).toThrow('outside')
    expect(readdirSync(outside)).toEqual(['x'].filter(() => false).concat(readdirSync(outside)))
  })

  it('chemin montré : `~` pour le dossier personnel', () => {
    expect(displayPath('/Users/ana/Bobine', '/Users/ana')).toBe('~/Bobine')
    expect(displayPath('/tmp/essais', '/Users/ana')).toBe('/tmp/essais')
    expect(displayPath('/Users/anabelle/x', '/Users/ana')).toBe('/Users/anabelle/x')
  })
})

describe('suggestions d’après le dossier', () => {
  const project = (files: Record<string, string>) => {
    const dir = root()
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
    return dir
  }
  const pkg = JSON.stringify({ scripts: { test: 'vitest' } })

  it('commande des tests selon le gestionnaire du dossier', () => {
    expect(folderHints(project({ 'package.json': pkg, 'pnpm-lock.yaml': '' }))).toEqual({
      testCommand: 'pnpm test'
    })
    expect(folderHints(project({ 'package.json': pkg, 'yarn.lock': '' })).testCommand).toBe(
      'yarn test'
    )
    expect(folderHints(project({ 'package.json': pkg })).testCommand).toBe('npm test')
  })

  it('pas de script `test`, pas de package.json, ou illisible : rien', () => {
    expect(folderHints(project({ 'package.json': '{"scripts":{}}' }))).toEqual({})
    expect(folderHints(project({}))).toEqual({})
    expect(folderHints(project({ 'package.json': '{abîmé' }))).toEqual({})
  })
})
