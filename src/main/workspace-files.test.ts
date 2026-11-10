import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rankPath, searchWorkspaceFiles } from './workspace-files'

function tree(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'ws-'))
  for (const file of files) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), '')
  }
  return root
}

describe('fichiers du dossier (mentions @)', () => {
  it('rankPath : nom, segment ou mot qui commence, nom puis chemin qui contient, lettres en ordre', () => {
    expect(rankPath('src/app.ts', 'app')).toBe(0)
    expect(rankPath('app/index.ts', 'app')).toBe(1)
    expect(rankPath('src/books-list.js', 'list')).toBe(1)
    expect(rankPath('src/main/app.ts', 'src/ma')).toBe(1)
    expect(rankPath('src/myapp.ts', 'app')).toBe(2)
    expect(rankPath('docs/notebooks/x.md', 'books')).toBe(3)
    expect(rankPath('src/main/app.ts', 'srcmapp')).toBe(4)
    expect(rankPath('README.md', 'zz')).toBeUndefined()
  })

  it('lettres dans l’ordre seulement quand rien d’autre ne correspond (fiche 126)', async () => {
    const root = tree([
      'src/books.js',
      'test/books.test.js',
      'ios/Runner/AppFrameworkInfo.plist',
      'ios/Runner.xcworkspace/contents.xcworkspacedata',
      'ios/Runner.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings'
    ])
    const books = (await searchWorkspaceFiles(root, 'books')).map((f) => f.relative)
    expect(books).toEqual(['src/books.js', 'test/books.test.js'])
    const fuzzy = (await searchWorkspaceFiles(root, 'afi')).map((f) => f.relative)
    expect(fuzzy).toEqual(['ios/Runner/AppFrameworkInfo.plist'])
  })

  it('hors dépôt git : parcours qui saute node_modules et les fichiers cachés', async () => {
    const root = tree(['src/app.ts', 'node_modules/x/app.js', '.env', 'README.md'])
    const found = await searchWorkspaceFiles(root, '')
    expect(found.map((f) => f.relative).sort()).toEqual(['README.md', 'src/app.ts'])
    expect((await searchWorkspaceFiles(root, 'app'))[0]).toEqual({
      path: join(root, 'src/app.ts'),
      relative: 'src/app.ts'
    })
  })

  it('dépôt git : respecte le .gitignore', async () => {
    const root = tree(['src/app.ts', 'build.log', '.gitignore'])
    writeFileSync(join(root, '.gitignore'), '*.log\n')
    execFileSync('git', ['init', '-q', root])
    const found = (await searchWorkspaceFiles(root, '')).map((f) => f.relative).sort()
    expect(found).toEqual(['.gitignore', 'src/app.ts'])
  })
})

describe('mentions @ et fichiers d’exclusion de l’agent (fiche 155)', () => {
  it('un fichier exclu n’est pas proposé, la limite compte les autres', async () => {
    const root = tree(['app.ts', 'app.secret.ts', 'src/app-b.ts'])
    const isExcluded = (path: string) => Promise.resolve(path.endsWith('.secret.ts'))
    const found = await searchWorkspaceFiles(root, 'app', 2, isExcluded)
    expect(found.map((f) => f.relative)).toEqual(['app.ts', 'src/app-b.ts'])
  })
})
