import { describe, expect, it } from 'vitest'
import {
  commitDraftPrompt,
  draftFromReply,
  DRAFT_LIMITS,
  fallbackCommitMessage
} from './commit-draft'

describe('fallbackCommitMessage (fiche 246)', () => {
  it('anglais, Conventional Commits, déduit des fichiers seuls : `chore` sans intention connue', () => {
    expect(
      fallbackCommitMessage([
        { path: 'public/app.js', status: 'modified' },
        { path: 'public/filters.js', status: 'untracked' },
        { path: 'public/index.html', status: 'modified' },
        { path: 'public/style.css', status: 'modified' }
      ])
    ).toBe(
      'chore: update 4 files in public\n\n- public/app.js\n- public/filters.js (new)\n- public/index.html\n- public/style.css'
    )
  })

  it('docs et test quand tous les fichiers le sont', () => {
    expect(fallbackCommitMessage([{ path: 'docs/a.md', status: 'modified' }])).toMatch(/^docs: /)
    expect(fallbackCommitMessage([{ path: 'src/a.test.ts', status: 'added' }])).toMatch(
      /^test: add a\.test\.ts/
    )
  })

  it('ne coupe jamais un mot : un sujet trop long change de forme', () => {
    const long = 'a-very-long-component-name-that-would-never-fit-in-a-subject.tsx'
    const message = fallbackCommitMessage([
      { path: `src/${long}`, status: 'modified' },
      { path: 'src/b.ts', status: 'modified' }
    ])
    const subject = message.split('\n')[0] ?? ''
    expect(subject).toBe('chore: update 2 files in src')
    expect(subject).not.toContain('…')
  })

  it('ne dépend plus du titre (en français, D3)', () => {
    expect(fallbackCommitMessage([{ path: 'index.html', status: 'modified' }])).toBe(
      'chore: update index.html\n\n- index.html'
    )
  })
})

describe('draftFromReply (fiche 246)', () => {
  it('garde le texte, sans le bloc de code qui l’entoure', () => {
    expect(draftFromReply('```text\nfeat: add x\n\nBody.\n```', 'end_turn')).toEqual({
      message: 'feat: add x\n\nBody.'
    })
    expect(draftFromReply('  feat: add x \n', 'end_turn')).toEqual({ message: 'feat: add x' })
  })

  it('refus, arrêt, autre fin, vide, démesuré : la raison du repli', () => {
    expect(draftFromReply('no', 'refusal')).toEqual({ reason: 'refused' })
    expect(draftFromReply('', 'cancelled')).toEqual({ reason: 'stopped' })
    expect(draftFromReply('feat: x', 'max_tokens')).toEqual({ reason: 'failed' })
    expect(draftFromReply(' \n', 'end_turn')).toEqual({ reason: 'empty' })
    expect(draftFromReply('x'.repeat(DRAFT_LIMITS.replyChars + 1), 'end_turn')).toEqual({
      reason: 'too-long'
    })
  })
})

describe('commitDraftPrompt (fiche 246)', () => {
  it('consigne, notes, intention, fichiers cochés et diff ; un fichier retenu ne donne que son chemin', () => {
    const prompt = commitDraftPrompt({
      title: 'Ajoute le filtre',
      firstMessage: 'Ajoute le filtre par statut',
      memories: [
        { name: 'style', description: 'Commits', body: 'Conventional Commits in English.' }
      ],
      files: [
        { path: 'app.js', status: 'modified', diff: '+const a = 2' },
        { path: '.env', status: 'untracked', withheld: 'secret' },
        { path: 'big.json', status: 'modified', withheld: 'too-long', added: 900, removed: 3 }
      ]
    })
    expect(prompt.startsWith('<bobine_commit_message>')).toBe(true)
    expect(prompt).toContain('Reply with the commit message only')
    expect(prompt).toContain('Conventional Commits in English.')
    expect(prompt).toContain('<first_request>\nAjoute le filtre par statut\n</first_request>')
    expect(prompt).toContain('- app.js (modified)')
    expect(prompt).toContain('- .env (new, content withheld: may contain secrets)')
    expect(prompt).toContain('- big.json (modified, diff omitted: too long) +900 -3')
    expect(prompt).toContain('<diff>\n+const a = 2\n</diff>')
  })

  it('sans mémoire ni premier message : rien de ces blocs', () => {
    const prompt = commitDraftPrompt({
      title: '',
      memories: [],
      files: [{ path: 'a', status: 'modified' }]
    })
    expect(prompt).not.toContain('<user_notes>')
    expect(prompt).not.toContain('<first_request>')
    expect(prompt).not.toContain('<diff>')
  })
})
