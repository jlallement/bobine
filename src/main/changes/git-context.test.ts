import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitCommand } from '../git/git-queue'
import { exclusionsFor } from '../agent-config/exclusions'
import { gitChangesText } from './git-context'

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Essai', '-c', 'user.email=essai@exemple.org', ...args], {
    cwd
  })

describe('@git-changes (fiche 057)', () => {
  it('état et diff depuis le dernier commit, fichiers non suivis listés', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'git-context-'))
    git(repo, 'init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'a.txt'), 'un\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'départ')
    writeFileSync(join(repo, 'a.txt'), 'un\ndeux\n')
    writeFileSync(join(repo, 'nouveau.txt'), 'x\n')
    const text = await gitChangesText(gitCommand, repo)
    expect(text).toContain('## main')
    expect(text).toContain('?? nouveau.txt')
    expect(text).toContain('```diff')
    expect(text).toContain('+deux')
  })

  it('sans modification, sans commit, hors dépôt : le texte le dit', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'git-context-'))
    git(repo, 'init', '-q')
    expect(await gitChangesText(gitCommand, repo)).toContain('Pas encore de commit.')
    writeFileSync(join(repo, 'a.txt'), 'un\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'départ')
    expect(await gitChangesText(gitCommand, repo)).toContain('Aucune modification')
    const outside = mkdtempSync(join(tmpdir(), 'pas-git-'))
    expect(await gitChangesText(gitCommand, outside)).toBe(
      'Le dossier de la conversation n’est pas un dépôt git.'
    )
  })
})

describe('@git-changes et fichiers d’exclusion de l’agent (fiche 155)', () => {
  it('saute les fichiers exclus, dans l’état et le diff, et le dit', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'git-context-'))
    git(repo, 'init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'a.txt'), 'un\n')
    writeFileSync(join(repo, 'secret.txt'), 'clé\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'départ')
    writeFileSync(join(repo, 'a.txt'), 'un\ndeux\n')
    writeFileSync(join(repo, 'secret.txt'), 'clé-modifiée\n')
    mkdirSync(join(repo, 'conf'))
    writeFileSync(join(repo, 'conf', '.env'), 'TOKEN=x\n')
    writeFileSync(join(repo, '.bobignore'), 'secret.txt\n')
    const exclusions = exclusionsFor(
      { summary: () => '', files: ['.bobignore'], always: ['.env'] },
      repo
    )
    const text = await gitChangesText(gitCommand, repo, 'git', exclusions)
    expect(text).toContain('+deux')
    expect(text).toContain('?? .bobignore')
    expect(text).not.toContain('clé-modifiée')
    expect(text).not.toContain('TOKEN')
    expect(text).not.toMatch(/^ M secret\.txt/m)
    expect(text).toContain(
      'Fichiers sautés, exclus pour l’agent par .bobignore, .env : secret.txt, conf/.env.'
    )
  })

  it('dossier de travail dans un sous-dossier du dépôt', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'git-context-'))
    mkdirSync(join(repo, 'app'))
    git(repo, 'init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'app', 'b.txt'), 'un\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'départ')
    writeFileSync(join(repo, 'app', 'b.txt'), 'caché\n')
    writeFileSync(join(repo, 'app', '.bobignore'), 'b.txt\n')
    const workspace = join(repo, 'app')
    const exclusions = exclusionsFor({ summary: () => '', files: ['.bobignore'] }, workspace)
    const text = await gitChangesText(gitCommand, workspace, 'git', exclusions)
    expect(text).not.toContain('+caché')
    expect(text).toContain('app/b.txt.')
  })
})
