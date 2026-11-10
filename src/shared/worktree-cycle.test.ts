import { describe, expect, it } from 'vitest'
import {
  commitSubject,
  commitType,
  conflictPrompt,
  hasConflictMarkers,
  mergeBlocker,
  prBlocker,
  filesSubject,
  honestSubject,
  proposeCommitMessage,
  proposePr,
  type CommitFile
} from './worktree-cycle'

describe('message de commit proposé', () => {
  it('type deviné : docs, test, fix, sinon feat', () => {
    expect(commitType('Mise à jour', [{ path: 'docs/guide.md', status: 'modified' }])).toBe('docs')
    expect(commitType('Mise à jour', [{ path: 'README.md', status: 'modified' }])).toBe('docs')
    expect(commitType('Couvrir le cas', [{ path: 'src/a.test.ts', status: 'added' }])).toBe('test')
    expect(
      commitType('Corrige le crash au démarrage', [{ path: 'src/a.ts', status: 'modified' }])
    ).toBe('fix')
    expect(commitType('Fix login', [{ path: 'src/a.ts', status: 'modified' }])).toBe('fix')
    expect(
      commitType('Ajoute la page', [
        { path: 'src/a.ts', status: 'modified' },
        { path: 'README.md', status: 'modified' }
      ])
    ).toBe('feat')
    expect(commitType('Quoi que ce soit', [])).toBe('feat')
  })

  it('sujet : minuscule, sans point final, coupé à un mot avec « … »', () => {
    expect(commitSubject('Fais les modifications.')).toBe('fais les modifications')
    expect(commitSubject('  Ajoute   la page  ')).toBe('ajoute la page')
    expect(commitSubject('')).toBe('update files')
    const long =
      'Ajoute une page de contact avec un formulaire complet et sa validation côté serveur'
    const subject = commitSubject(long)
    expect(subject.length).toBeLessThanOrEqual(60)
    // « et sa » ne reste pas en bout de phrase.
    expect(subject).toBe('ajoute une page de contact avec un formulaire complet…')
  })

  it('sujet (C14) : jamais coupé au milieu d’un mot, ni sur un article ou une préposition', () => {
    const title = 'Deux chantiers indépendants, à confier chacun à une conversation fille'
    const subject = commitSubject(title)
    expect(subject).toBe('deux chantiers indépendants, à confier chacun…')
    expect(subject.length).toBeLessThanOrEqual(60)
    // Limite pile sur un mot : il est gardé entier ; coupé dans un mot, on recule d’un mot.
    const exact = `${'a'.repeat(30)} ${'b'.repeat(28)} ${'c'.repeat(10)}`
    expect(commitSubject(exact)).toBe(`${'a'.repeat(30)} ${'b'.repeat(28)}…`)
    expect(commitSubject(`${'a'.repeat(30)} ${'b'.repeat(35)}`)).toBe(`${'a'.repeat(30)}…`)
    // Titre de 60 caractères : tel quel, sans « … ».
    expect(commitSubject(`${'a'.repeat(30)} ${'b'.repeat(29)}`)).toBe(
      `${'a'.repeat(30)} ${'b'.repeat(29)}`
    )
    // Un seul mot très long : coupé faute de mieux.
    expect(commitSubject('x'.repeat(80))).toBe(`${'x'.repeat(59)}…`)
    // Anglais et apostrophes.
    expect(
      commitSubject('Add a new settings page for the user profile and the notification options')
    ).toBe('add a new settings page for the user profile…')
  })

  it('message : sujet, puis les fichiers avec leur état', () => {
    expect(
      proposeCommitMessage('Ajoute la page de contact', [
        { path: 'src/pages/contact.tsx', status: 'untracked' },
        { path: 'src/router.ts', status: 'modified' },
        { path: 'src/old.ts', status: 'deleted' },
        { path: 'src/new.ts', status: 'renamed' }
      ])
    ).toBe(
      [
        'feat: ajoute la page de contact',
        '',
        '- src/pages/contact.tsx (new)',
        '- src/router.ts',
        '- src/old.ts (deleted)',
        '- src/new.ts (renamed)'
      ].join('\n')
    )
    expect(proposeCommitMessage('Titre', [])).toBe('feat: titre')
    const many = Array.from({ length: 25 }, (_, i) => ({
      path: `src/f${i}.ts`,
      status: 'modified' as const
    }))
    expect(proposeCommitMessage('Titre', many)).toContain('- … and 5 more')
  })
})

