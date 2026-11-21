import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ON_WINDOWS, tempDir } from '../test-platform'
import { existingFileLinks, linkList, MAX_CHECKED_LINKS } from './file-exists'

const folder = (prefix: string) =>
  ON_WINDOWS ? tempDir(prefix) : realpathSync(mkdtempSync(join(tmpdir(), prefix)))

/**
 * Projet de la recette de la rc.3 : pas de `package.json`, pas de `tests/` ; `liste.js` et
 * `src/cli.js` existent.
 */
function setup() {
  const workspace = folder('existe-')
  const outside = folder('dehors-')
  mkdirSync(join(workspace, 'src'))
  writeFileSync(join(workspace, 'liste.js'), 'export {}\n')
  writeFileSync(join(workspace, 'src', 'cli.js'), 'export {}\n')
  writeFileSync(join(outside, 'secret.js'), 'dehors\n')
  if (!ON_WINDOWS) symlinkSync(join(outside, 'secret.js'), join(workspace, 'raccourci.js'))
  return { workspace, outside }
}

describe('liens de fichiers qui existent (fiche 272, recette de la rc.3)', () => {
  it('seulement les fichiers du dossier : un fichier à créer ou un chemin relatif ailleurs, non', async () => {
    const { workspace } = setup()
    const found = await existingFileLinks(workspace, [
      'package.json',
      'tests/liste.test.js',
      '../liste.js',
      'liste.js',
      'liste.js:2',
      'src/cli.js:3',
      './src/cli.js',
      'src/../liste.js'
    ])
    expect(found).toEqual([
      'liste.js',
      'liste.js:2',
      'src/cli.js:3',
      './src/cli.js',
      'src/../liste.js'
    ])
  })

  it('confiné au dossier : `..` qui en sort, chemin absolu ailleurs, lien symbolique vers le dehors', async () => {
    const { workspace, outside } = setup()
    const escapes = [
      `../${outside.split(/[\\/]/).at(-1)}/secret.js`,
      join(outside, 'secret.js'),
      ...(ON_WINDOWS ? [] : ['raccourci.js'])
    ]
    expect(await existingFileLinks(workspace, escapes)).toEqual([])
    // Le même fichier par son chemin absolu dans le dossier : oui.
    expect(await existingFileLinks(workspace, [join(workspace, 'liste.js')])).toHaveLength(1)
  })

  it('relatif au document en aperçu (`base`), jamais une base hors du dossier', async () => {
    const { workspace, outside } = setup()
    const base = join(workspace, 'src')
    expect(await existingFileLinks(workspace, ['cli.js', '../liste.js'], { base })).toEqual([
      'cli.js',
      '../liste.js'
    ])
    // Base hors du dossier : on repart du dossier de travail.
    expect(
      await existingFileLinks(workspace, ['secret.js', 'liste.js'], { base: outside })
    ).toEqual(['liste.js'])
  })

  it('borné : nombre de chemins, longueur, liste invalide refusée', async () => {
    const { workspace } = setup()
    expect(await existingFileLinks(workspace, [`${'a/'.repeat(600)}liste.js`])).toEqual([])
    const many = Array.from({ length: MAX_CHECKED_LINKS + 5 }, (_, i) => `f${i}.js`)
    many.push('liste.js')
    // Au-delà de la borne, rien n'est vérifié (`liste.js` est le 206e).
    expect(await existingFileLinks(workspace, many)).toEqual([])
    expect(() => linkList(many)).toThrow()
    expect(() => linkList('liste.js')).toThrow()
    expect(() => linkList([1])).toThrow()
    expect(linkList(['liste.js'])).toEqual(['liste.js'])
  })

  it('dossier de travail absent : rien n’existe, sans erreur', async () => {
    expect(await existingFileLinks(join(tmpdir(), 'bobine-absent-xyz'), ['liste.js'])).toEqual([])
  })
})
