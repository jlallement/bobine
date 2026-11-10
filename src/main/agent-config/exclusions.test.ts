import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { BOB_EXCLUSIONS } from './bob-exclusions'
import { cachedDirs, clearExclusionsCache, exclusionsFor, MAX_CACHED_DIRS } from './exclusions'

describe('fichiers d’exclusion de l’agent (fiche 155)', () => {
  let workspace: string
  beforeEach(() => {
    clearExclusionsCache()
    workspace = mkdtempSync(join(tmpdir(), 'exclusions-'))
    mkdirSync(join(workspace, 'src', 'deep'), { recursive: true })
    mkdirSync(join(workspace, 'secrets'))
  })

  it('rien de déclaré : pas d’exclusions', () => {
    expect(exclusionsFor(undefined, workspace)).toBeUndefined()
    expect(exclusionsFor({ summary: () => '', files: [] }, workspace)).toBeUndefined()
  })

  it('syntaxe gitignore à la racine : motifs, dossiers, négation, `.env` toujours', async () => {
    writeFileSync(
      join(workspace, '.bobignore'),
      '# commentaire\n*.key\nsecrets/\n!public.key\n/racine.txt\n'
    )
    const ex = exclusionsFor(BOB_EXCLUSIONS, workspace)
    const is = (path: string) => ex?.isExcluded(join(workspace, path))
    expect(await is('a.key')).toBe(true)
    expect(await is('src/deep/b.key')).toBe(true)
    expect(await is('public.key')).toBe(false)
    expect(await is('secrets/x.txt')).toBe(true)
    expect(await is('racine.txt')).toBe(true)
    expect(await is('src/racine.txt')).toBe(false)
    expect(await is('.env')).toBe(true)
    expect(await is('src/.env')).toBe(true)
    expect(await is('.env.local')).toBe(false)
    expect(await is('src/app.ts')).toBe(false)
    expect(await is('.bobignore')).toBe(false)
    expect(ex?.files).toEqual(['.gitignore', '.bobignore', '.env'])
  })

  it('fichier d’un sous-dossier : ses motifs partent de ce dossier ; `.gitignore` aussi', async () => {
    writeFileSync(join(workspace, 'src', '.bobignore'), 'deep/*.txt\n')
    writeFileSync(join(workspace, '.gitignore'), 'build/\n')
    const ex = exclusionsFor(BOB_EXCLUSIONS, workspace)
    const is = (path: string) => ex?.isExcluded(join(workspace, path))
    expect(await is('src/deep/a.txt')).toBe(true)
    expect(await is('deep/a.txt')).toBe(false)
    expect(await is('build/out.js')).toBe(true)
  })

  it('hors du dossier de travail : rien n’est exclu ; `excluded` garde l’ordre', async () => {
    writeFileSync(join(workspace, '.bobignore'), '*.log\n')
    const ex = exclusionsFor(BOB_EXCLUSIONS, workspace)
    expect(await ex?.isExcluded(join(tmpdir(), 'ailleurs.log'))).toBe(false)
    expect(await ex?.isExcluded(workspace)).toBe(false)
    expect(
      await ex?.excluded([
        join(workspace, 'b.log'),
        join(workspace, 'a.ts'),
        join(workspace, 'a.log')
      ])
    ).toEqual([join(workspace, 'b.log'), join(workspace, 'a.log')])
  })
})

describe('exclusions : cache et ordre des règles (fiche 155)', () => {
  beforeEach(() => clearExclusionsCache())

  it('cache borné : les dossiers les plus anciens sont oubliés', async () => {
    const root = mkdtempSync(join(tmpdir(), 'exclusions-cache-'))
    const ex = exclusionsFor(BOB_EXCLUSIONS, root)
    for (let i = 0; i < MAX_CACHED_DIRS + 50; i++) {
      await ex?.isExcluded(join(root, `d${i}`, 'f.txt'))
    }
    expect(cachedDirs()).toBe(MAX_CACHED_DIRS)
  })

  it('comme Bob, pas comme git : une négation plus profonde ne ré-inclut pas', async () => {
    const root = mkdtempSync(join(tmpdir(), 'exclusions-ordre-'))
    mkdirSync(join(root, 'sub'))
    writeFileSync(join(root, '.bobignore'), '*.log\n')
    writeFileSync(join(root, 'sub', '.bobignore'), '!keep.log\n')
    const ex = exclusionsFor(BOB_EXCLUSIONS, root)
    // git dirait « non exclu » (le fichier le plus profond gagne) ; Bob 2.0.6 l'exclut.
    expect(await ex?.isExcluded(join(root, 'sub', 'keep.log'))).toBe(true)
  })
})