describe('PR et conflits', () => {
  it('PR : titre de la conversation, commits et fichiers', () => {
    expect(proposePr(' Page de contact ', ['feat: page', 'fix: typo'], ['a.ts', 'b.ts'])).toEqual({
      title: 'Page de contact',
      body: '## Commits\n- feat: page\n- fix: typo\n\n## Files\n- a.ts\n- b.ts'
    })
    expect(proposePr('', [], [])).toEqual({ title: 'Changes from Bobine', body: '' })
  })

  it('consigne de résolution : fichiers listés, ne pas committer', () => {
    const text = conflictPrompt('main', 'bobine/x', ['README.md', 'src/a.ts'])
    expect(text).toContain('`main` into `bobine/x`')
    expect(text).toContain('- README.md\n- src/a.ts')
    expect(text).toContain('Do not commit')
  })

  it('marqueurs de conflit', () => {
    expect(hasConflictMarkers('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> main\n')).toBe(true)
    expect(hasConflictMarkers('<<<<<<<\n')).toBe(true)
    expect(hasConflictMarkers('résolu\n')).toBe(false)
    // Une ligne de séparation Markdown de sept « = » n'en est pas un marqueur ; git non plus.
    expect(hasConflictMarkers('titre\n=======\n')).toBe(true)
  })
})

describe('ce qui bloque les boutons', () => {
  it('PR : gh, connexion, dépôt distant, rien à pousser', () => {
    expect(prBlocker({ pr: { ok: false, reason: 'no-gh' }, ahead: 1 })).toBe('noGh')
    expect(prBlocker({ pr: { ok: false, reason: 'not-logged' }, ahead: 1 })).toBe('notLogged')
    expect(prBlocker({ pr: { ok: false, reason: 'no-remote' }, ahead: 1 })).toBe('noRemote')
    expect(prBlocker({ pr: { ok: true, remote: 'origin' }, ahead: 0 })).toBe('nothing')
    expect(prBlocker({ pr: { ok: true, remote: 'origin' }, ahead: 2 })).toBeUndefined()
  })

  it('fusion : à committer d’abord, rien à fusionner, ou reprise d’une fusion arrêtée', () => {
    expect(mergeBlocker({ dirty: 2, ahead: 1 })).toBe('dirty')
    expect(mergeBlocker({ dirty: 0, ahead: 0 })).toBe('nothing')
    expect(mergeBlocker({ dirty: 0, ahead: 1 })).toBeUndefined()
    expect(mergeBlocker({ merging: { files: ['a'] }, dirty: 1, ahead: 0 })).toBeUndefined()
  })
})

describe('nom court d’une demande de fusion (fiche 189)', () => {
  it('groupe/projet!n sur GitLab, owner/repo#n sur GitHub, l’adresse sinon', async () => {
    const { requestRef } = await import('./worktree-cycle')
    expect(requestRef('https://gitlab.acme.fr/demo/app/-/merge_requests/1')).toBe('demo/app!1')
    expect(requestRef('http://localhost:8929/g/sub/p/-/merge_requests/12/')).toBe('g/sub/p!12')
    expect(requestRef('https://github.com/jlallement/bobine-qa-0-9/pull/12')).toBe(
      'jlallement/bobine-qa-0-9#12'
    )
    expect(requestRef('https://forge.example/x/y/pr/3')).toBe('https://forge.example/x/y/pr/3')
  })
})

describe('sujet honnête (0.11, D4)', () => {
  const file = (path: string, status: CommitFile['status'] = 'modified'): CommitFile => ({
    path,
    status
  })
  it('titre court : gardé ; titre long : résumé des fichiers cochés, jamais coupé', () => {
    expect(honestSubject('Ajoute la page de contact', [file('src/a.ts')])).toBe(
      'ajoute la page de contact'
    )
    const long =
      'Peux-tu revoir toute la page de contact, le formulaire et la doc du README pour la 0.11 ?'
    expect(honestSubject(long, [file('src/contact.tsx')])).toBe('update contact.tsx')
    expect(honestSubject('', [file('notes.md', 'untracked')])).toBe('add notes.md')
    expect(honestSubject('', [])).toBe('update files')
  })
  it('résumé : verbe selon l’état, noms jusqu’à trois, sinon le compte et le dossier commun', () => {
    expect(filesSubject([file('a.ts', 'deleted'), file('b.ts', 'deleted')])).toBe(
      'remove a.ts and b.ts'
    )
    expect(filesSubject([file('x/a.ts'), file('y/b.ts', 'untracked'), file('c.ts')])).toBe(
      'update a.ts, b.ts and c.ts'
    )
    expect(filesSubject(['a', 'b', 'c', 'd'].map((n) => file(`src/panel/${n}.ts`, 'added')))).toBe(
      'add 4 files in src/panel'
    )
    expect(filesSubject(['src/a.ts', 'docs/b.md', 'c.ts', 'd.ts'].map((p) => file(p)))).toBe(
      'update 4 files'
    )
  })
  it('message : ne parle que des fichiers cochés', () => {
    const message = proposeCommitMessage(
      'Un titre bien trop long pour tenir dans un sujet de commit honnête',
      [file('src/app.js')]
    )
    expect(message).toBe('feat: update app.js\n\n- src/app.js')
    expect(message).not.toContain('README')
  })
})
